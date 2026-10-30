import { PrismaClient } from '@prisma/client'
import { logAction } from '../../utils/logger'
import { getHolidaysForDateRange } from '../holiday/holiday.service'

const prisma = new PrismaClient()

// ─── Helpers ─────────────────────────────────────────────────

/** Parse "YYYY-MM-DD" → UTC midnight DateTime */
const parseDate = (dateStr: string): Date => new Date(dateStr + 'T00:00:00.000Z')

/** JS getDay() → our applyDay system (0=CN, 2=T2…7=T7) */
const jsToApplyDay = (jsDay: number): number => (jsDay === 0 ? 0 : jsDay + 1)

const VN_DAY: Record<number, string> = {
  0: 'Chủ nhật', 2: 'Thứ 2', 3: 'Thứ 3',
  4: 'Thứ 4', 5: 'Thứ 5', 6: 'Thứ 6', 7: 'Thứ 7',
}

const timeToMinutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Returns true if the shift time range overlaps with the holiday's time window */
const isShiftBlockedByHoliday = (
  shiftStart: string,
  shiftEnd: string,
  holiday: { type: string; startTime: string | null; endTime: string | null }
): boolean => {
  if (holiday.type === 'NATIONAL') return true
  // PRIVATE / RECURRING: null time = full day block
  if (!holiday.startTime || !holiday.endTime) return true
  const ss = timeToMinutes(shiftStart)
  const se = timeToMinutes(shiftEnd)
  const hs = timeToMinutes(holiday.startTime)
  const he = timeToMinutes(holiday.endTime)
  return ss < he && se > hs
}

const formatSchedule = (s: any) => ({
  id:                s.id,
  doctorId:          s.doctorId,
  doctorName:        s.doctor.fullName,
  shiftId:           s.shiftId,
  shiftName:         s.shift.name,
  shiftStartTime:    s.shift.startTime,
  shiftEndTime:      s.shift.endTime,
  shiftColorCode:    s.shift.colorCode,
  shiftMaxPatients:  s.shift.maxPatients,
  shiftSlotDuration: s.shift.slotDuration,
  shiftBufferTime:   s.shift.bufferTime,
  shiftReserveSlots: s.shift.reserveSlots,
  workDate:          (s.workDate as Date).toISOString().slice(0, 10), // "YYYY-MM-DD"
  serviceGroupId:    s.serviceGroupId,
  serviceGroupName:  s.serviceGroup?.name ?? null,
  note:              s.note,
  isOverride:        s.isOverride,
  appointmentCount:  0, // TODO UC01: count appointments
})

const INCLUDE = {
  doctor:       { select: { id: true, fullName: true } },
  shift:        { select: { id: true, name: true, startTime: true, endTime: true, colorCode: true, maxPatients: true, slotDuration: true, bufferTime: true, reserveSlots: true } },
  serviceGroup: { select: { id: true, name: true } },
}

// ─── UC08: Queries ────────────────────────────────────────────

const HOLIDAY_COLORS: Record<string, string> = {
  NATIONAL:  '#ef4444',
  PRIVATE:   '#9333ea',
  RECURRING: '#d97706',
}

export const getWeekSchedules = async (weekStart: string) => {
  const start = parseDate(weekStart)
  const end   = new Date(start)
  end.setUTCDate(end.getUTCDate() + 7)

  const [rows, holidayRows] = await Promise.all([
    prisma.doctorSchedule.findMany({
      where:   { workDate: { gte: start, lt: end } },
      include: INCLUDE,
      orderBy: [{ workDate: 'asc' }, { shift: { startTime: 'asc' } }],
    }),
    getHolidaysForDateRange(start, new Date(end.getTime() - 1)),
  ])

  const holidays = holidayRows.map(h => ({
    id:        h.id,
    name:      h.name,
    startDate: h.startDate.toISOString().slice(0, 10),
    endDate:   h.endDate.toISOString().slice(0, 10),
    type:      h.type,
    startTime: h.startTime ?? null,
    endTime:   h.endTime   ?? null,
    color:     HOLIDAY_COLORS[h.type] ?? '#6b7280',
  }))

  return { schedules: rows.map(formatSchedule), holidays }
}

