import { PrismaClient } from '@prisma/client'
import { autoCreateInvoice } from '../invoice/invoice.service'
const prisma = new PrismaClient()

// ─── Helpers ─────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, '0') }

function todayRange() {
  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { start, end }
}

async function generateCode(): Promise<string> {
  const now = new Date()
  const ds = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`
  const { start, end } = todayRange()
  const count = await (prisma as any).dentalRecord.count({
    where: { createdAt: { gte: start, lte: end } },
  })
  return `HR-${ds}-${String(count + 1).padStart(4, '0')}`
}

// ─── Queue: IN_TREATMENT patients today (for doctor) ────────

// Classification sort weight: lower = higher priority
const CLASS_WEIGHT: Record<string, number> = {
  VIP:      1,
  PRIORITY: 2,
  REGULAR:  3,
  NEW:      4,
}

export async function getTreatmentQueue(doctorId?: number) {
  const { start, end } = todayRange()
  const where: any = {
    status:    { in: ['IN_TREATMENT', 'WAITING'] },
    arrivedAt: { gte: start, lte: end },
  }
  if (doctorId) where.doctorId = doctorId

  const rows = await (prisma as any).reception.findMany({
    where,
    include: {
      patient: {
        select: {
          id: true, code: true, fullName: true, phone: true,
          classification: true, allergies: true, systemicDiseases: true,
          dentalAnxietyLevel: true, toothChart: true,
        },
      },
      doctor:  { select: { id: true, fullName: true } },
      chair:   { select: { id: true, name: true, number: true } },
      dentalRecord: {
        select: { id: true, code: true, status: true, icd10Code: true, icd10Description: true },
      },
    },
    orderBy: [{ arrivedAt: 'asc' }],
  })

  // Sort: IN_TREATMENT first → classification (VIP>PRIORITY>REGULAR>NEW) → arrivedAt
  return rows.sort((a: any, b: any) => {
    // 1. Bệnh nhân đang điều trị lên đầu
    const statusA = a.status === 'IN_TREATMENT' ? 0 : 1
    const statusB = b.status === 'IN_TREATMENT' ? 0 : 1
    if (statusA !== statusB) return statusA - statusB

    // 2. Phân loại bệnh nhân: VIP > PRIORITY > REGULAR > NEW
    const clsA = CLASS_WEIGHT[a.patient?.classification] ?? 5
    const clsB = CLASS_WEIGHT[b.patient?.classification] ?? 5
    if (clsA !== clsB) return clsA - clsB

    // 3. Số thứ tự (queuePosition) nếu có, rồi arrivedAt
    const posA = a.queuePosition ?? 9999
    const posB = b.queuePosition ?? 9999
    if (posA !== posB) return posA - posB

    return new Date(a.arrivedAt).getTime() - new Date(b.arrivedAt).getTime()
  })
}

// ─── Get or create draft record ──────────────────────────────

export async function getOrCreateDraft(receptionId: number, doctorId: number) {
  const reception = await (prisma as any).reception.findUnique({
    where: { id: receptionId },
    include: {
      patient: true,
      dentalRecord: { include: { services: { include: { service: true } } } },
    },
  })
  if (!reception) return { notFound: true }

  // If already has a record → return it
  if (reception.dentalRecord) return { record: reception.dentalRecord }

  // Create new draft
  const code   = await generateCode()
  const record = await (prisma as any).dentalRecord.create({
    data: {
      code,
      receptionId,
      patientId:  reception.patientId,
      doctorId,
      visitReason: reception.visitReason ?? null,
      status: 'DRAFT',
    },
    include: { services: { include: { service: true } } },
  })
  return { record }
}

// ─── Get single record ────────────────────────────────────────

export async function getRecord(id: number) {
  return (prisma as any).dentalRecord.findUnique({
    where: { id },
    include: {
      patient:   { select: { id: true, code: true, fullName: true, allergies: true, systemicDiseases: true, toothChart: true, dentalAnxietyLevel: true, classification: true } },
      doctor:    { select: { id: true, fullName: true } },
      reception: { select: { id: true, code: true, status: true, chair: true, doctor: true } },
      services:  {
        include: {
          service: { select: { id: true, name: true, code: true } },
        },
      },
    },
  })
}

// ─── Save draft ───────────────────────────────────────────────

export interface SaveDraftData {
  visitReason?:      string
  symptoms?:         string
  icd10Code?:        string
  icd10Description?: string
  clinicalNotes?:    string
  aftercareNotes?:   string
  followUpDate?:     string | null
  toothChart?:       Record<string, any> | null
  services?: Array<{
    id?:         number   // existing service item id (for update)
    serviceId:   number
    toothNumber: string
    unitPrice:   number
    quantity:    number
    note?:       string
  }>
}

export async function saveDraft(id: number, data: SaveDraftData, doctorId: number) {
  const existing = await (prisma as any).dentalRecord.findUnique({
    where: { id },
    include: { reception: { select: { patientId: true } } },
  })
  if (!existing) return { notFound: true }
  if (existing.status === 'SIGNED') return { alreadySigned: true }

  const recordData: any = {}
  if (data.visitReason      !== undefined) recordData.visitReason      = data.visitReason
  if (data.symptoms         !== undefined) recordData.symptoms         = data.symptoms
  if (data.icd10Code        !== undefined) recordData.icd10Code        = data.icd10Code
  if (data.icd10Description !== undefined) recordData.icd10Description = data.icd10Description
  if (data.clinicalNotes    !== undefined) recordData.clinicalNotes    = data.clinicalNotes
  if (data.aftercareNotes   !== undefined) recordData.aftercareNotes   = data.aftercareNotes
  if ('followUpDate' in data) recordData.followUpDate = data.followUpDate ? new Date(data.followUpDate) : null

  // Update services if provided
  if (data.services !== undefined) {
    // Delete all existing services, re-create
    await (prisma as any).dentalRecordService.deleteMany({ where: { recordId: id } })
    if (data.services.length > 0) {
      await (prisma as any).dentalRecordService.createMany({
        data: data.services.map(s => ({
          recordId:   id,
          serviceId:  s.serviceId,
          toothNumber:s.toothNumber,
          unitPrice:  s.unitPrice,
          quantity:   s.quantity,
          note:       s.note ?? null,
        })),
      })
    }
  }

  // Update toothChart on patient if provided
  if (data.toothChart !== undefined) {
    await (prisma as any).patient.update({
      where: { id: existing.reception.patientId },
      data:  { toothChart: data.toothChart },
    })
  }

  const updated = await (prisma as any).dentalRecord.update({
    where: { id },
    data:  recordData,
    include: { services: { include: { service: { select: { id: true, name: true } } } } },
  })

  return { record: updated }
}

// ─── Sign & finalize ──────────────────────────────────────────

export async function signRecord(id: number, doctorId: number) {
  const record = await (prisma as any).dentalRecord.findUnique({
    where: { id },
    include: {
      services: true,
      reception: { select: { id: true, patientId: true } },
      patient:  { select: { fullName: true, code: true } },
    },
  })
  if (!record)                        return { notFound: true }
  if (record.status === 'SIGNED')     return { alreadySigned: true }
  if (!record.icd10Code)              return { validationError: 'Chưa có chẩn đoán ICD-10' }

  const now = new Date()
  const signed = await (prisma as any).dentalRecord.update({
    where: { id },
    data:  { status: 'SIGNED', signedAt: now },
    include: { services: { include: { service: { select: { id: true, name: true } } } } },
  })

  // Update reception → WAITING_PAYMENT
  await (prisma as any).reception.update({
    where: { id: record.reception.id },
    data:  { status: 'WAITING_PAYMENT', endAt: now },
  })

  // Auto-create invoice from signed services
  try {
    await autoCreateInvoice({
      dentalRecordId: id,
      receptionId:    record.reception.id,
      patientId:      record.reception.patientId,
      doctorId,
      services: record.services.map((s: any) => ({
        serviceId:   s.serviceId,
        serviceName: s.service?.name ?? `Dịch vụ #${s.serviceId}`,
        toothNumber: s.toothNumber ?? null,
        unitPrice:   s.unitPrice,
        quantity:    s.quantity,
        note:        s.note ?? null,
      })),
    })
  } catch (e) {
    console.error('[signRecord] autoCreateInvoice failed:', e)
  }

  // Log
  const totalAmt = record.services.reduce((s: number, sv: any) => s + sv.unitPrice * sv.quantity, 0)
  await (prisma as any).systemLog.create({
    data: {
      userId: doctorId,
      module: 'TREATMENT',
      action: 'SIGN_RECORD',
      detail: `Ký số hồ sơ ${record.code} – BN ${record.patient.fullName} · ICD-10: ${record.icd10Code} · Tổng: ${totalAmt.toLocaleString('vi-VN')}đ`,
      status: 'SUCCESS',
    },
  })

  return { record: signed }
}

// ─── Patient treatment history ────────────────────────────────

export async function getPatientHistory(patientId: number) {
  return (prisma as any).dentalRecord.findMany({
    where: { patientId },
    include: {
      doctor:   { select: { fullName: true } },
      services: { include: { service: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take:    30,
  })
}

// ─── Available services (for doctor to pick) ─────────────────

export async function getActiveServices() {
  const services = await prisma.service.findMany({
    where:   { status: 'ACTIVE' },
    include: {
      servicePrices: {
        where:   { endDate: null },   // current price (no end date = active)
        orderBy: { startDate: 'desc' },
        take:    1,
        select:  { basePrice: true, discountPct: true },
      },
      serviceGroup: { select: { name: true } },
    },
    orderBy: [{ serviceGroup: { name: 'asc' } }, { name: 'asc' }],
  })

  return services.map((s: any) => {
    const price = s.servicePrices[0]
    const basePrice  = price?.basePrice  ?? 0
    const discountPct = price?.discountPct ?? 0
    const unitPrice = Math.round(basePrice * (1 - discountPct / 100))
    return {
      id:        s.id,
      code:      s.code,
      name:      s.name,
      group:     s.serviceGroup.name,
      unitPrice,
    }
  })
}
