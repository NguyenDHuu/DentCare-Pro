import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// ─── Constants ────────────────────────────────────────────────

export const VISIT_REASON_META: Record<string, { label: string; needsChair: boolean }> = {
  NEW_EXAM:      { label: 'Khám mới',                 needsChair: true  },
  REVISIT:       { label: 'Tái khám',                  needsChair: true  },
  TREATMENT:     { label: 'Điều trị theo kế hoạch',    needsChair: true  },
  SCALING:       { label: 'Cạo vôi răng',              needsChair: true  },
  BRACES:        { label: 'Niềng răng',                needsChair: true  },
  WHITENING:     { label: 'Tẩy trắng răng',            needsChair: true  },
  PAYMENT:       { label: 'Thanh toán công nợ',        needsChair: false },
  PICKUP:        { label: 'Lấy hồ sơ',                 needsChair: false },
  CONSULTATION:  { label: 'Tư vấn',                    needsChair: false },
  OTHER:         { label: 'Khác',                      needsChair: false },
}

export const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  WAITING:           { label: 'Chờ vào ghế',      color: '#d97706', bg: '#fffbeb' },
  IN_TREATMENT:      { label: 'Đang điều trị',     color: '#7c3aed', bg: '#f5f3ff' },
  WAITING_PAYMENT:   { label: 'Chờ thanh toán',    color: '#0891b2', bg: '#ecfeff' },
  COMPLETED:         { label: 'Hoàn tất',          color: '#059669', bg: '#ecfdf5' },
  CONSULTATION_ONLY: { label: 'Chỉ tư vấn',        color: '#2563eb', bg: '#eff6ff' },
  ABSENT:            { label: 'Vắng mặt',           color: '#6b7280', bg: '#f3f4f6' },
  CANCELLED:         { label: 'Đã hủy',            color: '#dc2626', bg: '#fff1f2' },
}

// Active statuses (still in clinic)
const ACTIVE_STATUSES = ['WAITING', 'IN_TREATMENT', 'WAITING_PAYMENT']

// Priority map per patient classification
const CLASSIFICATION_PRIORITY: Record<string, number> = {
  SPECIAL:   3,
  VIP:       4,
  RETURNING: 5,
  NEW:       5,
}

// ─── Helpers ──────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, '0') }

function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
}

function todayRange() {
  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { start, end }
}

// ─── Code generation ──────────────────────────────────────────

export async function generateCode(): Promise<string> {
  const dateStr = localDateStr()
  const { start, end } = todayRange()
  const count = await (prisma as any).reception.count({
    where: { createdAt: { gte: start, lte: end } },
  })
  return `TD-${dateStr}-${String(count + 1).padStart(4, '0')}`
}

// ─── Queue & Chairs ───────────────────────────────────────────

export async function getTodayQueue() {
  const { start, end } = todayRange()

  const receptions = await (prisma as any).reception.findMany({
    where: {
      arrivedAt: { gte: start, lte: end },
    },
    include: {
      patient:      { select: { id: true, code: true, fullName: true, phone: true, classification: true, allergies: true, systemicDiseases: true } },
      appointment:  { select: { id: true, code: true, service: { select: { name: true } } } },
      receptionist: { select: { id: true, fullName: true } },
      doctor:       { select: { id: true, fullName: true } },
      chair:        { select: { id: true, name: true, number: true } },
    },
    orderBy: [
      { queuePriority: 'asc' },
      { arrivedAt: 'asc' },
    ],
  })

  const chairs = await getChairStatus()
  const stats  = computeStats(receptions)

  return { queue: receptions, chairs, stats }
}