/** Form-data: doctors (with groups) + active shifts + service groups */
export const getFormData = async () => {
  const [doctors, shifts, groups] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, roles: { some: { role: { name: 'DOCTOR' } } } },
      select: {
        id: true, fullName: true,
        serviceGroups: { include: { serviceGroup: { select: { id: true, name: true } } } },
      },
      orderBy: { fullName: 'asc' },
    }),
    prisma.workShift.findMany({
      where:   { isActive: true },
      orderBy: { startTime: 'asc' },
    }),
    prisma.serviceGroup.findMany({ orderBy: { name: 'asc' } }),
  ])

  return {
    doctors: doctors.map(d => ({
      id:       d.id,
      fullName: d.fullName,
      groups:   d.serviceGroups.map(sg => ({ id: sg.serviceGroup.id, name: sg.serviceGroup.name })),
    })),
    shifts,
    groups,
  }
}

// ─── UC08: CRUD ───────────────────────────────────────────────

export type ScheduleInput = {
  doctorId:       number
  shiftId:        number
  workDate:       string   // "YYYY-MM-DD"
  serviceGroupId?: number
  note?:           string
  isOverride?:     boolean
}

export const createSchedule = async (
  data: ScheduleInput,
  adminId: number,
  ip: string
) => {
  // 1. Bác sĩ hợp lệ
  const doctor = await prisma.user.findUnique({
    where: { id: data.doctorId },
    include: { roles: { include: { role: true } } },
  })
  if (!doctor || !doctor.isActive)
    throw { status: 404, message: 'Bác sĩ không tồn tại hoặc đã bị khóa' }
  if (!doctor.roles.some(r => r.role.name === 'DOCTOR'))
    throw { status: 400, message: 'Người dùng được chọn không phải bác sĩ' }

  // 2. Ca làm việc hợp lệ
  const shift = await prisma.workShift.findUnique({ where: { id: data.shiftId } })
  if (!shift || !shift.isActive)
    throw { status: 404, message: 'Ca làm việc không tồn tại hoặc đã tắt' }

  // 3. Ngày hợp lệ
  const workDate = parseDate(data.workDate)
  const today    = new Date(); today.setUTCHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

  if (workDate < today)
    throw { status: 400, message: '[E1] Không thể đăng ký lịch trực cho ngày đã qua' }
  if (workDate < tomorrow && !data.isOverride)
    throw { status: 400, message: 'Lịch trực phải đăng ký trước ít nhất 1 ngày. Bật "Nghỉ đột xuất" nếu là ca khẩn cấp.' }

  // 4. Ca phải hoạt động vào ngày đó
  const applyDay  = jsToApplyDay(workDate.getUTCDay())
  const shiftDays = shift.applyDays as number[]
  if (!shiftDays.includes(applyDay))
    throw { status: 400, message: `Ca "${shift.name}" không hoạt động vào ${VN_DAY[applyDay]}` }

  // 4.5 Kiểm tra ngày nghỉ lễ
  const holidaysOnDay = await getHolidaysForDateRange(workDate, workDate)
  for (const h of holidaysOnDay) {
    if (isShiftBlockedByHoliday(shift.startTime, shift.endTime, h)) {
      const timeInfo = (h.type !== 'NATIONAL' && h.startTime && h.endTime)
        ? ` (${h.startTime}–${h.endTime})`
        : ''
      throw { status: 400, message: `Ngày ${data.workDate} có ngày nghỉ "${h.name}"${timeInfo}. Không thể phân ca.` }
    }
  }

  // 5. Tối đa 2 ca / ngày / bác sĩ
  const dayEnd = new Date(workDate); dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)
  const sameDayCount = await prisma.doctorSchedule.count({
    where: { doctorId: data.doctorId, workDate: { gte: workDate, lt: dayEnd } },
  })
  if (sameDayCount >= 2)
    throw { status: 400, message: `BS. ${doctor.fullName} đã có 2 ca trong ngày này (tối đa 2 ca/ngày)` }

  // 6. Trùng lịch
  const dup = await prisma.doctorSchedule.findFirst({
    where: { doctorId: data.doctorId, shiftId: data.shiftId, workDate },
  })
  if (dup) throw { status: 409, message: `BS. ${doctor.fullName} đã được phân công ca "${shift.name}" ngày này rồi` }

  const schedule = await prisma.doctorSchedule.create({
    data: {
      doctorId:       data.doctorId,
      shiftId:        data.shiftId,
      workDate,
      serviceGroupId: data.serviceGroupId ?? null,
      note:           data.note?.trim() || null,
      isOverride:     data.isOverride ?? false,
      createdBy:      adminId,
    },
    include: INCLUDE,
  })

  await logAction(
    'CREATE_SCHEDULE',
    `Phân công ${doctor.fullName}: ${shift.name} ngày ${data.workDate}${data.isOverride ? ' [OVERRIDE]' : ''}`,
    adminId, ip
  )
  return formatSchedule(schedule)
}

