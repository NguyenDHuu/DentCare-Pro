import { PrismaClient } from '@prisma/client'
import { logAction } from '../../utils/logger'

const prisma = new PrismaClient()

// ─── Helpers ─────────────────────────────────────────────────

function getStatus(startDate: Date, endDate: Date | null): string {
  const now = new Date()
  if (startDate > now)            return 'UPCOMING'
  if (!endDate || endDate >= now) return 'ACTIVE'
  return 'EXPIRED'
}

function fmtDate(d: Date) { return d.toLocaleDateString('vi-VN') }

// ─── Hourly Rate  (raw SQL — model may not be in generated client) ────

export const getHourlyRates = async () => {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT hr.id, hr.amount, hr.startDate, hr.endDate, hr.createdAt,
           u.fullName AS creatorName
    FROM   hourlyrate hr
    LEFT JOIN \`user\` u ON u.id = hr.createdBy
    ORDER BY hr.startDate DESC
  `
  return rows.map(r => ({
    id:        Number(r.id),
    amount:    Number(r.amount),
    startDate: r.startDate,
    endDate:   r.endDate ?? null,
    status:    getStatus(new Date(r.startDate), r.endDate ? new Date(r.endDate) : null),
    createdAt: r.createdAt,
    createdBy: r.creatorName ?? null,
  }))
}

export const getCurrentHourlyRate = async () => {
  const now = new Date()
  const rows = await prisma.$queryRaw<any[]>`
    SELECT id, amount, startDate
    FROM   hourlyrate
    WHERE  startDate <= ${now}
      AND  (endDate IS NULL OR endDate >= ${now})
    ORDER BY startDate DESC
    LIMIT 1
  `
  if (!rows.length) return null
  return { amount: Number(rows[0].amount), startDate: rows[0].startDate }
}

export const createHourlyRate = async (
  data: { amount: number; startDate: string; endDate?: string },
  adminId: number,
  ip: string,
) => {
  if (!data.amount || data.amount <= 0)
    throw { status: 400, message: 'Số tiền một giờ phải lớn hơn 0' }

  const startDate = new Date(data.startDate)
  const endDate   = data.endDate ? new Date(data.endDate) : null

  if (isNaN(startDate.getTime()))
    throw { status: 400, message: 'Ngày bắt đầu không hợp lệ' }
  if (endDate && endDate <= startDate)
    throw { status: 400, message: 'Ngày kết thúc phải sau ngày bắt đầu' }

  // Overlap check
  let overlapRows: any[]
  if (endDate) {
    overlapRows = await prisma.$queryRaw<any[]>`
      SELECT id, startDate, endDate FROM hourlyrate
      WHERE (endDate IS NULL OR endDate > ${startDate})
        AND startDate < ${endDate}
    `
  } else {
    overlapRows = await prisma.$queryRaw<any[]>`
      SELECT id, startDate, endDate FROM hourlyrate
      WHERE (endDate IS NULL OR endDate > ${startDate})
    `
  }

  if (overlapRows.length > 0) {
    const o    = overlapRows[0]
    const from = fmtDate(new Date(o.startDate))
    const to   = o.endDate ? fmtDate(new Date(o.endDate)) : 'không giới hạn'
    throw { status: 409, message: `Xung đột thời gian với cấu hình hiện có (${from} – ${to})` }
  }

  await prisma.$executeRaw`
    INSERT INTO hourlyrate (amount, startDate, endDate, createdBy, createdAt, updatedAt)
    VALUES (${data.amount}, ${startDate}, ${endDate}, ${adminId}, NOW(), NOW())
  `

  await logAction(
    'CREATE_HOURLY_RATE',
    `Thiết lập đơn giá giờ: ${data.amount.toLocaleString('vi-VN')}đ/giờ (từ ${fmtDate(startDate)})`,
    adminId, ip,
  )

  return { ok: true }
}

// ─── Eligible Staff ───────────────────────────────────────────

export const getEligibleStaff = async () => {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT u.id, u.fullName, r.name AS roleName
    FROM   \`user\` u
    JOIN   userrole ur ON ur.userId = u.id
    JOIN   role     r  ON r.id      = ur.roleId
    WHERE  u.isActive = 1
      AND  r.name IN ('RECEPTIONIST', 'ACCOUNTANT')
    ORDER BY u.fullName ASC
  `
  return rows.map(r => ({
    id:       Number(r.id),
    fullName: r.fullName,
    role:     r.roleName,
  }))
}

// ─── Fixed Salary (per user) ──────────────────────────────────

export const getFixedSalaries = async () => {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT fs.id, fs.userId, fs.amount, fs.startDate, fs.endDate, fs.createdAt,
           u.fullName,
           r.name  AS roleName,
           c.fullName AS creatorName
    FROM   fixedsalary fs
    JOIN   \`user\`  u  ON u.id  = fs.userId
    JOIN   userrole ur  ON ur.userId = fs.userId
    JOIN   role     r   ON r.id     = ur.roleId
    LEFT JOIN \`user\` c ON c.id  = fs.createdBy
    WHERE  r.name IN ('RECEPTIONIST', 'ACCOUNTANT')
    ORDER BY fs.userId ASC, fs.startDate DESC
  `
  return rows.map(r => ({
    id:        Number(r.id),
    userId:    Number(r.userId),
    fullName:  r.fullName,
    role:      r.roleName,
    amount:    Number(r.amount),
    startDate: r.startDate,
    endDate:   r.endDate ?? null,
    status:    getStatus(new Date(r.startDate), r.endDate ? new Date(r.endDate) : null),
    createdAt: r.createdAt,
    createdBy: r.creatorName ?? null,
  }))
}