export async function getChairStatus() {
  const chairs = await (prisma as any).dentalChair.findMany({
    where: { isActive: true },
    orderBy: { number: 'asc' },
  })

  // For each chair, find the active reception (if any)
  // Chỉ tính WAITING – khi IN_TREATMENT thì chairId đã được clear
  const { start, end } = todayRange()
  const activeReceptions = await (prisma as any).reception.findMany({
    where: {
      chairId:  { not: null },
      status:   'WAITING',
      arrivedAt:{ gte: start, lte: end },
    },
    include: {
      patient: { select: { fullName: true } },
      doctor:  { select: { fullName: true } },
    },
  })

  return chairs.map((ch: any) => {
    const rec = activeReceptions.find((r: any) => r.chairId === ch.id)
    return {
      ...ch,
      status: rec ? (rec.status === 'IN_TREATMENT' ? 'IN_TREATMENT' : 'ASSIGNED') : 'EMPTY',
      currentReception: rec
        ? { id: rec.id, patientName: rec.patient.fullName, doctorName: rec.doctor?.fullName ?? null, status: rec.status }
        : null,
    }
  })
}

function computeStats(receptions: any[]) {
  return {
    waiting:        receptions.filter(r => r.status === 'WAITING').length,
    inTreatment:    receptions.filter(r => r.status === 'IN_TREATMENT').length,
    waitingPayment: receptions.filter(r => r.status === 'WAITING_PAYMENT').length,
    completed:      receptions.filter(r => r.status === 'COMPLETED').length,
    total:          receptions.length,
  }
}

// ─── Search patients for check-in ─────────────────────────────

export async function searchPatientsForCheckin(q: string) {
  if (!q || q.trim().length < 2) return []
  const term = q.trim()

  const patients = await (prisma as any).patient.findMany({
    where: {
      isActive: true,
      OR: [
        { fullName: { contains: term } },
        { phone:    { contains: term } },
        { code:     { contains: term } },
      ],
    },
    select: {
      id: true, code: true, fullName: true, phone: true,
      dateOfBirth: true, gender: true, classification: true,
      allergies: true,
      appointments: {
        where: {
          appointmentDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lte: new Date(new Date().setHours(23, 59, 59, 999)),
          },
          status: { in: ['CONFIRMED', 'PENDING', 'CHECKED_IN'] },
        },
        select: {
          id: true, code: true, appointmentDate: true, status: true,
          service: { select: { name: true } },
          doctor:  { select: { id: true, fullName: true } },
        },
        orderBy: { appointmentDate: 'asc' },
        take: 1,
      },
    },
    take: 10,
  })

  // Check if patient already has an active check-in today
  const { start, end } = todayRange()
  const activeRecIds = await (prisma as any).reception.findMany({
    where: {
      patientId: { in: patients.map((p: any) => p.id) },
      status:    { in: ACTIVE_STATUSES },
      arrivedAt: { gte: start, lte: end },
    },
    select: { patientId: true, code: true, status: true },
  })
  const activeMap = new Map(activeRecIds.map((r: any) => [r.patientId, r]))

  return patients.map((p: any) => ({
    ...p,
    todayAppointment: p.appointments[0] ?? null,
    activeReception:  activeMap.get(p.id) ?? null,
  }))
}

// ─── Get available doctors ─────────────────────────────────────

export async function getAvailableDoctors() {
  const { start, end } = todayRange()

  // Doctors with schedule today
  const schedules = await (prisma as any).doctorSchedule.findMany({
    where: { workDate: { gte: start, lte: end } },
    include: { doctor: { select: { id: true, fullName: true } } },
  })
  const scheduled  = schedules.map((s: any) => s.doctor)
  const uniqueMap  = new Map(scheduled.map((d: any) => [d.id, d]))

  // Also get all active doctors (for unscheduled days)
  const allDoctors = await (prisma as any).user.findMany({
    where: {
      isActive: true,
      roles: { some: { role: { name: 'DOCTOR' } } },
    },
    select: { id: true, fullName: true },
    orderBy: { fullName: 'asc' },
  })

  // Mark as scheduled or not
  return allDoctors.map((d: any) => ({
    ...d,
    isScheduledToday: uniqueMap.has(d.id),
  }))
}