export type ScheduleUpdateInput = {
  doctorId?:       number
  shiftId?:        number
  workDate?:       string          // "YYYY-MM-DD"
  serviceGroupId?: number | null
  note?:           string
  isOverride?:     boolean
}

export const updateSchedule = async (
  id: number,
  data: ScheduleUpdateInput,
  adminId: number,
  ip: string
) => {
  const schedule = await prisma.doctorSchedule.findUnique({
    where: { id }, include: { doctor: true, shift: true },
  })
  if (!schedule) throw { status: 404, message: 'Không tìm thấy lịch trực' }

  // Resolve final values (dùng giá trị cũ nếu không có trong request)
  const newDoctorId  = data.doctorId  ?? schedule.doctorId
  const newShiftId   = data.shiftId   ?? schedule.shiftId
  const newWorkDate  = data.workDate  ? parseDate(data.workDate) : new Date(schedule.workDate)
  newWorkDate.setUTCHours(0, 0, 0, 0)

  const today    = new Date(); today.setUTCHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

  // Ngày quá khứ chỉ cho phép nếu isOverride
  if (newWorkDate < today && !data.isOverride)
    throw { status: 400, message: '[E1] Không thể sửa lịch trực ngày đã qua. Bật override nếu cần thiết.' }

  // Kiểm tra khi thay đổi bác sĩ, ca, hoặc ngày
  const changing = data.doctorId !== undefined || data.shiftId !== undefined || data.workDate !== undefined
  if (changing) {
    // Bác sĩ hợp lệ
    const doctor = await prisma.user.findUnique({
      where: { id: newDoctorId },
      include: { roles: { include: { role: true } } },
    })
    if (!doctor || !doctor.isActive)
      throw { status: 404, message: 'Bác sĩ không tồn tại hoặc đã bị khóa' }
    if (!doctor.roles.some(r => r.role.name === 'DOCTOR'))
      throw { status: 400, message: 'Người dùng được chọn không phải bác sĩ' }

    // Ca hợp lệ
    const shift = await prisma.workShift.findUnique({ where: { id: newShiftId } })
    if (!shift || !shift.isActive)
      throw { status: 404, message: 'Ca làm việc không tồn tại hoặc đã tắt' }

    // Ca phải hoạt động vào ngày đó
    const applyDay  = jsToApplyDay(newWorkDate.getUTCDay())
    const shiftDays = shift.applyDays as number[]
    if (!shiftDays.includes(applyDay))
      throw { status: 400, message: `Ca "${shift.name}" không hoạt động vào ${VN_DAY[applyDay]}` }

    // Kiểm tra ngày nghỉ lễ
    const holidaysOnDay = await getHolidaysForDateRange(newWorkDate, newWorkDate)
    for (const h of holidaysOnDay) {
      if (isShiftBlockedByHoliday(shift.startTime, shift.endTime, h)) {
        const timeInfo = (h.type !== 'NATIONAL' && h.startTime && h.endTime)
          ? ` (${h.startTime}–${h.endTime})`
          : ''
        throw { status: 400, message: `Ngày ${data.workDate ?? schedule.workDate.toISOString().slice(0,10)} có ngày nghỉ "${h.name}"${timeInfo}. Không thể phân ca.` }
      }
    }

    // Tối đa 2 ca / ngày (bỏ qua bản thân)
    const dayEnd = new Date(newWorkDate); dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)
    const sameDayCount = await prisma.doctorSchedule.count({
      where: { doctorId: newDoctorId, workDate: { gte: newWorkDate, lt: dayEnd }, id: { not: id } },
    })
    if (sameDayCount >= 2)
      throw { status: 400, message: `BS. ${doctor.fullName} đã có 2 ca trong ngày này (tối đa 2 ca/ngày)` }

    // Trùng lịch (bỏ qua bản thân)
    const dup = await prisma.doctorSchedule.findFirst({
      where: { doctorId: newDoctorId, shiftId: newShiftId, workDate: newWorkDate, id: { not: id } },
    })
    if (dup) throw { status: 409, message: `BS. ${doctor.fullName} đã được phân công ca "${shift.name}" ngày này rồi` }
  }

  await prisma.doctorSchedule.update({
    where: { id },
    data: {
      doctorId:       newDoctorId,
      shiftId:        newShiftId,
      workDate:       newWorkDate,
      serviceGroupId: data.serviceGroupId !== undefined ? (data.serviceGroupId ?? null) : schedule.serviceGroupId,
      note:           data.note !== undefined ? (data.note?.trim() || null) : schedule.note,
      isOverride:     data.isOverride ?? schedule.isOverride,
    },
  })

  await logAction(
    'UPDATE_SCHEDULE',
    `Cập nhật lịch trực id=${id}: ${schedule.doctor.fullName} – ${schedule.shift.name}${data.isOverride ? ' [OVERRIDE]' : ''}`,
    adminId, ip
  )
}