export const createFixedSalary = async (
  data: { userId: number; amount: number; startDate: string; endDate?: string },
  adminId: number,
  ip: string,
) => {
  if (data.amount === undefined || data.amount < 0)
    throw { status: 400, message: 'Mức lương phải lớn hơn hoặc bằng 0' }

  // Check user exists + role
  const userRows = await prisma.$queryRaw<any[]>`
    SELECT u.fullName, r.name AS roleName
    FROM   \`user\` u
    JOIN   userrole ur ON ur.userId = u.id
    JOIN   role     r  ON r.id      = ur.roleId
    WHERE  u.id = ${data.userId}
    LIMIT 1
  `
  if (!userRows.length)
    throw { status: 404, message: 'Không tìm thấy nhân sự' }

  const { fullName, roleName } = userRows[0]
  if (!['RECEPTIONIST', 'ACCOUNTANT'].includes(roleName))
    throw { status: 400, message: 'Chỉ thiết lập lương cố định cho Lễ tân và Kế toán. Lương bác sĩ tính theo ca (UC4.4)' }

  const startDate = new Date(data.startDate)
  const endDate   = data.endDate ? new Date(data.endDate) : null

  if (isNaN(startDate.getTime()))
    throw { status: 400, message: 'Ngày bắt đầu không hợp lệ' }
  if (endDate && endDate <= startDate)
    throw { status: 400, message: 'Ngày kết thúc phải sau ngày bắt đầu' }

  // Overlap check for this user
  let overlapRows: any[]
  if (endDate) {
    overlapRows = await prisma.$queryRaw<any[]>`
      SELECT id, startDate, endDate FROM fixedsalary
      WHERE userId = ${data.userId}
        AND (endDate IS NULL OR endDate > ${startDate})
        AND startDate < ${endDate}
    `
  } else {
    overlapRows = await prisma.$queryRaw<any[]>`
      SELECT id, startDate, endDate FROM fixedsalary
      WHERE userId = ${data.userId}
        AND (endDate IS NULL OR endDate > ${startDate})
    `
  }

  if (overlapRows.length > 0) {
    const o    = overlapRows[0]
    const from = fmtDate(new Date(o.startDate))
    const to   = o.endDate ? fmtDate(new Date(o.endDate)) : 'không giới hạn'
    throw { status: 409, message: `Xung đột thời gian với cấu hình lương đã có của nhân sự này (${from} – ${to})` }
  }

  await prisma.$executeRaw`
    INSERT INTO fixedsalary (userId, amount, startDate, endDate, createdBy, createdAt, updatedAt)
    VALUES (${data.userId}, ${data.amount}, ${startDate}, ${endDate}, ${adminId}, NOW(), NOW())
  `

  await logAction(
    'CREATE_FIXED_SALARY',
    `Thiết lập lương cố định ${fullName}: ${data.amount.toLocaleString('vi-VN')}đ/tháng (từ ${fmtDate(startDate)})`,
    adminId, ip,
  )

  return { ok: true }
}

// ─── Shift Coefficient Matrix (UC4.2) ────────────────────────

/** Normalise applyDays JSON from workshift — returns 1-7 array (1=Mon, 7=Sun) */
function parseApplyDays(raw: any): number[] {
  try {
    const arr: any[] = typeof raw === 'string' ? JSON.parse(raw) : Array.isArray(raw) ? raw : []
    if (!arr.length) return [1, 2, 3, 4, 5, 6, 7]
    // If values look like 0-6 (JS weekday), shift to 1-7
    const nums = arr.map(Number).filter(n => !isNaN(n))
    if (nums.every(n => n >= 0 && n <= 6)) {
      // 0=Sun style → convert: Sun(0)→7, Mon(1)→1 … Sat(6)→6
      return nums.map(n => n === 0 ? 7 : n)
    }
    return nums  // already 1-7
  } catch { return [1, 2, 3, 4, 5, 6, 7] }
}

export const getShiftMatrix = async () => {
  const shifts = await prisma.$queryRaw<any[]>`
    SELECT id, name, startTime, endTime, applyDays
    FROM   workshift
    WHERE  isActive = 1
    ORDER BY startTime ASC
  `
  const coeffs = await prisma.$queryRaw<any[]>`
    SELECT shiftId, dayOfWeek, coefficient FROM shiftcoefficient
  `

  const coeffMap: Record<string, number> = {}
  for (const c of coeffs) {
    coeffMap[`${Number(c.shiftId)}_${Number(c.dayOfWeek)}`] = Number(c.coefficient)
  }

  return shifts.map(s => {
    const applyDays = parseApplyDays(s.applyDays)
    const type = s.startTime >= '17:30' ? 'OVERTIME' : 'STANDARD'

    const days: Record<number, number | null> = {}
    for (let d = 1; d <= 7; d++) {
      days[d] = applyDays.includes(d) ? (coeffMap[`${Number(s.id)}_${d}`] ?? 1.0) : null
    }

    return {
      id:        Number(s.id),
      name:      s.name,
      startTime: s.startTime,
      endTime:   s.endTime,
      type,
      applyDays,
      days,
    }
  })
}

export const saveShiftMatrix = async (
  items: { shiftId: number; dayOfWeek: number; coefficient: number }[],
  adminId: number,
  ip: string,
) => {
  const invalid = items.filter(i => i.coefficient < 1.0)
  if (invalid.length > 0)
    throw { status: 400, message: 'Hệ số ca làm việc phải lớn hơn hoặc bằng 1.0' }

  for (const item of items) {
    await prisma.$executeRaw`
      INSERT INTO shiftcoefficient (shiftId, dayOfWeek, coefficient, updatedBy, updatedAt)
      VALUES (${item.shiftId}, ${item.dayOfWeek}, ${item.coefficient}, ${adminId}, NOW())
      ON DUPLICATE KEY UPDATE
        coefficient = ${item.coefficient},
        updatedBy   = ${adminId},
        updatedAt   = NOW()
    `
  }

  await logAction(
    'SAVE_SHIFT_COEFFICIENTS',
    `Lưu ma trận hệ số ca làm việc (${items.length} ô)`,
    adminId, ip,
  )
  return { ok: true }
}

// ─── Monthly Salary Report (UC4.5) ───────────────────────────

export const getMonthlySalaryReport = async (month: string) => {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      p.id, p.userId, p.month, p.role,
      p.sessionCount, p.hoursWorked,
      p.salaryAmount, p.allowance, p.deduction, p.netSalary,
      p.status, p.createdAt,
      u.fullName
    FROM payslip p
    JOIN \`user\` u ON u.id = p.userId
    WHERE p.month = ${month}
    ORDER BY
      FIELD(p.role, 'DOCTOR', 'RECEPTIONIST', 'ACCOUNTANT'),
      u.fullName ASC
  `

  const ROLE_ORDER = ['DOCTOR', 'RECEPTIONIST', 'ACCOUNTANT']
  type RoleKey = 'DOCTOR' | 'RECEPTIONIST' | 'ACCOUNTANT'

  const byRole: Record<RoleKey, { count: number; total: number }> = {
    DOCTOR:       { count: 0, total: 0 },
    RECEPTIONIST: { count: 0, total: 0 },
    ACCOUNTANT:   { count: 0, total: 0 },
  }

  const mapped = rows.map(r => {
    const role = r.role as RoleKey
    if (byRole[role]) {
      byRole[role].count++
      byRole[role].total += Number(r.netSalary)
    }
    return {
      id:           Number(r.id),
      userId:       Number(r.userId),
      fullName:     r.fullName,
      role,
      sessionCount: r.sessionCount !== null ? Number(r.sessionCount) : null,
      hoursWorked:  r.hoursWorked  !== null ? Number(r.hoursWorked)  : null,
      salaryAmount: Number(r.salaryAmount),
      allowance:    Number(r.allowance),
      deduction:    Number(r.deduction),
      netSalary:    Number(r.netSalary),
      status:       r.status,
      createdAt:    r.createdAt,
    }
  })

  const totalFund = mapped.reduce((s, r) => s + r.netSalary, 0)

  return {
    month,
    totalFund,
    byRole,
    rows: mapped,
    hasDraft: mapped.some(r => r.status === 'DRAFT' || r.status === 'APPROVED'),
  }
}