// ─── Schedule matching helper ─────────────────────────────────
/**
 * Tìm doctorschedule phù hợp cho bác sĩ tại thời điểm arrivedAt
 * Khớp theo: doctorId + ngày VN (UTC+7) + time range của ca
 * Fallback: bất kỳ ca nào cùng ngày VN (chọn ca gần nhất)
 */
async function findScheduleId(doctorId: number, arrivedAtUtc: Date): Promise<number | null> {
  // Exact match: time falls within shift hours
  const exact = await (prisma as any).$queryRawUnsafe(`
    SELECT ds.id
    FROM doctorschedule ds
    JOIN workshift ws ON ws.id = ds.shiftId
    WHERE ds.doctorId = ${doctorId}
      AND DATE(ADDTIME(ds.workDate, '07:00:00')) = DATE(ADDTIME('${arrivedAtUtc.toISOString().replace('T', ' ').slice(0, 19)}', '07:00:00'))
      AND TIME(ADDTIME('${arrivedAtUtc.toISOString().replace('T', ' ').slice(0, 19)}', '07:00:00')) BETWEEN ws.startTime AND ws.endTime
    LIMIT 1
  `)
  if (exact?.[0]) return Number(exact[0].id)

  // Fallback: any schedule same VN date (take the one with closest endTime)
  const fallback = await (prisma as any).$queryRawUnsafe(`
    SELECT ds.id
    FROM doctorschedule ds
    JOIN workshift ws ON ws.id = ds.shiftId
    WHERE ds.doctorId = ${doctorId}
      AND DATE(ADDTIME(ds.workDate, '07:00:00')) = DATE(ADDTIME('${arrivedAtUtc.toISOString().replace('T', ' ').slice(0, 19)}', '07:00:00'))
    ORDER BY ws.endTime DESC
    LIMIT 1
  `)
  return fallback?.[0] ? Number(fallback[0].id) : null
}

// ─── Check-in ─────────────────────────────────────────────────

interface CheckInData {
  patientId:     number
  appointmentId?: number
  doctorId?:     number
  chairId?:      number
  visitReason:   string
  adminNote?:    string
}

export async function checkIn(data: CheckInData, receptionistId: number) {
  const { patientId, appointmentId, doctorId, chairId, visitReason, adminNote } = data

  // E2: check active reception
  const { start, end } = todayRange()
  const existing = await (prisma as any).reception.findFirst({
    where: { patientId, status: { in: ACTIVE_STATUSES }, arrivedAt: { gte: start, lte: end } },
  })
  if (existing) return { duplicate: { reception: existing } }

  // Get patient for priority
  const patient = await (prisma as any).patient.findUnique({
    where: { id: patientId },
    select: { classification: true, allergies: true, fullName: true },
  })
  if (!patient) return { notFound: true }

  // Calculate queue priority
  let priority = CLASSIFICATION_PRIORITY[patient.classification] ?? 5
  if (appointmentId) priority = Math.min(priority, 2) // has appointment → at least priority 2

  // Queue position = count of active WAITINGs + 1
  const waitingCount = await (prisma as any).reception.count({
    where: { status: 'WAITING', arrivedAt: { gte: start, lte: end } },
  })

  const code = await generateCode()
  const now  = new Date()

  // Auto-detect scheduleId: find matching doctorschedule by time range
  const scheduleId = doctorId ? await findScheduleId(doctorId, now) : null

  const reception = await (prisma as any).reception.create({
    data: {
      code,
      patientId,
      appointmentId: appointmentId ?? null,
      receptionistId,
      doctorId:      doctorId    ?? null,
      scheduleId:    scheduleId  ?? null,
      chairId:       chairId     ?? null,
      visitReason,
      adminNote:     adminNote   ?? null,
      queuePriority: priority,
      queuePosition: waitingCount + 1,
      status: 'WAITING',
    },
    include: {
      patient:      { select: { id: true, code: true, fullName: true, classification: true } },
      doctor:       { select: { id: true, fullName: true } },
      chair:        { select: { id: true, name: true, number: true } },
      receptionist: { select: { id: true, fullName: true } },
    },
  })

  // Update appointment status → CHECKED_IN
  if (appointmentId) {
    await (prisma as any).appointment.update({
      where: { id: appointmentId },
      data:  { status: 'CHECKED_IN' },
    })
  }

  // Log
  await (prisma as any).systemLog.create({
    data: {
      userId: receptionistId,
      module: 'RECEPTION',
      action: 'CHECK_IN',
      detail: `Check-in bệnh nhân ${patient.fullName} · Mã: ${code} · Lý do: ${VISIT_REASON_META[visitReason]?.label ?? visitReason}`,
      status: 'SUCCESS',
    },
  })

  return { reception }
}