export const deleteSchedule = async (
  id: number,
  adminId: number,
  ip: string,
  isOverride = false
) => {
  const schedule = await prisma.doctorSchedule.findUnique({
    where: { id }, include: { doctor: true, shift: true },
  })
  if (!schedule) throw { status: 404, message: 'Không tìm thấy lịch trực' }

  const workDate = new Date(schedule.workDate); workDate.setUTCHours(0, 0, 0, 0)
  const today    = new Date(); today.setUTCHours(0, 0, 0, 0)
  if (workDate < today && !isOverride)
    throw { status: 400, message: '[E1] Không thể hủy lịch trực ngày đã qua' }

  // TODO UC01 [E2]: kiểm tra lịch hẹn đã gán trong ca này

  await prisma.doctorSchedule.delete({ where: { id } })
  await logAction(
    'DELETE_SCHEDULE',
    `Hủy lịch trực: ${schedule.doctor.fullName} – ${schedule.shift.name} ngày ${workDate.toISOString().slice(0, 10)}${isOverride ? ' [OVERRIDE khẩn cấp]' : ''}`,
    adminId, ip
  )
}

// ════════════════════════════════════════════════════════════════
// UC08 A4/A5/A6 – Phân công lịch trực hàng loạt nhiều ngày
// ════════════════════════════════════════════════════════════════

export type BatchScheduleInput = {
  doctorId:        number
  shiftId:         number
  workDates:       string[]          // "YYYY-MM-DD"
  serviceGroupId?: number | null
  note?:           string
  isOverride?:     boolean
}

export type BatchDayResult = {
  workDate: string
  valid:    boolean
  error?:   string
}

type DoctorWithRoles = { fullName: string; roles: { role: { name: string } }[] }
type ShiftBasic      = { name: string; applyDays: unknown; startTime: string; endTime: string }

/** Validate 1 ngày trong batch — trả kết quả, không throw */
async function validateOneDayForBatch(
  opts: { doctorId: number; shiftId: number; workDate: string; isOverride?: boolean },
  doctor: DoctorWithRoles,
  shift:  ShiftBasic,
): Promise<BatchDayResult> {
  const workDate = parseDate(opts.workDate)
  const today    = new Date(); today.setUTCHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)

  if (workDate < today)
    return { workDate: opts.workDate, valid: false, error: 'Ngày đã qua' }

  if (workDate < tomorrow && !opts.isOverride)
    return { workDate: opts.workDate, valid: false, error: 'Phải đăng ký trước ít nhất 1 ngày (bật khẩn cấp để bỏ qua)' }

  const applyDay  = jsToApplyDay(workDate.getUTCDay())
  const shiftDays = shift.applyDays as number[]
  if (!shiftDays.includes(applyDay))
    return { workDate: opts.workDate, valid: false, error: `Ca "${shift.name}" không hoạt động vào ${VN_DAY[applyDay] ?? 'ngày này'}` }

  const holidaysOnDay = await getHolidaysForDateRange(workDate, workDate)
  for (const h of holidaysOnDay) {
    if (isShiftBlockedByHoliday(shift.startTime, shift.endTime, h)) {
      const timeInfo = (h.type !== 'NATIONAL' && h.startTime && h.endTime)
        ? ` (${h.startTime}–${h.endTime})` : ''
      return { workDate: opts.workDate, valid: false, error: `Ngày nghỉ "${h.name}"${timeInfo}` }
    }
  }

  const dayEnd = new Date(workDate); dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)
  const sameDayCount = await prisma.doctorSchedule.count({
    where: { doctorId: opts.doctorId, workDate: { gte: workDate, lt: dayEnd } },
  })
  if (sameDayCount >= 2)
    return { workDate: opts.workDate, valid: false, error: `BS. ${doctor.fullName} đã có 2 ca trong ngày (tối đa 2 ca/ngày)` }

  const dup = await prisma.doctorSchedule.findFirst({
    where: { doctorId: opts.doctorId, shiftId: opts.shiftId, workDate },
  })
  if (dup)
    return { workDate: opts.workDate, valid: false, error: `Đã tồn tại lịch trực ca này ngày ${opts.workDate}` }

  return { workDate: opts.workDate, valid: true }
}