// ─── Allowance (phụ cấp chung) ────────────────────────────────

const APPLIES_TO_LABEL: Record<string, string> = {
  BOTH:         'Lễ tân & Kế toán',
  RECEPTIONIST: 'Lễ tân',
  ACCOUNTANT:   'Kế toán',
}

export const getAllowances = async () => {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT a.id, a.name, a.amount, a.appliesTo, a.startDate, a.endDate, a.createdAt,
           u.fullName AS creatorName
    FROM   allowance a
    LEFT JOIN \`user\` u ON u.id = a.createdBy
    ORDER BY a.startDate DESC
  `
  return rows.map(r => ({
    id:              Number(r.id),
    name:            r.name,
    amount:          Number(r.amount),
    appliesTo:       r.appliesTo,
    appliesToLabel:  APPLIES_TO_LABEL[r.appliesTo] ?? r.appliesTo,
    startDate:       r.startDate,
    endDate:         r.endDate ?? null,
    status:          getStatus(new Date(r.startDate), r.endDate ? new Date(r.endDate) : null),
    createdAt:       r.createdAt,
    createdBy:       r.creatorName ?? null,
  }))
}

export const createAllowance = async (
  data: { name: string; amount: number; appliesTo: string; startDate: string; endDate?: string },
  adminId: number,
  ip: string,
) => {
  if (!data.name?.trim())
    throw { status: 400, message: 'Vui lòng nhập tên phụ cấp' }
  if (data.amount === undefined || data.amount < 0)
    throw { status: 400, message: 'Số tiền phụ cấp phải lớn hơn hoặc bằng 0' }
  if (!['BOTH', 'RECEPTIONIST', 'ACCOUNTANT'].includes(data.appliesTo))
    throw { status: 400, message: 'Đối tượng áp dụng không hợp lệ' }

  const startDate = new Date(data.startDate)
  const endDate   = data.endDate ? new Date(data.endDate) : null

  if (isNaN(startDate.getTime()))
    throw { status: 400, message: 'Ngày bắt đầu không hợp lệ' }
  if (endDate && endDate <= startDate)
    throw { status: 400, message: 'Ngày kết thúc phải sau ngày bắt đầu' }

  await prisma.$executeRaw`
    INSERT INTO allowance (name, amount, appliesTo, startDate, endDate, createdBy, createdAt, updatedAt)
    VALUES (${data.name.trim()}, ${data.amount}, ${data.appliesTo}, ${startDate}, ${endDate}, ${adminId}, NOW(), NOW())
  `

  await logAction(
    'CREATE_ALLOWANCE',
    `Thêm phụ cấp "${data.name.trim()}": ${data.amount.toLocaleString('vi-VN')}đ/tháng cho ${APPLIES_TO_LABEL[data.appliesTo]}`,
    adminId, ip,
  )

  return { ok: true }
}

// ─── UC4.3: Hệ số ca phức tạp ────────────────────────────────

/** Lấy danh sách bác sĩ cho filter */
export const getDoctorsForFilter = async () => {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT u.id, u.fullName, dp.degree
    FROM   \`user\` u
    JOIN   userrole ur ON ur.userId = u.id
    JOIN   role     r  ON r.id      = ur.roleId
    LEFT JOIN doctorprofile dp ON dp.userId = u.id
    WHERE  u.isActive = 1 AND r.name = 'DOCTOR'
    ORDER BY u.fullName ASC
  `
  return rows.map(r => ({ id: Number(r.id), fullName: r.fullName, degree: r.degree ?? null }))
}

/**
 * Dữ liệu UC4.3 cho Admin:
 * Nhóm theo ca trực (doctorschedule), mỗi ca gồm danh sách ca bệnh nhân (reception)
 */
export const getComplexityMatrix = async (month: string, doctorId?: number) => {
  const [yr, mo] = month.split('-').map(Number)

  // 1. Doctor schedules in the month
  const doctorFilter = doctorId ? `AND ds.doctorId = ${doctorId}` : ''
  const scheds = await prisma.$queryRawUnsafe<any[]>(`
    SELECT ds.id AS schedId, ds.doctorId,
           DATE(ds.workDate) AS workDate,
           u.fullName AS doctorName, dp.degree,
           ws.name AS shiftName, ws.startTime, ws.endTime
    FROM   doctorschedule ds
    JOIN   \`user\` u ON u.id = ds.doctorId
    LEFT JOIN doctorprofile dp ON dp.userId = ds.doctorId
    JOIN   workshift ws ON ws.id = ds.shiftId
    WHERE  YEAR(ds.workDate) = ${yr} AND MONTH(ds.workDate) = ${mo}
    ${doctorFilter}
    ORDER BY ds.workDate, ws.startTime, u.fullName
  `)

  if (!scheds.length) return { month, schedules: [] }

  // 2. All reception cases linked via scheduleId (direct FK — no date guessing)
  const schedIds = scheds.map(s => Number(s.schedId)).join(',')
  const allCases = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      r.id                                   AS receptionId,
      r.code                                 AS receptionCode,
      r.scheduleId,
      p.fullName                             AS patientName,
      (SELECT GROUP_CONCAT(DISTINCT svc.name ORDER BY svc.name SEPARATOR ', ')
       FROM   dental_record dr2
       JOIN   dental_record_service drs ON drs.recordId = dr2.id
       JOIN   service svc ON svc.id = drs.serviceId
       WHERE  dr2.receptionId = r.id
      )                                      AS services,
      CAST(pc.proposedCoeff  AS DECIMAL(3,1)) AS proposedCoeff,
      pc.proposedReason,
      CAST(pc.approvedCoeff  AS DECIMAL(3,1)) AS approvedCoeff,
      pc.status                              AS complexStatus,
      pu.fullName                            AS proposedByName
    FROM reception r
    JOIN patient p ON p.id = r.patientId
    LEFT JOIN patientcomplexity pc ON pc.receptionId = r.id
    LEFT JOIN \`user\` pu ON pu.id = pc.proposedBy
    WHERE r.scheduleId IN (${schedIds})
      AND r.status IN ('COMPLETED','IN_TREATMENT','WAITING_PAYMENT','DONE')
    ORDER BY r.scheduleId, r.arrivedAt
  `)

  // 3. Group cases by scheduleId
  const caseMap: Record<number, any[]> = {}
  for (const c of allCases) {
    const sid = Number(c.scheduleId)
    if (!caseMap[sid]) caseMap[sid] = []
    caseMap[sid].push(c)
  }

  // 4. Build output — one block per schedule
  const schedules = scheds.map(s => {
    const sid   = Number(s.schedId)
    const cases = (caseMap[sid] ?? []).map(c => ({
      receptionId:    Number(c.receptionId),
      receptionCode:  c.receptionCode,
      patientName:    c.patientName,
      services:       c.services    ?? '',
      proposedCoeff:  c.proposedCoeff  != null ? Number(c.proposedCoeff)  : 0,
      proposedReason: c.proposedReason ?? null,
      proposedByName: c.proposedByName ?? null,
      approvedCoeff:  c.approvedCoeff  != null ? Number(c.approvedCoeff)  : null,
      complexStatus:  (c.complexStatus ?? 'NORMAL') as 'NORMAL' | 'PENDING' | 'APPROVED',
    }))
    const totalCoeff    = cases.reduce((a, c) => a + (c.approvedCoeff ?? 0), 0)
    const pendingCount  = cases.filter(c => c.complexStatus === 'PENDING').length
    const approvedCount = cases.filter(c => c.complexStatus === 'APPROVED').length
    return {
      schedId:      sid,
      doctorId:     Number(s.doctorId),
      doctorName:   s.doctorName,
      degree:       s.degree ?? null,
      shiftName:    s.shiftName,
      startTime:    s.startTime,
      endTime:      s.endTime,
      workDate:     s.workDate instanceof Date
                      ? s.workDate.toISOString().slice(0, 10)
                      : String(s.workDate),
      cases,
      totalCoeff:   Math.round(totalCoeff * 10) / 10,
      pendingCount,
      approvedCount,
    }
  })

  // 5. KPI
  const allCasesFlat  = schedules.flatMap(s => s.cases)
  const pendingTotal  = allCasesFlat.filter(c => c.complexStatus === 'PENDING').length
  const complexTotal  = allCasesFlat.filter(c => c.complexStatus !== 'NORMAL').length

  return { month, schedules, kpi: { schedTotal: schedules.length, complexTotal, pendingTotal } }
}

