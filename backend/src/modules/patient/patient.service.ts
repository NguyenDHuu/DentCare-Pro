import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Helpers ─────────────────────────────────────────────────

async function generateCode(now: Date): Promise<string> {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const start = new Date(now); start.setHours(0, 0, 0, 0)
  const end   = new Date(now); end.setHours(23, 59, 59, 999)
  const count = await (prisma as any).patient.count({ where: { createdAt: { gte: start, lte: end } } })
  return `BN-${y}${m}${d}-${String(count + 1).padStart(4, '0')}`
}

// ─── CN3.1 – Tạo bệnh nhân mới ───────────────────────────────

export interface CreatePatientInput {
  fullName: string
  dateOfBirth: string
  gender: string        // NAM | NU
  phone: string
  nationalId?: string
  bhytCode?: string
  address?: string
  occupation?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  adminNote?: string
  appointmentId?: number  // A3: link appointment
}

export const createPatient = async (data: CreatePatientInput, createdBy: number) => {
  // A1: Check duplicate nationalId
  if (data.nationalId) {
    const dup = await (prisma as any).patient.findFirst({
      where: { nationalId: data.nationalId },
      select: { id: true, code: true, fullName: true, phone: true, isActive: true },
    })
    if (dup) return { duplicate: { type: 'NATIONAL_ID', patient: dup } }
  }

  // A1: Check duplicate phone
  const dupPhone = await (prisma as any).patient.findFirst({
    where: { phone: data.phone },
    select: { id: true, code: true, fullName: true, phone: true, isActive: true },
  })
  if (dupPhone) return { duplicate: { type: 'PHONE', patient: dupPhone } }

  const now = new Date()
  const code = await generateCode(now)

  const patient = await (prisma as any).patient.create({
    data: {
      code,
      fullName:              data.fullName.trim(),
      dateOfBirth:           new Date(data.dateOfBirth),
      gender:                data.gender,
      phone:                 data.phone.trim(),
      nationalId:            data.nationalId?.trim()            || null,
      bhytCode:              data.bhytCode?.trim()              || null,
      address:               data.address?.trim()               || null,
      occupation:            data.occupation?.trim()            || null,
      emergencyContactName:  data.emergencyContactName?.trim()  || null,
      emergencyContactPhone: data.emergencyContactPhone?.trim() || null,
      adminNote:             data.adminNote?.trim()             || null,
      classification:        'NEW',
      isComplete:            !!data.nationalId,
      createdBy,
    },
  })

  // A3: Link appointment
  if (data.appointmentId) {
    await (prisma as any).appointment.update({
      where: { id: data.appointmentId },
      data:  { patientId: patient.id },
    })
  }

  await prisma.systemLog.create({
    data: {
      userId: createdBy, action: 'CREATE', module: 'PATIENT', status: 'SUCCESS',
      detail: `Tạo hồ sơ bệnh nhân: ${code} – ${patient.fullName}`,
    },
  })

  return { patient }
}

// ─── CN3.2 – Cập nhật bệnh nhân ──────────────────────────────

export interface UpdatePatientInput {
  fullName?: string
  dateOfBirth?: string
  gender?: string
  phone?: string
  nationalId?: string
  bhytCode?: string
  address?: string
  occupation?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  adminNote?: string
  classification?: string
  // Medical fields — doctor/admin only
  allergies?: string | null
  systemicDiseases?: string | null
  dentalAnxietyLevel?: string | null
  internalNote?: string | null
  toothChart?: Record<string, { status: string; notes?: string }> | null
}