/** Xem trước — kiểm tra từng ngày, chưa lưu vào DB */
export const previewScheduleBatch = async (data: BatchScheduleInput) => {
  if (!data.workDates?.length)
    throw { status: 400, message: 'Vui lòng chọn ít nhất 1 ngày' }

  const [doctor, shift] = await Promise.all([
    prisma.user.findUnique({ where: { id: data.doctorId }, include: { roles: { include: { role: true } } } }),
    prisma.workShift.findUnique({ where: { id: data.shiftId } }),
  ])
  if (!doctor || !doctor.isActive)
    throw { status: 404, message: 'Bác sĩ không tồn tại hoặc đã bị khóa' }
  if (!doctor.roles.some(r => r.role.name === 'DOCTOR'))
    throw { status: 400, message: 'Người dùng được chọn không phải bác sĩ' }
  if (!shift || !shift.isActive)
    throw { status: 404, message: 'Ca làm việc không tồn tại hoặc đã tắt' }

  const results: BatchDayResult[] = []
  for (const workDate of data.workDates) {
    results.push(await validateOneDayForBatch(
      { doctorId: data.doctorId, shiftId: data.shiftId, workDate, isOverride: data.isOverride },
      doctor, shift,
    ))
  }
  return {
    doctorName: doctor.fullName,
    shiftName:  shift.name,
    results,
    validCount: results.filter(r => r.valid).length,
    errorCount: results.filter(r => !r.valid).length,
  }
}

/** Lưu hàng loạt sau khi Admin xác nhận bảng xem trước */
export const createScheduleBatch = async (
  data: BatchScheduleInput & { confirmedDates: string[] },
  adminId: number,
  ip: string,
) => {
  if (!data.confirmedDates?.length)
    throw { status: 400, message: 'Không có ngày nào được xác nhận để lưu' }

  const [doctor, shift] = await Promise.all([
    prisma.user.findUnique({ where: { id: data.doctorId }, include: { roles: { include: { role: true } } } }),
    prisma.workShift.findUnique({ where: { id: data.shiftId } }),
  ])
  if (!doctor || !doctor.isActive)
    throw { status: 404, message: 'Bác sĩ không tồn tại hoặc đã bị khóa' }
  if (!doctor.roles.some(r => r.role.name === 'DOCTOR'))
    throw { status: 400, message: 'Người dùng được chọn không phải bác sĩ' }
  if (!shift || !shift.isActive)
    throw { status: 404, message: 'Ca làm việc không tồn tại hoặc đã tắt' }

  const created: ReturnType<typeof formatSchedule>[] = []
  const errors:  BatchDayResult[] = []

  for (const workDate of data.confirmedDates) {
    // Tái validate tại thời điểm lưu để chống race condition
    const v = await validateOneDayForBatch(
      { doctorId: data.doctorId, shiftId: data.shiftId, workDate, isOverride: data.isOverride },
      doctor, shift,
    )
    if (!v.valid) { errors.push(v); continue }

    try {
      const schedule = await prisma.doctorSchedule.create({
        data: {
          doctorId:       data.doctorId,
          shiftId:        data.shiftId,
          workDate:       parseDate(workDate),
          serviceGroupId: data.serviceGroupId ?? null,
          note:           data.note?.trim() || null,
          isOverride:     data.isOverride ?? false,
          createdBy:      adminId,
        },
        include: INCLUDE,
      })
      created.push(formatSchedule(schedule))
    } catch {
      errors.push({ workDate, valid: false, error: 'Lỗi khi lưu, vui lòng thử lại' })
    }
  }

  if (created.length > 0) {
    await logAction(
      'CREATE_SCHEDULE_BATCH',
      `Phân công hàng loạt BS. ${doctor.fullName}: ${shift.name} — ${created.length} ngày (${created.map(s => s.workDate).join(', ')})${data.isOverride ? ' [OVERRIDE]' : ''}`,
      adminId, ip,
    )
  }
  return { created, errors, savedCount: created.length, failedCount: errors.length }
}
