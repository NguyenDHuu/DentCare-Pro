import { PrismaClient } from '@prisma/client'
import { logAction } from '../../utils/logger'

const prisma = new PrismaClient()

// ─── Helpers ─────────────────────────────────────────────────

/** "HH:MM" → minutes since midnight */
const toMin = (t: string): number => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Kiểm tra hai khoảng thời gian có giao nhau không */
const timesOverlap = (s1: string, e1: string, s2: string, e2: string): boolean =>
  toMin(s1) < toMin(e2) && toMin(e1) > toMin(s2)

/** Kiểm tra hai mảng ngày có chung ít nhất một ngày không */
const daysOverlap = (a: number[], b: number[]): boolean =>
  a.some(d => b.includes(d))

// ─── Validation ───────────────────────────────────────────────

export type ShiftInput = {
  name: string
  startTime: string
  endTime: string
  slotDuration: number
  bufferTime: number    // phút đệm giữa hai lịch hẹn (0/5/10/15)
  maxPatients: number   // số BN tối đa / bác sĩ / ca
  reserveSlots: number  // slot dự phòng cấp cứu / bác sĩ / ca
  applyDays: number[]
  colorCode?: string
  isActive?: boolean
}

const VALID_BUFFER = [0, 5, 10, 15]

const validate = (data: ShiftInput) => {
  if (!data.name?.trim())
    throw { status: 400, message: 'Tên ca không được để trống' }

  if (!/^\d{2}:\d{2}$/.test(data.startTime) || !/^\d{2}:\d{2}$/.test(data.endTime))
    throw { status: 400, message: 'Giờ bắt đầu / kết thúc không hợp lệ (định dạng HH:MM)' }

  if (toMin(data.startTime) >= toMin(data.endTime))
    throw { status: 400, message: '[E1] Giờ kết thúc phải lớn hơn giờ bắt đầu' }

  if (!Number.isInteger(data.slotDuration) || data.slotDuration < 10)
    throw { status: 400, message: 'Độ dài slot cơ bản tối thiểu là 10 phút' }

  if (!VALID_BUFFER.includes(data.bufferTime ?? 0))
    throw { status: 400, message: 'Thời gian đệm phải là 0, 5, 10 hoặc 15 phút' }

  if (!Number.isInteger(data.maxPatients) || data.maxPatients < 1)
    throw { status: 400, message: 'Số bệnh nhân tối đa / bác sĩ / ca phải ít nhất là 1' }

  if (!Number.isInteger(data.reserveSlots) || data.reserveSlots < 0)
    throw { status: 400, message: 'Số slot dự phòng không được âm' }

  if (!Array.isArray(data.applyDays) || data.applyDays.length === 0)
    throw { status: 400, message: 'Phải chọn ít nhất một ngày trong tuần' }

  const validDays = [0, 2, 3, 4, 5, 6, 7]
  if (!data.applyDays.every(d => validDays.includes(d)))
    throw { status: 400, message: 'Ngày trong tuần không hợp lệ' }
}

// ─── UC06: CRUD ───────────────────────────────────────────────

export const getShifts = async () =>
  prisma.workShift.findMany({ orderBy: { createdAt: 'asc' } })

export const createShift = async (
  data: ShiftInput,
  adminId: number,
  ip: string
) => {
  validate(data)

  const dup = await prisma.workShift.findUnique({ where: { name: data.name.trim() } })
  if (dup) throw { status: 409, message: 'Tên ca làm việc đã tồn tại' }

  // [E2] kiểm tra trùng khung giờ trong cùng ngày
  const existing = await prisma.workShift.findMany()
  for (const s of existing) {
    const sDays = s.applyDays as number[]
    if (
      daysOverlap(data.applyDays, sDays) &&
      timesOverlap(data.startTime, data.endTime, s.startTime, s.endTime)
    ) {
      throw {
        status: 409,
        message: `[E2] Trùng khung giờ với ca "${s.name}" (${s.startTime}–${s.endTime}). Vui lòng điều chỉnh.`,
      }
    }
  }

  const shift = await prisma.workShift.create({
    data: {
      name:         data.name.trim(),
      startTime:    data.startTime,
      endTime:      data.endTime,
      slotDuration: data.slotDuration,
      bufferTime:   data.bufferTime  ?? 0,
      maxPatients:  data.maxPatients,
      reserveSlots: data.reserveSlots ?? 1,
      applyDays:    data.applyDays,
      colorCode:    data.colorCode || 'blue',
      isActive:     true,
    },
  })

  await logAction(
    'CREATE_SHIFT',
    `Tạo ca làm việc: ${shift.name} (${shift.startTime}–${shift.endTime})`,
    adminId, ip
  )
  return shift
}

export const updateShift = async (
  id: number,
  data: ShiftInput,
  adminId: number,
  ip: string
) => {
  validate(data)

  const shift = await prisma.workShift.findUnique({ where: { id } })
  if (!shift) throw { status: 404, message: 'Không tìm thấy ca làm việc' }

  if (data.name.trim() !== shift.name) {
    const dup = await prisma.workShift.findUnique({ where: { name: data.name.trim() } })
    if (dup) throw { status: 409, message: 'Tên ca làm việc đã tồn tại' }
  }

  // [E2] kiểm tra trùng khung giờ (bỏ qua bản thân)
  const others = await prisma.workShift.findMany({ where: { id: { not: id } } })
  for (const s of others) {
    const sDays = s.applyDays as number[]
    if (
      daysOverlap(data.applyDays, sDays) &&
      timesOverlap(data.startTime, data.endTime, s.startTime, s.endTime)
    ) {
      throw {
        status: 409,
        message: `[E2] Trùng khung giờ với ca "${s.name}" (${s.startTime}–${s.endTime}). Vui lòng điều chỉnh.`,
      }
    }
  }

  await prisma.workShift.update({
    where: { id },
    data: {
      name:         data.name.trim(),
      startTime:    data.startTime,
      endTime:      data.endTime,
      slotDuration: data.slotDuration,
      bufferTime:   data.bufferTime  ?? shift.bufferTime,
      maxPatients:  data.maxPatients,
      reserveSlots: data.reserveSlots ?? shift.reserveSlots,
      applyDays:    data.applyDays,
      colorCode:    data.colorCode ?? shift.colorCode,
    },
  })

  await logAction(
    'UPDATE_SHIFT',
    `Cập nhật ca: "${shift.name}" → "${data.name.trim()}" (${data.startTime}–${data.endTime})`,
    adminId, ip
  )
}

export const deleteShift = async (id: number, adminId: number, ip: string) => {
  const shift = await prisma.workShift.findUnique({ where: { id } })
  if (!shift) throw { status: 404, message: 'Không tìm thấy ca làm việc' }

  // TODO (UC08/UC01): kiểm tra lịch trực / lịch hẹn phụ thuộc trước khi xóa

  await prisma.workShift.delete({ where: { id } })
  await logAction('DELETE_SHIFT', `Xóa ca làm việc: ${shift.name}`, adminId, ip)
}

export const toggleShift = async (id: number, adminId: number, ip: string) => {
  const shift = await prisma.workShift.findUnique({ where: { id } })
  if (!shift) throw { status: 404, message: 'Không tìm thấy ca làm việc' }

  const newActive = !shift.isActive
  await prisma.workShift.update({ where: { id }, data: { isActive: newActive } })

  await logAction(
    'TOGGLE_SHIFT',
    `${shift.name}: ${shift.isActive ? 'Tắt' : 'Bật'} ca làm việc`,
    adminId, ip
  )
  return { isActive: newActive }
}