export const updatePatient = async (id: number, data: UpdatePatientInput, userId: number) => {
  const existing = await (prisma as any).patient.findUnique({ where: { id } })
  if (!existing) return { notFound: true }

  // Check duplicate nationalId for another patient
  if (data.nationalId && data.nationalId !== existing.nationalId) {
    const dup = await (prisma as any).patient.findFirst({
      where: { nationalId: data.nationalId, id: { not: id } },
      select: { id: true, code: true, fullName: true },
    })
    if (dup) return { duplicate: { type: 'NATIONAL_ID', patient: dup } }
  }

  // Check duplicate phone for another patient
  if (data.phone && data.phone !== existing.phone) {
    const dup = await (prisma as any).patient.findFirst({
      where: { phone: data.phone, id: { not: id } },
      select: { id: true, code: true, fullName: true },
    })
    if (dup) return { duplicate: { type: 'PHONE', patient: dup } }
  }

  // Build audit diff
  const LABELS: Record<string, string> = {
    fullName: 'Họ tên', dateOfBirth: 'Ngày sinh', gender: 'Giới tính',
    phone: 'Số điện thoại', nationalId: 'CCCD', bhytCode: 'Mã BHYT',
    address: 'Địa chỉ', occupation: 'Nghề nghiệp',
    emergencyContactName: 'Người liên hệ', emergencyContactPhone: 'SĐT liên hệ',
    adminNote: 'Ghi chú', classification: 'Phân loại',
  }
  const changes: string[] = []
  for (const [key, label] of Object.entries(LABELS)) {
    const newVal = (data as any)[key]
    if (newVal === undefined) continue
    const oldVal = existing[key]
    const oldStr = oldVal instanceof Date ? oldVal.toISOString().slice(0, 10) : String(oldVal ?? '')
    const newStr = newVal instanceof Date ? newVal.toISOString().slice(0, 10) : String(newVal ?? '')
    if (oldStr !== newStr) changes.push(`${label}: "${oldStr}" → "${newStr}"`)
  }

  const updateData: any = {}
  if (data.fullName   !== undefined) updateData.fullName    = data.fullName.trim()
  if (data.dateOfBirth !== undefined) updateData.dateOfBirth = new Date(data.dateOfBirth)
  if (data.gender     !== undefined) updateData.gender      = data.gender
  if (data.phone      !== undefined) updateData.phone       = data.phone.trim()
  if ('nationalId'    in data)       updateData.nationalId  = data.nationalId?.trim() || null
  if ('bhytCode'      in data)       updateData.bhytCode    = data.bhytCode?.trim()   || null
  if ('address'       in data)       updateData.address     = data.address?.trim()    || null
  if ('occupation'    in data)       updateData.occupation  = data.occupation?.trim() || null
  if ('emergencyContactName'  in data) updateData.emergencyContactName  = data.emergencyContactName?.trim()  || null
  if ('emergencyContactPhone' in data) updateData.emergencyContactPhone = data.emergencyContactPhone?.trim() || null
  if ('adminNote'     in data)       updateData.adminNote   = data.adminNote?.trim()  || null
  if (data.classification !== undefined) updateData.classification = data.classification
  // Medical fields
  if ('allergies'          in data) updateData.allergies          = data.allergies          ?? null
  if ('systemicDiseases'   in data) updateData.systemicDiseases   = data.systemicDiseases   ?? null
  if ('dentalAnxietyLevel' in data) updateData.dentalAnxietyLevel = data.dentalAnxietyLevel ?? null
  if ('internalNote'       in data) updateData.internalNote       = data.internalNote       ?? null
  if ('toothChart'         in data) updateData.toothChart         = data.toothChart         ?? null

  // isComplete based on nationalId after update
  const finalNationalId = 'nationalId' in updateData ? updateData.nationalId : existing.nationalId
  updateData.isComplete = !!finalNationalId

  const patient = await (prisma as any).patient.update({ where: { id }, data: updateData })

  if (changes.length > 0) {
    await prisma.systemLog.create({
      data: {
        userId, action: 'UPDATE', module: 'PATIENT', status: 'SUCCESS',
        detail: `Cập nhật hồ sơ ${existing.code}: ${changes.join('; ')}`,
      },
    })
  }

  return { patient }
}

// ─── CN3.3 – Tìm kiếm bệnh nhân ──────────────────────────────

export interface ListPatientsParams {
  q?: string
  page?: number
  limit?: number
  includeInactive?: boolean
}