/** Doctor xem ca phức tạp của chính mình */
export const getDoctorComplexityCases = async (doctorId: number, month: string) => {
  const [yr, mo] = month.split('-').map(Number)

  // 1. Doctor's schedules this month
  const scheds = await prisma.$queryRawUnsafe<any[]>(`
    SELECT ds.id AS schedId, DATE(ds.workDate) AS workDate,
           ws.name AS shiftName, ws.startTime, ws.endTime
    FROM   doctorschedule ds
    JOIN   workshift ws ON ws.id = ds.shiftId
    WHERE  ds.doctorId = ${doctorId}
      AND  YEAR(ds.workDate) = ${yr} AND MONTH(ds.workDate) = ${mo}
    ORDER BY ds.workDate, ws.startTime
  `)

  if (!scheds.length) return { month, isLocked: false, schedules: [] }

  // 2. Cases linked directly via scheduleId (FK — correct and timezone-free)
  const schedIds = scheds.map(s => Number(s.schedId)).join(',')
  const allCases = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      r.id                                    AS receptionId,
      r.code                                  AS receptionCode,
      r.scheduleId,
      p.fullName                              AS patientName,
      (SELECT GROUP_CONCAT(DISTINCT svc.name ORDER BY svc.name SEPARATOR ', ')
       FROM   dental_record dr2
       JOIN   dental_record_service drs ON drs.recordId = dr2.id
       JOIN   service svc ON svc.id = drs.serviceId
       WHERE  dr2.receptionId = r.id
      )                                       AS services,
      CAST(pc.proposedCoeff  AS DECIMAL(3,1)) AS proposedCoeff,
      pc.proposedReason,
      CAST(pc.approvedCoeff  AS DECIMAL(3,1)) AS approvedCoeff,
      pc.status                               AS complexStatus
    FROM reception r
    JOIN patient p ON p.id = r.patientId
    LEFT JOIN patientcomplexity pc ON pc.receptionId = r.id
    WHERE r.scheduleId IN (${schedIds})
      AND r.status IN ('COMPLETED','IN_TREATMENT','WAITING_PAYMENT','DONE')
    ORDER BY r.scheduleId, r.arrivedAt
  `)

  // 3. Group cases by scheduleId
  const caseMap: Record<number, any[]> = {}
  for (const c of allCases) {
    const sid = Number(c.scheduleId)
    if (!caseMap[sid]) caseMap[sid] = []
    caseMap[sid].push(c)
  }

  // 4. Check if payslip is FINALIZED (locked)
  const ps = await prisma.$queryRawUnsafe<any[]>(
    `SELECT status FROM payslip WHERE userId = ${doctorId} AND month = '${month}' LIMIT 1`
  )
  const isLocked = ps[0]?.status === 'FINALIZED'

  // 5. Build output grouped by schedule
  const schedules = scheds.map(s => {
    const sid   = Number(s.schedId)
    const cases = (caseMap[sid] ?? []).map(c => ({
      receptionId:    Number(c.receptionId),
      receptionCode:  c.receptionCode,
      patientName:    c.patientName,
      services:       c.services    ?? '',
      proposedCoeff:  c.proposedCoeff  != null ? Number(c.proposedCoeff)  : 0,
      proposedReason: c.proposedReason ?? null,
      approvedCoeff:  c.approvedCoeff  != null ? Number(c.approvedCoeff)  : null,
      complexStatus:  (c.complexStatus ?? 'NORMAL') as 'NORMAL' | 'PENDING' | 'APPROVED',
    }))
    const workDate = s.workDate instanceof Date
      ? s.workDate.toISOString().slice(0, 10)
      : String(s.workDate)
    return {
      schedId:       sid,
      shiftName:     s.shiftName,
      startTime:     s.startTime,
      endTime:       s.endTime,
      workDate,
      cases,
      totalProposed: Math.round(cases.reduce((a, c) => a + (c.proposedCoeff ?? 0), 0) * 10) / 10,
      pendingCount:  cases.filter(c => c.complexStatus === 'PENDING').length,
      approvedCount: cases.filter(c => c.complexStatus === 'APPROVED').length,
      totalCoeff:    Math.round(cases.filter(c => c.complexStatus === 'APPROVED').reduce((a, c) => a + (c.approvedCoeff ?? 0), 0) * 10) / 10,
    }
  })

  return { month, isLocked, schedules }
}

/** Doctor đề xuất hệ số phức tạp */
export const proposeComplexity = async (
  receptionId: number,
  proposedCoeff: number,
  proposedReason: string | null,
  doctorId: number,
) => {
  if (proposedCoeff < 0 || proposedCoeff > 0.5)
    throw { status: 400, message: 'Hệ số bệnh nhân phải trong khoảng 0 – 0.5' }
  if (proposedCoeff > 0 && !proposedReason?.trim())
    throw { status: 400, message: 'Vui lòng nhập lý do cho ca phức tạp' }

  // Kiểm tra reception thuộc bác sĩ này
  const [rec] = await prisma.$queryRaw<any[]>`
    SELECT id FROM reception WHERE id = ${receptionId} AND doctorId = ${doctorId} LIMIT 1
  `
  if (!rec) throw { status: 403, message: 'Không có quyền chỉnh sửa ca này' }

  // Không cho sửa nếu đã APPROVED
  const [ex] = await prisma.$queryRaw<any[]>`
    SELECT status FROM patientcomplexity WHERE receptionId = ${receptionId} LIMIT 1
  `
  if (ex?.status === 'APPROVED')
    throw { status: 409, message: 'Hệ số này đã được Admin duyệt, không thể chỉnh sửa' }

  const status = proposedCoeff > 0 ? 'PENDING' : 'NORMAL'

  await prisma.$executeRaw`
    INSERT INTO patientcomplexity
      (receptionId, proposedCoeff, proposedReason, proposedBy, proposedAt, status)
    VALUES
      (${receptionId}, ${proposedCoeff}, ${proposedReason?.trim() ?? null},
       ${doctorId}, NOW(), ${status})
    ON DUPLICATE KEY UPDATE
      proposedCoeff  = ${proposedCoeff},
      proposedReason = ${proposedReason?.trim() ?? null},
      proposedBy     = ${doctorId},
      proposedAt     = NOW(),
      status         = ${status}
  `

  await logAction('PROPOSE_COMPLEXITY', `Đề xuất hệ số phức tạp ${proposedCoeff} cho reception ${receptionId}`, doctorId, '')
  return { ok: true }
}

/** Admin lưu / phê duyệt hệ số cho một ca trực (bulk) */
export const saveComplexityCases = async (
  items: { receptionId: number; approvedCoeff: number }[],
  adminId: number,
  ip: string,
) => {
  for (const item of items) {
    if (item.approvedCoeff < 0 || item.approvedCoeff > 0.5)
      throw { status: 400, message: `Hệ số phải trong khoảng 0 – 0.5 (receptionId=${item.receptionId})` }
  }

  // Check if any payslip is FINALIZED for these receptions
  for (const item of items) {
    const locked = await prisma.$queryRaw<any[]>`
      SELECT p.status
      FROM   payslip p
      JOIN   reception r ON r.doctorId = p.userId
        AND  DATE_FORMAT(r.arrivedAt, '%Y-%m') = p.month
      WHERE  r.id = ${item.receptionId} AND p.status = 'FINALIZED'
      LIMIT  1
    `
    if (locked[0])
      throw { status: 409, message: 'Phiếu lương tháng này đã chốt, không thể thay đổi hệ số' }
  }

  for (const item of items) {
    const status = item.approvedCoeff > 0 ? 'APPROVED' : 'NORMAL'
    await prisma.$executeRaw`
      INSERT INTO patientcomplexity
        (receptionId, approvedCoeff, approvedBy, approvedAt, status)
      VALUES
        (${item.receptionId}, ${item.approvedCoeff}, ${adminId}, NOW(), ${status})
      ON DUPLICATE KEY UPDATE
        approvedCoeff = ${item.approvedCoeff},
        approvedBy    = ${adminId},
        approvedAt    = NOW(),
        status        = ${status}
    `
  }

  await logAction('SAVE_COMPLEXITY', `Duyệt hệ số phức tạp ${items.length} ca`, adminId, ip)
  return { ok: true }
}

// ─── Annual Report helpers ────────────────────────────────────

/** All active staff (DOCTOR, RECEPTIONIST, ACCOUNTANT) for UC4.6 dropdown */
export const getAllStaffForReport = async () => {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT u.id, u.fullName, r.name AS roleName,
           dp.degree          AS degree,
           dp.specialization  AS specialization
    FROM   \`user\` u
    JOIN   userrole ur ON ur.userId = u.id
    JOIN   role     r  ON r.id      = ur.roleId
    LEFT JOIN doctorprofile dp ON dp.userId = u.id
    WHERE  u.isActive = 1
      AND  r.name IN ('DOCTOR', 'RECEPTIONIST', 'ACCOUNTANT')
    ORDER BY FIELD(r.name, 'DOCTOR', 'RECEPTIONIST', 'ACCOUNTANT'), u.fullName ASC
  `)
  return rows.map(r => ({
    id:             Number(r.id),
    fullName:       r.fullName,
    role:           r.roleName,
    degree:         r.degree         ?? null,
    specialization: r.specialization ?? null,
  }))
}