// ─── Update status ─────────────────────────────────────────────

interface UpdateStatusData {
  status:        string
  chairId?:      number | null
  doctorId?:     number | null
  cancelReason?: string
  adminNote?:    string
}

export async function updateStatus(id: number, data: UpdateStatusData, userId: number) {
  const rec = await (prisma as any).reception.findUnique({ where: { id } })
  if (!rec) return { notFound: true }

  // ── Doctor conflict: 1 bác sĩ chỉ điều trị 1 bệnh nhân tại 1 thời điểm ──
  if (data.status === 'IN_TREATMENT') {
    const effectiveDoctorId = data.doctorId !== undefined ? data.doctorId : rec.doctorId
    if (effectiveDoctorId) {
      const conflict = await (prisma as any).reception.findFirst({
        where: {
          doctorId: effectiveDoctorId,
          status:   'IN_TREATMENT',
          id:       { not: id },
        },
        include: { patient: { select: { fullName: true, code: true } } },
      })
      if (conflict) {
        return {
          conflict: `Bác sĩ đang điều trị bệnh nhân khác: ${conflict.patient.fullName} (${conflict.code}) – vui lòng chờ hoặc chọn bác sĩ khác`,
        }
      }
    }
  }

  const now = new Date()
  const updateData: any = {
    status: data.status,
    updatedAt: now,
  }

  if (data.chairId  !== undefined) updateData.chairId  = data.chairId
  if (data.doctorId !== undefined) updateData.doctorId = data.doctorId
  if (data.cancelReason)           updateData.cancelReason = data.cancelReason
  if (data.adminNote)              updateData.adminNote    = data.adminNote

  // Auto-set timing fields
  if (data.status === 'IN_TREATMENT' && !rec.seatStartAt) {
    updateData.seatStartAt = now
  }
  if (['COMPLETED', 'CONSULTATION_ONLY', 'ABSENT', 'CANCELLED', 'WAITING_PAYMENT'].includes(data.status) && !rec.endAt) {
    updateData.endAt = now
  }

  // Khi vào điều trị → ghế trống ngay (bệnh nhân đã vào phòng)
  if (data.status === 'IN_TREATMENT') {
    updateData.chairId = null
  }

  const updated = await (prisma as any).reception.update({
    where: { id },
    data:  updateData,
    include: {
      patient:      { select: { id: true, code: true, fullName: true, classification: true } },
      doctor:       { select: { id: true, fullName: true } },
      chair:        { select: { id: true, name: true, number: true } },
      receptionist: { select: { id: true, fullName: true } },
    },
  })

  await (prisma as any).systemLog.create({
    data: {
      userId,
      module: 'RECEPTION',
      action: 'UPDATE_STATUS',
      detail: `Cập nhật trạng thái tiếp đón ${updated.code}: ${STATUS_META[rec.status]?.label ?? rec.status} → ${STATUS_META[data.status]?.label ?? data.status}`,
      status: 'SUCCESS',
    },
  })

  return { reception: updated }
}

// ─── Assign chair / doctor ─────────────────────────────────────