export const listPatients = async (params: ListPatientsParams) => {
  const { q = '', page = 1, limit = 20, includeInactive = false } = params
  const skip = (page - 1) * limit
  const query = q.trim()

  const where: any = {}
  if (!includeInactive) where.isActive = true

  if (query.length >= 2) {
    where.OR = [
      { code:       { contains: query } },
      { fullName:   { contains: query } },
      { phone:      { contains: query } },
      { nationalId: { contains: query } },
    ]
    // Support searching by last 4+ digits of phone
    if (/^\d{4,}$/.test(query)) {
      where.OR.push({ phone: { endsWith: query } })
    }
  }

  const [patients, total] = await Promise.all([
    (prisma as any).patient.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, code: true, fullName: true, dateOfBirth: true,
        gender: true, phone: true, nationalId: true, classification: true,
        isComplete: true, isActive: true, createdAt: true,
        appointments: {
          where:   { status: { in: ['COMPLETED', 'CHECKED_IN', 'IN_PROGRESS'] } },
          orderBy: { appointmentDate: 'desc' },
          take:    1,
          select:  { appointmentDate: true, status: true },
        },
      },
    }),
    (prisma as any).patient.count({ where }),
  ])

  // A4: Look for appointments without a patient profile
  // - If query looks like phone number → filter by phone
  // - If no query (default load) → return all unlinked appointments so user can see them
  let appointmentHits: any[] = []
  const digits = query.replace(/\D/g, '')
  if (query.length >= 2 && /^\d{7,}$/.test(digits)) {
    // Search by phone
    appointmentHits = await prisma.appointment.findMany({
      where:  { patientId: null, patientPhone: { contains: digits } },
      select: { id: true, code: true, patientName: true, patientPhone: true, patientDob: true, patientGender: true, appointmentDate: true },
      take:   5,
      orderBy: { createdAt: 'desc' },
    })
  } else if (query.length >= 2) {
    // Search by name
    appointmentHits = await prisma.appointment.findMany({
      where:  { patientId: null, patientName: { contains: query } },
      select: { id: true, code: true, patientName: true, patientPhone: true, patientDob: true, patientGender: true, appointmentDate: true },
      take:   5,
      orderBy: { createdAt: 'desc' },
    })
  } else {
    // Default load: show all unlinked appointments (so users know they exist)
    appointmentHits = await prisma.appointment.findMany({
      where:   { patientId: null },
      select:  { id: true, code: true, patientName: true, patientPhone: true, patientDob: true, patientGender: true, appointmentDate: true },
      take:    10,
      orderBy: { createdAt: 'desc' },
    })
  }

  const result = patients.map((p: any) => ({
    ...p,
    lastVisit: p.appointments[0]?.appointmentDate ?? null,
    appointments: undefined,
  }))

  return { patients: result, total, page, limit, totalPages: Math.ceil(total / limit), appointmentHits }
}

// ─── Lấy chi tiết bệnh nhân ───────────────────────────────────

export const getPatient = async (id: number) => {
  const patient = await (prisma as any).patient.findUnique({
    where: { id },
    include: {
      appointments: {
        orderBy: { appointmentDate: 'desc' },
        take: 20,
        select: {
          id: true, code: true, appointmentDate: true, status: true,
          doctor:  { select: { fullName: true } },
          service: { select: { name: true } },
        },
      },
    },
  })
  return patient
}

// ─── Lịch hẹn của bệnh nhân (theo patientId + phone fallback) ──

export const getPatientAppointments = async (id: number) => {
  const patient = await (prisma as any).patient.findUnique({
    where: { id },
    select: { phone: true },
  })
  if (!patient) return null

  return prisma.appointment.findMany({
    where: {
      OR: [
        { patientId: id },
        { patientPhone: patient.phone, patientId: null },
      ],
    },
    orderBy: { appointmentDate: 'desc' },
    take:    50,
    select: {
      id: true, code: true, appointmentDate: true, status: true,
      note: true,
      doctor:  { select: { fullName: true } },
      service: { select: { name: true } },
    },
  })
}

// ─── Vô hiệu hóa hồ sơ (không xóa cứng) ─────────────────────

export const deactivatePatient = async (id: number, userId: number) => {
  const existing = await (prisma as any).patient.findUnique({ where: { id }, select: { code: true, fullName: true, isActive: true } })
  if (!existing) return { notFound: true }
  if (!existing.isActive) return { alreadyInactive: true }

  await (prisma as any).patient.update({ where: { id }, data: { isActive: false } })
  await prisma.systemLog.create({
    data: {
      userId, action: 'DEACTIVATE', module: 'PATIENT', status: 'SUCCESS',
      detail: `Vô hiệu hóa hồ sơ ${existing.code} – ${existing.fullName}`,
    },
  })
  return { success: true }
}