// ─── UC4.6: Annual salary report – one employee ───────────────

export const getAnnualPersonalReport = async (userId: number, year: number) => {
  // User info + profile degree
  const userRows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT u.id, u.fullName, r.name AS roleName,
           dp.degree         AS degree,
           dp.specialization AS specialization
    FROM   \`user\` u
    JOIN   userrole ur ON ur.userId = u.id
    JOIN   role     r  ON r.id      = ur.roleId
    LEFT JOIN doctorprofile dp ON dp.userId = u.id
    WHERE  u.id = ${userId}
    LIMIT 1
  `)
  if (!userRows.length) throw { status: 404, message: 'Không tìm thấy nhân sự' }

  const ur = userRows[0]
  const user = {
    id:             Number(ur.id),
    fullName:       ur.fullName,
    role:           ur.roleName,
    degree:         ur.degree         ?? null,
    specialization: ur.specialization ?? null,
  }

  // Payslips for this user in this year
  const prefix = `${year}-%`
  const payRows = await prisma.$queryRaw<any[]>`
    SELECT month, sessionCount, hoursWorked, salaryAmount, allowance, deduction, netSalary, status
    FROM   payslip
    WHERE  userId = ${userId} AND month LIKE ${prefix}
    ORDER BY month ASC
  `

  const payMap: Record<string, any> = {}
  for (const r of payRows) { payMap[r.month] = r }

  // Build 12-month array
  const months = Array.from({ length: 12 }, (_, i) => {
    const m  = `${year}-${String(i + 1).padStart(2, '0')}`
    const p  = payMap[m]
    if (!p) return { month: m, sessionCount: null, hoursWorked: null, salaryAmount: null, allowance: null, deduction: null, netSalary: null, status: 'NONE' }
    return {
      month:        m,
      sessionCount: p.sessionCount !== null ? Number(p.sessionCount) : null,
      hoursWorked:  p.hoursWorked  !== null ? Number(p.hoursWorked)  : null,
      salaryAmount: Number(p.salaryAmount),
      allowance:    Number(p.allowance),
      deduction:    Number(p.deduction),
      netSalary:    Number(p.netSalary),
      status:       p.status as string,
    }
  })

  const totalAnnual    = months.reduce((s, m) => s + (m.netSalary ?? 0), 0)
  const countM         = months.filter(m => m.status !== 'NONE').length
  const avgMonthly     = countM > 0 ? Math.round(totalAnnual / countM) : 0
  const totalSessions  = months.reduce((s, m) => s + (m.sessionCount ?? 0), 0)
  const totalHours     = Number(months.reduce((s, m) => s + (m.hoursWorked ?? 0), 0).toFixed(1))

  return { user, year, totalAnnual, avgMonthly, totalSessions, totalHours, months }
}