export async function assignResources(id: number, chairId: number | null, doctorId: number | null, userId: number) {
  const rec = await (prisma as any).reception.findUnique({ where: { id } })
  if (!rec) return { notFound: true }

  const effectiveDoctorId = doctorId ?? rec.doctorId

  // Re-calculate scheduleId if doctor changed
  let scheduleId = rec.scheduleId
  if (doctorId !== null && doctorId !== rec.doctorId && effectiveDoctorId) {
    const arrivedAt = rec.arrivedAt instanceof Date ? rec.arrivedAt : new Date(rec.arrivedAt)
    scheduleId = await findScheduleId(effectiveDoctorId, arrivedAt)
  }

  const updated = await (prisma as any).reception.update({
    where: { id },
    data: {
      chairId:    chairId    ?? rec.chairId,
      doctorId:   effectiveDoctorId,
      scheduleId: scheduleId ?? null,
    },
    include: {
      patient:      { select: { id: true, fullName: true } },
      doctor:       { select: { id: true, fullName: true } },
      chair:        { select: { id: true, name: true, number: true } },
      receptionist: { select: { id: true, fullName: true } },
    },
  })

  return { reception: updated }
}

// ─── Classification change (UC3.6) ────────────────────────────

export async function changeClassification(
  patientId: number,
  newClass:  string,
  reason:    string,
  userId:    number,
  userRole:  string,
) {
  const patient = await (prisma as any).patient.findUnique({
    where: { id: patientId },
    select: { classification: true, fullName: true },
  })
  if (!patient) return { notFound: true }

  // Permission rules
  if (newClass === 'VIP' && !['ADMIN'].includes(userRole)) {
    return { forbidden: 'Chỉ Admin mới có thể gán nhãn VIP' }
  }
  if (newClass === 'SPECIAL' && !['ADMIN', 'DOCTOR'].includes(userRole)) {
    return { forbidden: 'Chỉ Admin hoặc Bác sĩ mới có thể gán nhãn Theo dõi đặc biệt' }
  }
  if (!reason && ['VIP', 'SPECIAL'].includes(newClass)) {
    return { validationError: 'Cần nhập lý do khi gán nhãn VIP hoặc Theo dõi đặc biệt' }
  }

  const oldClass = patient.classification

  await (prisma as any).patient.update({
    where: { id: patientId },
    data:  { classification: newClass },
  })

  await (prisma as any).systemLog.create({
    data: {
      userId,
      module: 'PATIENT',
      action: 'CHANGE_CLASSIFICATION',
      detail: JSON.stringify({
        patientId,
        patientName: patient.fullName,
        oldClass,
        newClass,
        reason,
        changedByRole: userRole,
      }),
      status: 'SUCCESS',
    },
  })

  const updated = await (prisma as any).patient.findUnique({ where: { id: patientId } })
  return { patient: updated }
}

// ─── Get single reception ──────────────────────────────────────

export async function getReception(id: number) {
  return (prisma as any).reception.findUnique({
    where: { id },
    include: {
      patient:      { select: { id: true, code: true, fullName: true, phone: true, classification: true, allergies: true } },
      appointment:  { select: { id: true, code: true, service: { select: { name: true } } } },
      doctor:       { select: { id: true, fullName: true } },
      chair:        { select: { id: true, name: true, number: true } },
      receptionist: { select: { id: true, fullName: true } },
    },
  })
}

// ─── Patient reception history ─────────────────────────────────

export async function getPatientReceptionHistory(patientId: number) {
  return (prisma as any).reception.findMany({
    where: { patientId },
    include: {
      appointment:  { select: { code: true, service: { select: { name: true } } } },
      doctor:       { select: { fullName: true } },
      chair:        { select: { name: true, number: true } },
      receptionist: { select: { fullName: true } },
    },
    orderBy: { arrivedAt: 'desc' },
    take: 50,
  })
}