// ─── UC4.7: Annual salary report – all staff ─────────────────

export const getAnnualFullReport = async (year: number) => {
  const prefix = `${year}-%`
  type RoleKey = 'DOCTOR' | 'RECEPTIONIST' | 'ACCOUNTANT'

  // Per-role totals
  const roleRows = await prisma.$queryRaw<any[]>`
    SELECT role, COUNT(DISTINCT userId) AS staffCount, SUM(netSalary) AS total
    FROM   payslip
    WHERE  month LIKE ${prefix}
    GROUP BY role
  `

  // Per-month + role aggregation (for stacked bar chart)
  const monthlyRows = await prisma.$queryRaw<any[]>`
    SELECT month, role, SUM(netSalary) AS total
    FROM   payslip
    WHERE  month LIKE ${prefix}
    GROUP BY month, role
    ORDER BY month ASC
  `

  // Per-employee summary
  const empRows = await prisma.$queryRaw<any[]>`
    SELECT u.id, u.fullName, r.name AS roleName,
           COUNT(p.id) AS monthCount, SUM(p.netSalary) AS totalAnnual
    FROM   \`user\` u
    JOIN   userrole ur ON ur.userId = u.id
    JOIN   role     r  ON r.id      = ur.roleId
    JOIN   payslip  p  ON p.userId = u.id AND p.month LIKE ${prefix}
    WHERE  u.isActive = 1
      AND  r.name IN ('DOCTOR', 'RECEPTIONIST', 'ACCOUNTANT')
    GROUP BY u.id, u.fullName, r.name
    ORDER BY FIELD(r.name, 'DOCTOR', 'RECEPTIONIST', 'ACCOUNTANT'), u.fullName ASC
  `

  const byRole: Record<RoleKey, { count: number; total: number }> = {
    DOCTOR:       { count: 0, total: 0 },
    RECEPTIONIST: { count: 0, total: 0 },
    ACCOUNTANT:   { count: 0, total: 0 },
  }
  for (const r of roleRows) {
    const key = r.role as RoleKey
    if (byRole[key]) { byRole[key].count = Number(r.staffCount); byRole[key].total = Number(r.total) }
  }

  const totalFund         = Object.values(byRole).reduce((s, r) => s + r.total, 0)
  const monthsWithData    = [...new Set(monthlyRows.map(r => r.month as string))].sort()
  const countActiveMonths = monthsWithData.length
  const avgMonthly        = countActiveMonths > 0 ? Math.round(totalFund / countActiveMonths) : 0

  // 12-month chart array
  const monthlyChart = Array.from({ length: 12 }, (_, i) => {
    const m  = `${year}-${String(i + 1).padStart(2, '0')}`
    const md = monthlyRows.filter(r => r.month === m)
    return {
      month:        m,
      label:        `T${i + 1}`,
      DOCTOR:       Number(md.find(r => r.role === 'DOCTOR')?.total       ?? 0),
      RECEPTIONIST: Number(md.find(r => r.role === 'RECEPTIONIST')?.total ?? 0),
      ACCOUNTANT:   Number(md.find(r => r.role === 'ACCOUNTANT')?.total   ?? 0),
    }
  })

  const employees = empRows.map(r => ({
    id:          Number(r.id),
    fullName:    r.fullName,
    role:        r.roleName as RoleKey,
    monthCount:  Number(r.monthCount),
    totalAnnual: Number(r.totalAnnual ?? 0),
    avgMonthly:  Number(r.monthCount) > 0
                   ? Math.round(Number(r.totalAnnual ?? 0) / Number(r.monthCount))
                   : 0,
  }))

  return { year, totalFund, avgMonthly, byRole, monthlyChart, employees, countActiveMonths }
}

// ═══════════════════════════════════════════════════════════════
// UC4.4 – Lập phiếu lương
// ═══════════════════════════════════════════════════════════════

// ─── Degree → hệ số bác sĩ ───────────────────────────────────
const DEGREE_COEFF: Record<string, number> = {
  'GS': 2.5, 'GIÁO SƯ': 2.5,
  'PGS': 2.0, 'PHÓ GIÁO SƯ': 2.0,
  'TS': 1.7, 'TIẾN SỸ': 1.7, 'TIẾN SĨ': 1.7,
  'CKII': 1.7, 'BS CKII': 1.7, 'BSCKII': 1.7, 'CHUYÊN KHOA II': 1.7,
  'THS': 1.3, 'THẠC SĨ': 1.3, 'THẠC SỸ': 1.3,
  'CKI': 1.3, 'BS CKI': 1.3, 'BSCKI': 1.3, 'CHUYÊN KHOA I': 1.3,
  'BS': 1.0, 'BÁC SĨ': 1.0,
}
function getDegreeCoeff(degree: string | null): number {
  if (!degree) return 1.0
  return DEGREE_COEFF[degree.trim().toUpperCase()] ?? 1.0
}

function parseHourDecimal(t: string): number {
  const parts = t.split(':')
  return Number(parts[0]) + (Number(parts[1] || 0)) / 60
}

function shiftDurationHours(startTime: string, endTime: string): number {
  return Math.round((parseHourDecimal(endTime) - parseHourDecimal(startTime)) * 100) / 100
}

const DOW_LABEL: Record<number, string> = {
  1: 'Thứ Hai', 2: 'Thứ Ba', 3: 'Thứ Tư', 4: 'Thứ Năm',
  5: 'Thứ Sáu', 6: 'Thứ Bảy', 7: 'Chủ nhật',
}
// MySQL DAYOFWEEK: 1=Sun,2=Mon..7=Sat → our 1=Mon..7=Sun
function mysqlDowToOur(d: number): number { return d === 1 ? 7 : d - 1 }

// ─── Tính toán phiếu lương bác sĩ ────────────────────────────
async function calcDoctorPayslip(doctorId: number, month: string) {
  const [yr, mo] = month.split('-').map(Number)

  // Doctor profile
  const dpRows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT dp.degree, u.fullName
    FROM   doctorprofile dp
    JOIN   \`user\` u ON u.id = dp.userId
    WHERE  dp.userId = ${doctorId} LIMIT 1
  `)
  const degree      = dpRows[0]?.degree ?? null
  const doctorCoeff = getDegreeCoeff(degree)
  const fullName    = dpRows[0]?.fullName ?? ''

  // Hourly rate – lấy mức áp dụng cho giữa tháng
  const midMonth = `${yr}-${String(mo).padStart(2,'0')}-15`
  const hrRows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT amount FROM hourlyrate
    WHERE  startDate <= '${midMonth}'
      AND  (endDate IS NULL OR endDate >= '${midMonth}')
    ORDER BY startDate DESC LIMIT 1
  `)
  if (!hrRows.length)
    throw { status: 400, message: 'Chưa có cấu hình đơn giá giờ. Vui lòng thiết lập tại UC4.1 trước.' }
  const hourlyRate = Number(hrRows[0].amount)

  // Schedules in month
  const scheds = await prisma.$queryRawUnsafe<any[]>(`
    SELECT ds.id                   AS schedId,
           DATE(ds.workDate)       AS workDate,
           DAYOFWEEK(ds.workDate)  AS dow,
           ws.id                   AS shiftId,
           ws.name                 AS shiftName,
           ws.startTime, ws.endTime
    FROM   doctorschedule ds
    JOIN   workshift ws ON ws.id = ds.shiftId
    WHERE  ds.doctorId = ${doctorId}
      AND  YEAR(ds.workDate) = ${yr}
      AND  MONTH(ds.workDate) = ${mo}
    ORDER BY ds.workDate, ws.startTime
  `)

  let totalShiftPay = 0
  let totalAdjHours = 0
  const shifts: any[] = []

  for (const s of scheds) {
    const schedId   = Number(s.schedId)
    const ourDow    = mysqlDowToOur(Number(s.dow))
    const shiftHours = shiftDurationHours(s.startTime, s.endTime)

    // Shift coefficient
    const scRows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT coefficient FROM shiftcoefficient
      WHERE shiftId = ${Number(s.shiftId)} AND dayOfWeek = ${ourDow} LIMIT 1
    `)
    const shiftCoeff = scRows[0] ? Number(scRows[0].coefficient) : 1.0

    // Patient complexity
    const pcRows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COALESCE(SUM(pc.approvedCoeff), 0) AS totalCoeff,
             SUM(CASE WHEN pc.status = 'PENDING' THEN 1 ELSE 0 END) AS pendingCnt
      FROM   reception r
      LEFT JOIN patientcomplexity pc ON pc.receptionId = r.id
      WHERE  r.scheduleId = ${schedId}
        AND  r.status NOT IN ('CANCELLED','ABSENT')
    `)
    const patientCoeff  = Math.round(Number(pcRows[0]?.totalCoeff ?? 0) * 10) / 10
    const pendingCnt    = Number(pcRows[0]?.pendingCnt ?? 0)

    const adjHours  = Math.round(shiftHours * (shiftCoeff + patientCoeff) * 100) / 100
    const shiftPay  = Math.round(adjHours * doctorCoeff * hourlyRate)
    const workDate  = s.workDate instanceof Date ? s.workDate.toISOString().slice(0,10) : String(s.workDate)

    shifts.push({
      schedId, workDate,
      dayLabel:       DOW_LABEL[ourDow] ?? '',
      shiftName:      s.shiftName,
      shiftHours,
      shiftCoeff,
      patientCoeff,
      pendingCnt,
      adjHours,
      doctorCoeff,
      hourlyRate,
      shiftPay,
    })
    totalShiftPay += shiftPay
    totalAdjHours = Math.round((totalAdjHours + adjHours) * 100) / 100
  }

  const hasPendingComplexity = shifts.some(s => s.pendingCnt > 0)

  return {
    role: 'DOCTOR', fullName, degree, doctorCoeff,
    shifts, sessionCount: shifts.length,
    totalAdjHours, totalShiftPay, hourlyRate,
    baseSalary: 0, salaryAmount: totalShiftPay,
    hasPendingComplexity,
  }
}

// ─── Tính toán phiếu lương lễ tân / kế toán ─────────────────
async function calcStaffPayslip(userId: number, month: string, role: string) {
  const [yr, mo] = month.split('-').map(Number)
  const lastDay   = new Date(yr, mo, 0).getDate()
  const monthStart = `${yr}-${String(mo).padStart(2,'0')}-01`
  const monthEnd   = `${yr}-${String(mo).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`

  const userRow = await prisma.$queryRawUnsafe<any[]>(
    `SELECT fullName FROM \`user\` WHERE id = ${userId} LIMIT 1`
  )
  const fullName = userRow[0]?.fullName ?? ''

  const fsRows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT amount FROM fixedsalary
    WHERE  userId = ${userId}
      AND  startDate <= '${monthEnd}'
      AND  (endDate IS NULL OR endDate >= '${monthStart}')
    ORDER BY startDate DESC LIMIT 1
  `)
  if (!fsRows.length)
    throw { status: 400, message: 'Chưa thiết lập mức lương cố định cho nhân sự này. Vui lòng thiết lập tại UC4.1 trước.' }

  const baseSalary = Number(fsRows[0].amount)
  return {
    role, fullName, degree: null, doctorCoeff: null,
    shifts: [], sessionCount: null, totalAdjHours: null,
    totalShiftPay: 0, hourlyRate: null,
    baseSalary, salaryAmount: baseSalary,
    hasPendingComplexity: false,
  }
}

// ─── Lấy dữ liệu phiếu lương (preview + existing) ───────────
export const getPayslipData = async (userId: number, month: string) => {
  // User role
  const roleRows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT r.name AS roleName FROM \`user\` u
    JOIN userrole ur ON ur.userId = u.id
    JOIN role     r  ON r.id     = ur.roleId
    WHERE u.id = ${userId} LIMIT 1
  `)
  if (!roleRows.length) throw { status: 404, message: 'Không tìm thấy nhân sự' }
  const role = roleRows[0].roleName

  // Calculate from source data
  const calc = role === 'DOCTOR'
    ? await calcDoctorPayslip(userId, month)
    : await calcStaffPayslip(userId, month, role)

  // Existing payslip
  const existing = await prisma.$queryRawUnsafe<any[]>(`
    SELECT id, status, sessionCount, hoursWorked,
           salaryAmount, allowance, deduction, netSalary, note, createdAt
    FROM   payslip
    WHERE  userId = ${userId} AND month = '${month}' LIMIT 1
  `)

  const ps = existing[0]
  return {
    ...calc,
    payslipId:   ps ? Number(ps.id)      : null,
    status:      ps ? ps.status          : null,
    allowance:   ps ? Number(ps.allowance) : 0,
    deduction:   ps ? Number(ps.deduction) : 0,
    netSalary:   ps ? Number(ps.netSalary) : calc.salaryAmount,
    note:        ps?.note ?? null,
    createdAt:   ps?.createdAt ?? null,
    userId,      month,
  }
}

// ─── Lưu / cập nhật phiếu nháp ───────────────────────────────
export const savePayslip = async (
  userId: number, month: string,
  allowance: number, deduction: number, note: string | null,
  operatorId: number, ip: string,
) => {
  const roleRows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT r.name AS roleName FROM \`user\` u
    JOIN userrole ur ON ur.userId = u.id
    JOIN role     r  ON r.id     = ur.roleId
    WHERE u.id = ${userId} LIMIT 1
  `)
  const role = roleRows[0]?.roleName
  const calc = role === 'DOCTOR'
    ? await calcDoctorPayslip(userId, month)
    : await calcStaffPayslip(userId, month, role)

  const salaryAmount  = calc.salaryAmount
  const netSalary     = salaryAmount + allowance - deduction
  const sessionCount  = calc.sessionCount !== null ? calc.sessionCount : 'NULL'
  const hoursWorked   = calc.totalAdjHours !== null ? calc.totalAdjHours : 'NULL'
  const noteVal       = note ? `'${note.replace(/'/g, "''")}'` : 'NULL'

  const existing = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, status FROM payslip WHERE userId = ${userId} AND month = '${month}' LIMIT 1`
  )

  if (existing.length) {
    if (existing[0].status === 'FINALIZED')
      throw { status: 409, message: 'Phiếu lương đã chốt, không thể chỉnh sửa' }
    await prisma.$executeRawUnsafe(`
      UPDATE payslip SET
        salaryAmount = ${salaryAmount}, allowance = ${allowance},
        deduction = ${deduction}, netSalary = ${netSalary},
        sessionCount = ${sessionCount}, hoursWorked = ${hoursWorked},
        status = 'DRAFT', note = ${noteVal}, updatedAt = NOW()
      WHERE id = ${Number(existing[0].id)}
    `)
    await logAction('SAVE_PAYSLIP', `Cập nhật phiếu lương ${month} – userId=${userId}`, operatorId, ip)
    return { payslipId: Number(existing[0].id), ok: true }
  }

  await prisma.$executeRawUnsafe(`
    INSERT INTO payslip (userId, month, role, salaryAmount, allowance, deduction, netSalary, sessionCount, hoursWorked, status, note, createdBy, createdAt, updatedAt)
    VALUES (${userId}, '${month}', '${role}', ${salaryAmount}, ${allowance}, ${deduction}, ${netSalary}, ${sessionCount}, ${hoursWorked}, 'DRAFT', ${noteVal}, ${operatorId}, NOW(), NOW())
  `)
  const newRow = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id FROM payslip WHERE userId = ${userId} AND month = '${month}' LIMIT 1`
  )
  await logAction('CREATE_PAYSLIP', `Lập phiếu lương ${month} – userId=${userId}`, operatorId, ip)
  return { payslipId: Number(newRow[0].id), ok: true }
}

// ─── Tính lại phiếu nháp ─────────────────────────────────────
export const recalcPayslip = async (payslipId: number, operatorId: number, ip: string) => {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT userId, month, status, allowance, deduction, note FROM payslip WHERE id = ${payslipId} LIMIT 1`
  )
  if (!rows.length) throw { status: 404, message: 'Không tìm thấy phiếu lương' }
  const ps = rows[0]
  if (ps.status === 'FINALIZED') throw { status: 409, message: 'Phiếu đã chốt, không thể tính lại' }

  return savePayslip(
    Number(ps.userId), ps.month,
    Number(ps.allowance), Number(ps.deduction),
    ps.note ?? null, operatorId, ip,
  )
}

// ─── Duyệt phiếu (DRAFT → APPROVED) ─────────────────────────
export const approvePayslip = async (payslipId: number, adminId: number, ip: string) => {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, status FROM payslip WHERE id = ${payslipId} LIMIT 1`
  )
  if (!rows.length) throw { status: 404, message: 'Không tìm thấy phiếu lương' }
  if (rows[0].status !== 'DRAFT') throw { status: 409, message: 'Chỉ phiếu ở trạng thái Nháp mới có thể duyệt' }
  await prisma.$executeRawUnsafe(
    `UPDATE payslip SET status = 'APPROVED', updatedAt = NOW() WHERE id = ${payslipId}`
  )
  await logAction('APPROVE_PAYSLIP', `Duyệt phiếu lương id=${payslipId}`, adminId, ip)
  return { ok: true }
}

// ─── Chốt phiếu (APPROVED → FINALIZED) ──────────────────────
export const finalizePayslip = async (payslipId: number, adminId: number, ip: string) => {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, status FROM payslip WHERE id = ${payslipId} LIMIT 1`
  )
  if (!rows.length) throw { status: 404, message: 'Không tìm thấy phiếu lương' }
  if (rows[0].status !== 'APPROVED') throw { status: 409, message: 'Chỉ phiếu đã duyệt mới có thể chốt' }
  await prisma.$executeRawUnsafe(
    `UPDATE payslip SET status = 'FINALIZED', updatedAt = NOW() WHERE id = ${payslipId}`
  )
  await logAction('FINALIZE_PAYSLIP', `Chốt phiếu lương id=${payslipId}`, adminId, ip)
  return { ok: true }
}

// ─── Hủy phiếu ───────────────────────────────────────────────
export const cancelPayslip = async (payslipId: number, adminId: number, ip: string) => {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, status FROM payslip WHERE id = ${payslipId} LIMIT 1`
  )
  if (!rows.length) throw { status: 404, message: 'Không tìm thấy phiếu lương' }
  if (rows[0].status === 'FINALIZED')
    throw { status: 409, message: 'Phiếu đã chốt. Cần phê duyệt Admin để hủy và lập lại.' }
  await prisma.$executeRawUnsafe(
    `UPDATE payslip SET status = 'CANCELLED', updatedAt = NOW() WHERE id = ${payslipId}`
  )
  await logAction('CANCEL_PAYSLIP', `Hủy phiếu lương id=${payslipId}`, adminId, ip)
  return { ok: true }
}

// ─── Danh sách nhân sự cho selector UC4.4 ────────────────────
export const getPayslipStaffList = async () => {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT u.id, u.fullName, r.name AS roleName,
           COALESCE(dp.degree, NULL) AS degree
    FROM   \`user\` u
    JOIN   userrole ur ON ur.userId = u.id
    JOIN   role     r  ON r.id     = ur.roleId
    LEFT JOIN doctorprofile dp ON dp.userId = u.id
    WHERE  u.isActive = 1
      AND  r.name IN ('DOCTOR','RECEPTIONIST','ACCOUNTANT')
    ORDER BY FIELD(r.name,'DOCTOR','RECEPTIONIST','ACCOUNTANT'), u.fullName ASC
  `
  return rows.map(r => ({
    id:       Number(r.id),
    fullName: r.fullName,
    role:     r.roleName,
    degree:   r.degree ?? null,
    coeff:    getDegreeCoeff(r.degree ?? null),
  }))
}
