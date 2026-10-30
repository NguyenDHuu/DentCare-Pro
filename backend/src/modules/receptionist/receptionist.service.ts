import { PrismaClient } from '@prisma/client'
import { sendSmsEsms } from '../sms/sms.gateway'

const prisma = new PrismaClient()

// ─── Helpers ─────────────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Monday of the week containing `date` */
function getWeekMonday(date: Date): Date {
  const d = new Date(date); d.setHours(0, 0, 0, 0)
  const dow = d.getDay()                   // 0=Sun
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  return d
}

/** Generate slot times from a shift's config */
function generateSlotTimes(
  startTime: string, endTime: string,
  slotDuration: number, bufferTime: number,
): string[] {
  const [sH, sM] = startTime.split(':').map(Number)
  const [eH, eM] = endTime.split(':').map(Number)
  const endMins  = eH * 60 + eM
  const times: string[] = []
  let h = sH, m = sM
  while (h * 60 + m < endMins) {
    times.push(`${pad2(h)}:${pad2(m)}`)
    m += slotDuration + bufferTime
    if (m >= 60) { h += Math.floor(m / 60); m %= 60 }
  }
  return times
}

// ─── Patient lookup ──────────────────────────────────────────

export const lookupPatient = async (phone: string) => {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) return null
  return prisma.appointment.findFirst({
    where:   { patientPhone: { contains: digits } },
    orderBy: { createdAt: 'desc' },
    select:  { patientName: true, patientPhone: true, patientDob: true, patientGender: true },
  })
}

// ─── Active services ──────────────────────────────────────────

export const getBookingServices = async () =>
  prisma.service.findMany({
    where:   { status: 'ACTIVE' },
    select:  { id: true, code: true, name: true, duration: true },
    orderBy: { name: 'asc' },
  })

// ─── Doctors: week-level availability by service GROUP ────────
//
// Shows ALL doctors mapped to the service's group, regardless of
// whether they have a DoctorSchedule this week.
//
// availability:
//   FREE        = scheduled, no bookings yet  → green dot
//   BUSY        = scheduled, some bookings    → yellow dot
//   FULL        = scheduled, no free slots    → red dot
//   UNSCHEDULED = no schedule this week, but can be booked (auto-assign) → blue dot
//
// Fallback: if the service group has NO doctors mapped at all,
// show all doctors who have a DoctorSchedule this week.

export const getDoctorsWeekAvailability = async (serviceId: number, weekStart: string) => {
  const mon = getWeekMonday(new Date(weekStart))
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23, 59, 59, 999)

  // Load service + service group + all mapped doctors
  const service = await prisma.service.findUnique({
    where:   { id: serviceId },
    include: {
      serviceGroup: {
        include: {
          doctors: {
            include: { doctor: { select: { id: true, fullName: true } } },
          },
        },
      },
    },
  })
  if (!service) throw { status: 404, message: 'Dịch vụ không tìm thấy' }

  const groupDoctors    = service.serviceGroup?.doctors ?? []
  const groupDoctorIds  = groupDoctors.map(d => d.doctorId)
  const serviceGroupName = service.serviceGroup?.name ?? service.name

  // ── Case A: group has doctors mapped ─────────────────────────
  if (groupDoctorIds.length > 0) {
    const [schedules, appointments] = await Promise.all([
      prisma.doctorSchedule.findMany({
        where:   { doctorId: { in: groupDoctorIds }, workDate: { gte: mon, lte: sun } },
        include: { shift: true },
        orderBy: { workDate: 'asc' },
      }),
      prisma.appointment.findMany({
        where: {
          doctorId:        { in: groupDoctorIds },
          appointmentDate: { gte: mon, lte: sun },
          status:          { notIn: ['CANCELLED', 'ABSENT'] },
        },
        select: { doctorId: true, appointmentDate: true },
      }),
    ])

    // For each doctor in the group, aggregate week stats
    const calcDoctor = (doctorId: number, fullName: string) => {
      const docSchedules = schedules.filter(s => s.doctorId === doctorId)

      // No schedule this week → UNSCHEDULED (can book any shift, auto-assign)
      if (docSchedules.length === 0) {
        return {
          id: doctorId, name: fullName,
          totalSlots: 0, bookedSlots: 0, freeSlots: -1,
          availability: 'UNSCHEDULED' as string,
          nextAvailableDate: null, nextAvailableTime: null,
        }
      }

      let totalSlots = 0, bookedSlots = 0
      let nextAvailableDate: string | null = null
      let nextAvailableTime: string | null = null

      for (const sch of docSchedules) {
        const sh        = sch.shift
        const slotTimes = generateSlotTimes(sh.startTime, sh.endTime, sh.slotDuration, sh.bufferTime)
        const maxEff    = sh.maxPatients - sh.reserveSlots
        const workDay   = new Date(sch.workDate)
        const ds = new Date(workDay); ds.setHours(0, 0, 0, 0)
        const de = new Date(workDay); de.setHours(23, 59, 59, 999)

        const bookedTimes = new Set(
          appointments
            .filter(a => a.doctorId === doctorId && new Date(a.appointmentDate) >= ds && new Date(a.appointmentDate) <= de)
            .map(a => { const t = new Date(a.appointmentDate); return `${pad2(t.getHours())}:${pad2(t.getMinutes())}` })
        )

        const shiftBooked = slotTimes.filter(t => bookedTimes.has(t)).length
        const shiftFree   = Math.max(0, slotTimes.filter(t => !bookedTimes.has(t)).length - sh.reserveSlots)

        totalSlots  += Math.min(slotTimes.length, maxEff)
        bookedSlots += shiftBooked

        if (shiftFree > 0 && !nextAvailableDate) {
          const firstFree = slotTimes.find(t => !bookedTimes.has(t))
          if (firstFree) {
            // Store local date string
            const wd = new Date(sch.workDate)
            nextAvailableDate = `${wd.getFullYear()}-${pad2(wd.getMonth()+1)}-${pad2(wd.getDate())}`
            nextAvailableTime = firstFree
          }
        }
      }

      const free = totalSlots - bookedSlots
      return {
        id:   doctorId, name: fullName,
        totalSlots, bookedSlots, freeSlots: free,
        availability: free === 0 ? 'FULL' : bookedSlots > 0 ? 'BUSY' : 'FREE' as string,
        nextAvailableDate, nextAvailableTime,
      }
    }

    const doctors = groupDoctors
      .map(gd => calcDoctor(gd.doctorId, gd.doctor.fullName))

    // Sort: FREE → BUSY → UNSCHEDULED → FULL
    const order = { FREE: 0, BUSY: 1, UNSCHEDULED: 2, FULL: 3 }
    doctors.sort((a, b) =>
      (order[a.availability as keyof typeof order] ?? 9) -
      (order[b.availability as keyof typeof order] ?? 9)
    )

    return { doctors, serviceName: service.name, serviceGroupName }
  }

  // ── Case B: no doctors mapped to group → fallback: all scheduled ──
  const schedules = await prisma.doctorSchedule.findMany({
    where:   { workDate: { gte: mon, lte: sun } },
    include: {
      doctor: { select: { id: true, fullName: true } },
      shift:  true,
    },
    orderBy: { workDate: 'asc' },
  })

  if (schedules.length === 0) return { doctors: [], serviceName: service.name, serviceGroupName }

  const allDocIds = [...new Set(schedules.map(s => s.doctorId))]
  const appointments = await prisma.appointment.findMany({
    where: { doctorId: { in: allDocIds }, appointmentDate: { gte: mon, lte: sun }, status: { notIn: ['CANCELLED', 'ABSENT'] } },
    select: { doctorId: true, appointmentDate: true },
  })

  type DocInfo = { id: number; name: string; totalSlots: number; bookedSlots: number; nextDate: string|null; nextTime: string|null }
  const docMap = new Map<number, DocInfo>()
  for (const sch of schedules) {
    if (!docMap.has(sch.doctorId))
      docMap.set(sch.doctorId, { id: sch.doctorId, name: sch.doctor.fullName, totalSlots: 0, bookedSlots: 0, nextDate: null, nextTime: null })
    const doc       = docMap.get(sch.doctorId)!
    const sh        = sch.shift
    const slotTimes = generateSlotTimes(sh.startTime, sh.endTime, sh.slotDuration, sh.bufferTime)
    const maxEff    = sh.maxPatients - sh.reserveSlots
    const ds = new Date(sch.workDate); ds.setHours(0,0,0,0)
    const de = new Date(ds); de.setHours(23,59,59,999)
    const bookedTimes = new Set(
      appointments.filter(a => a.doctorId === sch.doctorId && new Date(a.appointmentDate) >= ds && new Date(a.appointmentDate) <= de)
        .map(a => { const t = new Date(a.appointmentDate); return `${pad2(t.getHours())}:${pad2(t.getMinutes())}` })
    )
    doc.totalSlots  += Math.min(slotTimes.length, maxEff)
    doc.bookedSlots += slotTimes.filter(t => bookedTimes.has(t)).length
    if (!doc.nextDate) {
      const first = slotTimes.find(t => !bookedTimes.has(t))
      if (first) {
        const wd = new Date(sch.workDate)
        doc.nextDate = `${wd.getFullYear()}-${pad2(wd.getMonth()+1)}-${pad2(wd.getDate())}`
        doc.nextTime = first
      }
    }
  }

  const order2 = { FREE: 0, BUSY: 1, FULL: 2 }
  const doctors2 = [...docMap.values()].map(d => {
    const free = d.totalSlots - d.bookedSlots
    return { id: d.id, name: d.name, totalSlots: d.totalSlots, bookedSlots: d.bookedSlots, freeSlots: free, availability: free === 0 ? 'FULL' : d.bookedSlots > 0 ? 'BUSY' : 'FREE' as string, nextAvailableDate: d.nextDate, nextAvailableTime: d.nextTime }
  }).sort((a,b) => (order2[a.availability as keyof typeof order2]??9) - (order2[b.availability as keyof typeof order2]??9))

  return { doctors: doctors2, serviceName: service.name, serviceGroupName }
}

// ─── Doctor weekly timeline ──────────────────────────────────
//
// Returns a 7-day (Mon–Sun) calendar for a doctor showing:
//  - days with assigned shifts (scheduled)
//  - booked / available slots per shift
//  - days without schedule (unscheduled) → show all active shifts,
//    booking here will auto-create DoctorSchedule

export const getDoctorWeekTimeline = async (doctorId: number, weekStart: string) => {
  const mon = getWeekMonday(new Date(weekStart))
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23, 59, 59, 999)
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const [schedules, appointments, allShifts] = await Promise.all([
    prisma.doctorSchedule.findMany({
      where:   { doctorId, workDate: { gte: mon, lte: sun } },
      include: { shift: true },
      orderBy: { workDate: 'asc' },
    }),
    prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: { gte: mon, lte: sun },
        status: { notIn: ['CANCELLED', 'ABSENT'] },
      },
      select: { appointmentDate: true, patientName: true, status: true },
      orderBy: { appointmentDate: 'asc' },
    }),
    prisma.workShift.findMany({ where: { isActive: true }, orderBy: { startTime: 'asc' } }),
  ])

  const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day      = new Date(mon); day.setDate(mon.getDate() + i)
    const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0)
    const dayEnd   = new Date(day); dayEnd.setHours(23, 59, 59, 999)
    const dateStr  = day.toISOString().slice(0, 10)
    const isToday  = day.getTime() === today.getTime()
    const isPast   = day < today

    const dayScheds = schedules.filter(s => {
      const sd = new Date(s.workDate); sd.setHours(0, 0, 0, 0)
      return sd.getTime() === day.getTime()
    })

    const dayApts = appointments.filter(a => {
      const ad = new Date(a.appointmentDate)
      return ad >= dayStart && ad <= dayEnd
    })

    const bookedMap = new Map<string, string>()
    for (const apt of dayApts) {
      const t = new Date(apt.appointmentDate)
      bookedMap.set(`${pad2(t.getHours())}:${pad2(t.getMinutes())}`, apt.patientName)
    }

    const buildShiftData = (sh: typeof allShifts[0], isUnscheduled: boolean) => {
      const slotTimes = generateSlotTimes(sh.startTime, sh.endTime, sh.slotDuration, sh.bufferTime)
      const maxEff    = sh.maxPatients - sh.reserveSlots

      const slots = slotTimes.map(time => ({
        time,
        available: !bookedMap.has(time),
        patientName: bookedMap.get(time),
      }))

      const bookedCount = isUnscheduled ? 0 : slots.filter(s => !s.available).length
      const freeCount   = isUnscheduled
        ? maxEff
        : Math.max(0, slots.filter(s => s.available).length - sh.reserveSlots)
      const pct         = maxEff > 0 ? bookedCount / maxEff : 0

      return {
        shiftId:     sh.id,
        name:        sh.name,
        startTime:   sh.startTime,
        endTime:     sh.endTime,
        colorCode:   sh.colorCode,
        bookedCount,
        maxPatients: maxEff,
        freeCount,
        isUnscheduled,
        status:      isUnscheduled ? 'UNSCHEDULED'
                    : pct >= 1     ? 'FULL'
                    : bookedCount > 0 ? 'BUSY'
                    : 'FREE' as string,
        slots: isUnscheduled ? slotTimes.map(time => ({ time, available: true })) : slots,
      }
    }

    // Scheduled shifts
    const shifts = dayScheds.map(sch => buildShiftData(sch.shift, false))

    // Unscheduled: future days with no schedule → show all active shifts (any is bookable)
    const unscheduledShifts = (!isPast && dayScheds.length === 0)
      ? allShifts.map(sh => buildShiftData(sh, true))
      : []

    const totalFree   = shifts.reduce((s, sh) => s + sh.freeCount, 0)
    const totalBooked = shifts.reduce((s, sh) => s + sh.bookedCount, 0)

    return {
      date:             dateStr,
      dayLabel:         DAY_LABELS[day.getDay()],
      displayDate:      `${pad2(day.getDate())}/${pad2(day.getMonth() + 1)}`,
      isToday,
      isPast,
      hasSchedule:      dayScheds.length > 0,
      shifts,
      unscheduledShifts,
      totalFree,
      totalBooked,
    }
  })

  return { weekDays }
}

// ─── Create appointment (with auto DoctorSchedule) ───────────

export const createAppointment = async (
  data: {
    patientName:     string
    patientPhone:    string
    patientDob?:     string | null
    patientGender?:  string | null
    note?:           string | null
    doctorId?:       number | null
    serviceId?:      number | null
    appointmentDate: string    // ISO datetime e.g. "2026-06-02T08:30"
    shiftId?:        number | null  // required when booking into unscheduled shift
  },
  createdBy: number,
) => {
  if (!data.patientName?.trim())
    throw { status: 400, message: 'Họ tên bệnh nhân không được để trống' }
  const digits = data.patientPhone?.replace(/\D/g, '')
  if (!digits || digits.length < 7)
    throw { status: 400, message: 'Số điện thoại không hợp lệ (tối thiểu 7 chữ số)' }

  const aDate = new Date(data.appointmentDate)
  if (isNaN(aDate.getTime()))
    throw { status: 400, message: 'Ngày giờ hẹn không hợp lệ' }

  // Conflict check
  if (data.doctorId) {
    const conflict = await prisma.appointment.findFirst({
      where: { doctorId: data.doctorId, appointmentDate: aDate, status: { notIn: ['CANCELLED', 'ABSENT'] } },
    })
    if (conflict) throw { status: 409, message: 'Khung giờ này đã có bệnh nhân khác đặt' }
  }

  // Auto-generate code LH001, LH002, …
  const last = await prisma.appointment.findFirst({ orderBy: { id: 'desc' }, select: { code: true } })
  const num  = last ? parseInt(last.code.replace('LH', ''), 10) + 1 : 1
  const code = `LH${String(num).padStart(3, '0')}`

  const appointment = await prisma.appointment.create({
    data: {
      code,
      patientName:     data.patientName.trim(),
      patientPhone:    digits,
      patientDob:      data.patientDob   ? new Date(data.patientDob) : null,
      patientGender:   data.patientGender || null,
      note:            data.note?.trim() || null,
      doctorId:        data.doctorId    || null,
      serviceId:       data.serviceId   || null,
      appointmentDate: aDate,
      status:          'PENDING',
      createdBy,
    },
    include: {
      doctor:  { select: { fullName: true } },
      service: { select: { name: true } },
    },
  })

  // ── Auto-create DoctorSchedule if booking into unscheduled day ──
  if (data.doctorId && data.shiftId) {
    const aDay    = new Date(aDate); aDay.setHours(0, 0, 0, 0)
    const aDayEnd = new Date(aDay);  aDayEnd.setHours(23, 59, 59, 999)

    const existingSchedule = await prisma.doctorSchedule.findFirst({
      where: { doctorId: data.doctorId, shiftId: data.shiftId, workDate: { gte: aDay, lte: aDayEnd } },
    })

    if (!existingSchedule) {
      try {
        await prisma.doctorSchedule.create({
          data: {
            doctorId:  data.doctorId,
            shiftId:   data.shiftId,
            workDate:  aDay,
            createdBy,
          },
        })
      } catch { /* ignore duplicate - another request may have created it */ }
    }
  } else if (data.doctorId && !data.shiftId) {
    // shiftId not provided → find matching shift by time
    const aDay    = new Date(aDate); aDay.setHours(0, 0, 0, 0)
    const aDayEnd = new Date(aDay);  aDayEnd.setHours(23, 59, 59, 999)

    const existingSchedule = await prisma.doctorSchedule.findFirst({
      where: { doctorId: data.doctorId, workDate: { gte: aDay, lte: aDayEnd } },
    })

    if (!existingSchedule) {
      const aptH = aDate.getHours(), aptM = aDate.getMinutes()
      const aptMins = aptH * 60 + aptM
      const shifts = await prisma.workShift.findMany({ where: { isActive: true } })
      const match  = shifts.find(sh => {
        const [sH, sM] = sh.startTime.split(':').map(Number)
        const [eH, eM] = sh.endTime.split(':').map(Number)
        return aptMins >= sH * 60 + sM && aptMins < eH * 60 + eM
      })
      if (match) {
        try {
          await prisma.doctorSchedule.create({
            data: { doctorId: data.doctorId, shiftId: match.id, workDate: aDay, createdBy },
          })
        } catch { /* ignore duplicate */ }
      }
    }
  }

  return appointment
}

// ─── Backward compat: per-day doctors (still used internally) ─

export const getDoctorsForBooking = getDoctorsWeekAvailability

// ════════════════════════════════════════════════════════════════
// UC05 – Tra cứu lịch hẹn (list + detail)
// ════════════════════════════════════════════════════════════════

export const listAppointments = async (params: {
  tab?:      string   // 'all' | 'today' | 'upcoming'
  status?:   string
  doctorId?: number
  search?:   string
  page?:     number
  limit?:    number
}) => {
  const page  = Math.max(1, params.page  ?? 1)
  const limit = Math.min(50, params.limit ?? 20)
  const skip  = (page - 1) * limit

  const now       = new Date()
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0)
  const todayEnd   = new Date(now); todayEnd.setHours(23,59,59,999)

  // Build date filter
  let dateFilter: Record<string, Date> | undefined
  if (params.tab === 'today') {
    dateFilter = { gte: todayStart, lte: todayEnd }
  } else if (params.tab === 'upcoming') {
    const tomorrow = new Date(todayStart); tomorrow.setDate(todayStart.getDate() + 1)
    dateFilter = { gte: tomorrow }
  }

  // Build status filter
  const statusFilter = params.status && params.status !== 'ALL'
    ? { status: params.status }
    : {}

  // Build doctor filter
  const doctorFilter = params.doctorId ? { doctorId: params.doctorId } : {}

  // Build search filter
  let searchFilter: object = {}
  if (params.search?.trim()) {
    const q = params.search.trim()
    searchFilter = {
      OR: [
        { code:         { contains: q } },
        { patientName:  { contains: q } },
        { patientPhone: { contains: q } },
        { doctor:       { fullName: { contains: q } } },
      ],
    }
  }

  const where = {
    ...(dateFilter ? { appointmentDate: dateFilter } : {}),
    ...statusFilter,
    ...doctorFilter,
    ...searchFilter,
  }

  const [total, items] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.findMany({
      where,
      orderBy: { appointmentDate: 'asc' },
      skip,
      take: limit,
      include: {
        doctor:  { select: { id: true, fullName: true } },
        service: { select: { id: true, name: true } },
      },
    }),
  ])

  // Status counts for tabs
  const [allCount, todayCount, upcomingCount] = await Promise.all([
    prisma.appointment.count(),
    prisma.appointment.count({ where: { appointmentDate: { gte: todayStart, lte: todayEnd } } }),
    prisma.appointment.count({ where: { appointmentDate: { gte: new Date(todayStart.getTime() + 86400000) } } }),
  ])

  // Status breakdown counts (filtered by current tab date)
  const statusCounts = await prisma.appointment.groupBy({
    by: ['status'],
    where: dateFilter ? { appointmentDate: dateFilter } : {},
    _count: { id: true },
  })

  return {
    items: items.map(a => ({
      id:              a.id,
      code:            a.code,
      patientName:     a.patientName,
      patientPhone:    a.patientPhone,
      patientDob:      a.patientDob ? a.patientDob.toISOString().slice(0, 10) : null,
      patientGender:   a.patientGender,
      note:            a.note,
      cancelReason:    a.cancelReason,
      status:          a.status,
      appointmentDate: a.appointmentDate.toISOString(),
      doctorId:        a.doctorId,
      doctorName:      a.doctor?.fullName ?? null,
      serviceId:       a.serviceId,
      serviceName:     a.service?.name ?? null,
      createdAt:       a.createdAt.toISOString(),
      updatedAt:       a.updatedAt.toISOString(),
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    tabCounts:  { all: allCount, today: todayCount, upcoming: upcomingCount },
    statusCounts: Object.fromEntries(statusCounts.map(s => [s.status, s._count.id])),
  }
}

export const getAppointmentById = async (id: number) => {
  const a = await prisma.appointment.findUnique({
    where: { id },
    include: {
      doctor:  { select: { id: true, fullName: true } },
      service: { select: { id: true, name: true } },
      creator: { select: { id: true, fullName: true } },
    },
  })
  if (!a) throw { status: 404, message: 'Lịch hẹn không tồn tại' }
  // Flatten to same shape as listAppointments items
  return {
    id:              a.id,
    code:            a.code,
    patientName:     a.patientName,
    patientPhone:    a.patientPhone,
    patientDob:      a.patientDob ? a.patientDob.toISOString().slice(0, 10) : null,
    patientGender:   a.patientGender,
    note:            a.note,
    cancelReason:    a.cancelReason,
    status:          a.status,
    appointmentDate: a.appointmentDate.toISOString(),
    doctorId:        a.doctorId,
    doctorName:      a.doctor?.fullName ?? null,
    serviceId:       a.serviceId,
    serviceName:     a.service?.name ?? null,
    creator:         a.creator ?? null,
    createdAt:       a.createdAt.toISOString(),
    updatedAt:       a.updatedAt.toISOString(),
  }
}

// ════════════════════════════════════════════════════════════════
// UC02 – Cập nhật lịch hẹn
// ════════════════════════════════════════════════════════════════

// Terminal statuses — cannot be edited
const TERMINAL = ['COMPLETED', 'ABSENT', 'CANCELLED', 'IN_PROGRESS', 'CHECKED_IN']

export const updateAppointment = async (
  id: number,
  data: {
    patientName?:    string
    patientPhone?:   string
    patientDob?:     string | null
    patientGender?:  string | null
    note?:           string | null
    doctorId?:       number | null
    serviceId?:      number | null
    appointmentDate?: string  // "YYYY-MM-DDTHH:MM"
    status?:         string
  },
  updatedBy: number,
) => {
  const existing = await prisma.appointment.findUnique({
    where: { id },
    include: { doctor: { select: { fullName: true } } },
  })
  if (!existing) throw { status: 404, message: 'Lịch hẹn không tồn tại' }
  if (TERMINAL.includes(existing.status))
    throw { status: 400, message: `Không thể cập nhật lịch hẹn ở trạng thái "${existing.status}"` }

  // Parse new appointment date if provided
  let newDate: Date | undefined
  if (data.appointmentDate) {
    newDate = new Date(data.appointmentDate)
    if (isNaN(newDate.getTime())) throw { status: 400, message: 'Ngày giờ hẹn không hợp lệ' }

    // Cannot set past date (E4)
    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0)
    if (newDate < todayMidnight) throw { status: 400, message: 'Ngày khám không được nhỏ hơn ngày hiện tại' }

    // Conflict check (E2 optimistic) — exclude self
    const conflictDoctorId = data.doctorId ?? existing.doctorId
    if (conflictDoctorId) {
      const conflict = await prisma.appointment.findFirst({
        where: {
          id:              { not: id },
          doctorId:        conflictDoctorId,
          appointmentDate: newDate,
          status:          { notIn: ['CANCELLED', 'ABSENT'] },
        },
      })
      if (conflict) throw { status: 409, message: 'Khung giờ này đã có bệnh nhân khác đặt' }
    }
  }

  // Determine whether date/time changed → reset status to PENDING
  const dateChanged = newDate && newDate.getTime() !== existing.appointmentDate.getTime()

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      ...(data.patientName   ? { patientName:  data.patientName.trim()  } : {}),
      ...(data.patientPhone  ? { patientPhone: data.patientPhone.replace(/\D/g, '') } : {}),
      ...('patientDob'    in data ? { patientDob:   data.patientDob   ? new Date(data.patientDob)  : null } : {}),
      ...('patientGender' in data ? { patientGender: data.patientGender ?? null } : {}),
      ...('note'          in data ? { note:          data.note?.trim() ?? null  } : {}),
      ...('doctorId'      in data ? { doctorId:      data.doctorId  ?? null } : {}),
      ...('serviceId'     in data ? { serviceId:     data.serviceId ?? null } : {}),
      ...(newDate ? { appointmentDate: newDate } : {}),
      ...(dateChanged ? { status: 'PENDING' } : {}),
      ...(data.status && !dateChanged ? { status: data.status } : {}),
    },
    include: {
      doctor:  { select: { id: true, fullName: true } },
      service: { select: { id: true, name: true } },
    },
  })

  // Fire RESCHEDULE SMS when date/time changed (non-blocking)
  if (dateChanged) {
    sendAppointmentSms({
      patientName:     updated.patientName,
      patientPhone:    updated.patientPhone,
      appointmentDate: updated.appointmentDate,
      doctorName:      updated.doctor?.fullName,
    }, 'RESCHEDULE')
  }

  return updated
}

// ════════════════════════════════════════════════════════════════
// SMS helper – UC10
// ════════════════════════════════════════════════════════════════

/** Format a Date to "HH:MM DD/MM/YYYY" in local time */
function fmtDateTime(d: Date): { date: string; time: string } {
  const date = `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}`
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  return { date, time }
}

/**
 * Send an SMS notification for an appointment event.
 * Fails silently — never throws; logs result to SmsLog.
 *
 * Supported templateType: CONFIRM_BOOKING | CANCEL | RESCHEDULE
 */
async function sendAppointmentSms(
  apt: {
    patientName:     string
    patientPhone:    string
    appointmentDate: Date
    doctorName?:     string | null
  },
  templateType: string,
): Promise<void> {
  try {
    // Get config + template
    const [cfg, tpl] = await Promise.all([
      prisma.smsConfig.findUnique({ where: { id: 1 } }),
      prisma.smsTemplate.findUnique({ where: { type: templateType } }),
    ])

    // If SMS disabled or template disabled/missing → skip
    if (!cfg || !tpl?.isEnabled) return

    const { date, time } = fmtDateTime(apt.appointmentDate)

    // Build content from template
    const content = tpl.content
      .replace(/\[Ngày\]/g,   date)
      .replace(/\[Giờ\]/g,    time)
      .replace(/\[Bác sĩ\]/g, apt.doctorName ? `BS. ${apt.doctorName}` : 'bác sĩ')
      .replace(/\[Tên BN\]/g, apt.patientName)

    const digits = apt.patientPhone.replace(/\D/g, '')

    let status:   'SUCCESS' | 'FAILED' = 'FAILED'
    let errorMsg: string | undefined
    let sentAt:   Date | undefined

    const hasCredentials = cfg.isEnabled && cfg.apiKey && cfg.secretKey

    if (hasCredentials) {
      const result = await sendSmsEsms(digits, content, {
        apiKey:    cfg.apiKey!,
        secretKey: cfg.secretKey!,
        brandname: cfg.brandname,
      })
      status   = result.success ? 'SUCCESS' : 'FAILED'
      errorMsg = result.success ? undefined : result.message
      sentAt   = result.success ? new Date() : undefined
    } else {
      // No credentials → simulate success (for dev/staging)
      status = 'SUCCESS'
      sentAt = new Date()
    }

    await prisma.smsLog.create({
      data: {
        recipientName: apt.patientName,
        phone:         digits,
        type:          templateType,
        status,
        content,
        sentAt,
        errorMsg,
        retryCount:    0,
      },
    })
  } catch {
    // Never let SMS errors block the main flow
  }
}

// ════════════════════════════════════════════════════════════════
// UC04 – Cập nhật trạng thái lịch hẹn
// ════════════════════════════════════════════════════════════════

// Valid forward transitions
// PENDING     → CONFIRMED (lễ tân xác nhận) | CANCELLED | ABSENT
// CONFIRMED   → CHECKED_IN (bệnh nhân đến, lễ tân check-in) | CANCELLED | ABSENT
// CHECKED_IN  → IN_PROGRESS (bác sĩ bắt đầu khám – sẽ dùng ở trang bác sĩ)
// IN_PROGRESS → COMPLETED (bác sĩ kết thúc)
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING:     ['CONFIRMED', 'CANCELLED', 'ABSENT'],
  CONFIRMED:   ['CHECKED_IN', 'CANCELLED', 'ABSENT'],
  CHECKED_IN:  ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED:   [],
  ABSENT:      [],
  CANCELLED:   [],
}

// Which status change triggers which SMS template
const STATUS_SMS: Record<string, string> = {
  CONFIRMED:  'CONFIRM_BOOKING',
  CHECKED_IN: 'CHECKIN',   // optional template – skipped silently if not found
}

export const updateAppointmentStatus = async (
  id: number,
  newStatus: string,
  updatedBy: number,
) => {
  const existing = await prisma.appointment.findUnique({
    where: { id },
    include: { doctor: { select: { fullName: true } } },
  })
  if (!existing) throw { status: 404, message: 'Lịch hẹn không tồn tại' }

  const allowed = VALID_TRANSITIONS[existing.status] ?? []
  if (!allowed.includes(newStatus))
    throw { status: 400, message: `Không thể chuyển từ trạng thái "${existing.status}" sang "${newStatus}"` }

  const updated = await prisma.appointment.update({
    where: { id },
    data:  { status: newStatus },
    include: {
      doctor:  { select: { id: true, fullName: true } },
      service: { select: { id: true, name: true } },
    },
  })

  // Fire SMS (non-blocking) for status changes that notify the patient
  const smsTpl = STATUS_SMS[newStatus]
  if (smsTpl) {
    sendAppointmentSms({
      patientName:     existing.patientName,
      patientPhone:    existing.patientPhone,
      appointmentDate: existing.appointmentDate,
      doctorName:      existing.doctor?.fullName,
    }, smsTpl)
  }

  return updated
}

// ════════════════════════════════════════════════════════════════
// UC03 – Hủy lịch hẹn
// ════════════════════════════════════════════════════════════════

export const cancelAppointment = async (
  id: number,
  reason: string,
  cancelledBy: number,
) => {
  const existing = await prisma.appointment.findUnique({
    where: { id },
    include: { doctor: { select: { fullName: true } } },
  })
  if (!existing) throw { status: 404, message: 'Lịch hẹn không tồn tại' }

  if (!['PENDING', 'CONFIRMED'].includes(existing.status))
    throw { status: 400, message: `Không thể hủy lịch hẹn đang ở trạng thái "${existing.status}"` }

  if (!reason?.trim()) throw { status: 400, message: 'Lý do hủy là bắt buộc' }

  const updated = await prisma.appointment.update({
    where: { id },
    data:  { status: 'CANCELLED', cancelReason: reason.trim() },
    include: {
      doctor:  { select: { id: true, fullName: true } },
      service: { select: { id: true, name: true } },
    },
  })

  // Fire CANCEL SMS (non-blocking)
  sendAppointmentSms({
    patientName:     existing.patientName,
    patientPhone:    existing.patientPhone,
    appointmentDate: existing.appointmentDate,
    doctorName:      existing.doctor?.fullName,
  }, 'CANCEL')

  return updated
}

// ════════════════════════════════════════════════════════════════
// Utility – doctors dropdown list
// ════════════════════════════════════════════════════════════════

export const getDoctorsList = async () => {
  const doctors = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: { some: { role: { name: 'DOCTOR' } } },
    },
    select: { id: true, fullName: true },
    orderBy: { fullName: 'asc' },
  })
  return doctors
}

// ════════════════════════════════════════════════════════════════
// Lịch trực bác sĩ – schedule overview (read-only, receptionist)
// ════════════════════════════════════════════════════════════════

const AVATAR_COLORS = [
  '#3b82f6','#8b5cf6','#ec4899','#f97316',
  '#14b8a6','#22c55e','#ef4444','#0ea5e9',
]

/** ISO week number */
function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day  = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export const getScheduleOverview = async (weekStart: string) => {
  // Use UTC-midnight dates to avoid timezone offset issues
  const mon = new Date(weekStart + 'T00:00:00.000Z')
  const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6); sun.setUTCHours(23,59,59,999)
  const todayUTC = new Date(); todayUTC.setUTCHours(0,0,0,0)

  const now = new Date()

  // Build 7-day array
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setUTCDate(mon.getUTCDate() + i)
    const jsDay = d.getUTCDay()  // 0=Sun,1=Mon...
    const LABELS_SHORT = ['CN','T2','T3','T4','T5','T6','T7']
    const LABELS_FULL  = ['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7']
    const dateStr      = d.toISOString().slice(0, 10)
    return {
      date:        dateStr,
      dayLabel:    LABELS_SHORT[jsDay],
      fullLabel:   LABELS_FULL[jsDay],
      displayDate: `${d.getUTCDate()}/${d.getUTCMonth()+1}`,
      isToday:     d.getTime() === todayUTC.getTime(),
      isPast:      d < todayUTC,
    }
  })

  // Fetch all schedules + appointments for the week
  const [schedules, appointments, allDoctors] = await Promise.all([
    prisma.doctorSchedule.findMany({
      where:   { workDate: { gte: mon, lte: sun } },
      include: {
        doctor: { select: { id: true, fullName: true } },
        shift:  { select: { id: true, name: true, startTime: true, endTime: true, colorCode: true, maxPatients: true, slotDuration: true, bufferTime: true, reserveSlots: true } },
      },
      orderBy: [{ workDate: 'asc' }, { shift: { startTime: 'asc' } }],
    }),
    prisma.appointment.findMany({
      where:  { appointmentDate: { gte: mon, lte: sun }, status: { notIn: ['CANCELLED','ABSENT'] } },
      select: { doctorId: true, appointmentDate: true },
    }),
    prisma.user.findMany({
      where: { isActive: true, roles: { some: { role: { name: 'DOCTOR' } } } },
      select: {
        id: true, fullName: true,
        serviceGroups: { include: { serviceGroup: { select: { name: true } } }, take: 1 },
      },
      orderBy: { fullName: 'asc' },
    }),
  ])

  // Build booked-count map: doctorId|YYYY-MM-DD → count
  const bookedMap = new Map<string, number>()
  for (const apt of appointments) {
    if (!apt.doctorId) continue
    const d = new Date(apt.appointmentDate)
    const dayStr = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0,10)
    const key = `${apt.doctorId}|${dayStr}`
    bookedMap.set(key, (bookedMap.get(key) ?? 0) + 1)
  }

  // Collect doctor IDs that actually have schedules this week
  const scheduledDoctorIds = new Set(schedules.map(s => s.doctorId))

  // Build doctor rows (only doctors with ≥1 schedule this week)
  const doctorRows = allDoctors
    .filter(d => scheduledDoctorIds.has(d.id))
    .map((d, idx) => {
      const specialty = d.serviceGroups[0]?.serviceGroup?.name ?? 'Bác sĩ'
      const initials  = d.fullName.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase()
      const days: Record<string, {
        scheduleId: number; shiftId: number; shiftName: string
        startTime: string; endTime: string; colorCode: string
        maxPatients: number; bookedCount: number
      }[]> = {}

      for (const wd of weekDays) {
        const daySchedules = schedules.filter(s => {
          const sd = new Date(s.workDate); sd.setUTCHours(0,0,0,0)
          return sd.toISOString().slice(0,10) === wd.date && s.doctorId === d.id
        })
        if (daySchedules.length > 0) {
          const booked = bookedMap.get(`${d.id}|${wd.date}`) ?? 0
          days[wd.date] = daySchedules.map(s => ({
            scheduleId:  s.id,
            shiftId:     s.shiftId,
            shiftName:   s.shift.name,
            startTime:   s.shift.startTime,
            endTime:     s.shift.endTime,
            colorCode:   s.shift.colorCode,
            maxPatients: s.shift.maxPatients - s.shift.reserveSlots,
            bookedCount: booked,
          }))
        }
      }

      return {
        id:          d.id,
        name:        d.fullName,
        specialty,
        initials,
        avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
        days,
      }
    })

  // Build calendar day view
  const calendarDays = weekDays.map(wd => {
    const dayScheds = schedules.filter(s => {
      const sd = new Date(s.workDate); sd.setUTCHours(0,0,0,0)
      return sd.toISOString().slice(0,10) === wd.date
    })

    // Group by shift
    const shiftMap = new Map<number, { shiftId: number; shiftName: string; startTime: string; endTime: string; colorCode: string; maxPatients: number; reserveSlots: number; doctorIds: Set<number> }>()
    for (const s of dayScheds) {
      if (!shiftMap.has(s.shiftId)) {
        shiftMap.set(s.shiftId, {
          shiftId:      s.shiftId,
          shiftName:    s.shift.name,
          startTime:    s.shift.startTime,
          endTime:      s.shift.endTime,
          colorCode:    s.shift.colorCode,
          maxPatients:  s.shift.maxPatients - s.shift.reserveSlots,
          reserveSlots: s.shift.reserveSlots,
          doctorIds:    new Set(),
        })
      }
      shiftMap.get(s.shiftId)!.doctorIds.add(s.doctorId)
    }

    const shifts = [...shiftMap.values()].map(sh => {
      const totalBooked = [...sh.doctorIds].reduce((acc, did) => {
        return acc + (bookedMap.get(`${did}|${wd.date}`) ?? 0)
      }, 0)
      return {
        shiftId:      sh.shiftId,
        shiftName:    sh.shiftName,
        startTime:    sh.startTime,
        endTime:      sh.endTime,
        colorCode:    sh.colorCode,
        doctorCount:  sh.doctorIds.size,
        bookedCount:  totalBooked,
        totalSlots:   sh.maxPatients * sh.doctorIds.size,
      }
    }).sort((a, b) => a.startTime.localeCompare(b.startTime))

    return { ...wd, hasSchedule: shifts.length > 0, shifts }
  })

  return {
    weekNumber:  isoWeekNumber(mon),
    weekStart:   mon.toISOString().slice(0, 10),
    updatedAt:   now.toISOString(),
    weekDays,
    doctors:     doctorRows,
    calendarDays,
  }
}

// ─── Per-day slots (still used for slot grid) ─────────────────

export const getDoctorSlots = async (doctorId: number, date: string) => {
  const d        = new Date(date)
  const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0)
  const dayEnd   = new Date(d); dayEnd.setHours(23, 59, 59, 999)

  const [schedules, allShifts, appointments] = await Promise.all([
    prisma.doctorSchedule.findMany({
      where:   { doctorId, workDate: { gte: dayStart, lte: dayEnd } },
      include: { shift: true },
      orderBy: { shift: { startTime: 'asc' } },
    }),
    prisma.workShift.findMany({ where: { isActive: true }, orderBy: { startTime: 'asc' } }),
    prisma.appointment.findMany({
      where:  { doctorId, appointmentDate: { gte: dayStart, lte: dayEnd }, status: { notIn: ['CANCELLED', 'ABSENT'] } },
      select: { appointmentDate: true, patientName: true },
    }),
  ])

  const bookedMap = new Map<string, string>()
  for (const apt of appointments) {
    const t = new Date(apt.appointmentDate)
    bookedMap.set(`${pad2(t.getHours())}:${pad2(t.getMinutes())}`, apt.patientName)
  }

  const buildShiftResult = (shift: typeof allShifts[0], isUnscheduled: boolean) => {
    const slotTimes = generateSlotTimes(shift.startTime, shift.endTime, shift.slotDuration, shift.bufferTime)
    const maxEff    = shift.maxPatients - shift.reserveSlots
    const slots     = slotTimes.map(time => ({
      time,
      available: isUnscheduled ? true : !bookedMap.has(time),
      patientName: isUnscheduled ? undefined : bookedMap.get(time),
    }))
    const bookedCount = isUnscheduled ? 0 : slots.filter(s => !s.available).length
    const pct         = maxEff > 0 ? bookedCount / maxEff : 0
    return {
      shiftId:     shift.id,
      name:        shift.name,
      startTime:   shift.startTime,
      endTime:     shift.endTime,
      bookedCount,
      maxPatients: maxEff,
      isUnscheduled,
      status:      isUnscheduled ? 'UNSCHEDULED'
                  : pct >= 1     ? 'FULL'
                  : bookedCount > 0 ? 'FEW' : 'AVAILABLE' as string,
      slots,
    }
  }

  if (schedules.length > 0) {
    return { shifts: schedules.map(s => buildShiftResult(s.shift, false)) }
  }

  // No schedule → show all shifts as unscheduled (for next-week booking)
  const isPast = new Date(date) < new Date(new Date().setHours(0, 0, 0, 0))
  if (isPast) return { shifts: [] }
  return { shifts: allShifts.map(sh => buildShiftResult(sh, true)) }
}

// ════════════════════════════════════════════════════════════════
// Dashboard
// ════════════════════════════════════════════════════════════════

function timeAgo(date: Date): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)   return 'Vừa xong'
  if (mins < 60)  return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  return `${Math.floor(hours / 24)} ngày trước`
}

function todayRange() {
  const start = new Date(); start.setHours(0,0,0,0)
  const end   = new Date(); end.setHours(23,59,59,999)
  return { start, end }
}

function weekRange() {
  const today = new Date(); today.setHours(0,0,0,0)
  const dow   = today.getDay()
  const diff  = dow === 0 ? -6 : 1 - dow
  const start = new Date(today); start.setDate(today.getDate() + diff)
  const end   = new Date(start);  end.setDate(start.getDate() + 7)
  return { start, end }
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  COMPLETED:   { label: 'Hoàn thành',   color: '#22c55e' },
  PENDING:     { label: 'Chờ xác nhận', color: '#f97316' },
  CONFIRMED:   { label: 'Đã xác nhận',  color: '#3b82f6' },
  IN_PROGRESS: { label: 'Đang khám',    color: '#a855f7' },
  ABSENT:      { label: 'Vắng mặt',     color: '#ef4444' },
  CANCELLED:   { label: 'Đã hủy',       color: '#9ca3af' },
}

export const getDashboard = async () => {
  const { start: todayStart, end: todayEnd } = todayRange()
  const { start: weekStart,  end: weekEnd  } = weekRange()
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0)

  const yestStart = new Date(todayStart); yestStart.setDate(yestStart.getDate() - 1)
  const yestEnd   = new Date(todayStart)

  const [
    todayCount, yestCount, pendingCount, completedCount,
    weekRows, monthStatusGroups, todayAppointments,
    recentSmsLogs, recentSystemLogs, upcomingHoliday,
    todaySchedules, distinctPhonesMonth,
  ] = await Promise.all([
    prisma.appointment.count({ where: { appointmentDate: { gte: todayStart, lte: todayEnd } } }),
    prisma.appointment.count({ where: { appointmentDate: { gte: yestStart, lt: yestEnd } } }),
    prisma.appointment.count({ where: { appointmentDate: { gte: todayStart, lte: todayEnd }, status: 'PENDING' } }),
    prisma.appointment.count({ where: { appointmentDate: { gte: todayStart, lte: todayEnd }, status: 'COMPLETED' } }),
    prisma.appointment.findMany({
      where:  { appointmentDate: { gte: weekStart, lt: weekEnd } },
      select: { appointmentDate: true, status: true },
    }),
    prisma.appointment.groupBy({ by: ['status'], where: { createdAt: { gte: monthStart } }, _count: { id: true } }),
    prisma.appointment.findMany({
      where:   { appointmentDate: { gte: todayStart, lte: todayEnd } },
      orderBy: { appointmentDate: 'asc' },
      include: { doctor: { select: { fullName: true } }, service: { select: { name: true } } },
    }),
    prisma.smsLog.findMany({ orderBy: { createdAt: 'desc' }, take: 3 }),
    prisma.systemLog.findMany({ orderBy: { createdAt: 'desc' }, take: 3 }),
    prisma.holiday.findFirst({ where: { startDate: { gte: new Date() } }, orderBy: { startDate: 'asc' } }),
    prisma.doctorSchedule.findMany({
      where:   { workDate: { gte: todayStart, lte: todayEnd } },
      include: { doctor: { select: { fullName: true } }, shift: { select: { name: true, startTime: true, endTime: true } } },
      take: 2,
    }),
    prisma.appointment.findMany({
      where: { createdAt: { gte: monthStart } }, select: { patientPhone: true }, distinct: ['patientPhone'],
    }),
  ])

  const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
  const weeklyChart = Array.from({ length: 7 }, (_, i) => {
    const day    = new Date(weekStart); day.setDate(weekStart.getDate() + i)
    const dayStr = day.toDateString()
    const rows   = weekRows.filter(r => new Date(r.appointmentDate).toDateString() === dayStr)
    return {
      day:       DAY_LABELS[day.getDay()],
      total:     rows.length,
      completed: rows.filter(r => r.status === 'COMPLETED').length,
      cancelled: rows.filter(r => r.status === 'CANCELLED').length,
    }
  })

  const statusBreakdown = monthStatusGroups
    .map(g => ({ status: g.status, label: STATUS_META[g.status]?.label ?? g.status, count: g._count.id, color: STATUS_META[g.status]?.color ?? '#9ca3af' }))
    .sort((a, b) => b.count - a.count)

  const appointmentList = todayAppointments.map(a => {
    const d = new Date(a.appointmentDate)
    return { id: a.id, code: a.code, time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`, patientName: a.patientName, doctorName: a.doctor?.fullName ?? '—', serviceName: a.service?.name ?? '—', status: a.status }
  })

  const notifications: { id: string; message: string; timeAgo: string; color: string }[] = []
  const pendingToday = todayAppointments.filter(a => a.status === 'PENDING')
  if (pendingToday.length > 0) {
    const a = pendingToday[0]
    notifications.push({ id: `apt-${a.id}`, message: `Lịch hẹn ${a.code} - ${a.patientName} chưa được xác nhận`, timeAgo: timeAgo(a.createdAt), color: '#f97316' })
  }
  if (pendingToday.length > 1) {
    notifications.push({ id: 'apt-pending-more', message: `Còn ${pendingToday.length - 1} lịch hẹn khác đang chờ xác nhận hôm nay`, timeAgo: '', color: '#f97316' })
  }
  for (const sms of recentSmsLogs.slice(0, 2)) {
    notifications.push({ id: `sms-${sms.id}`, message: `SMS ${sms.status === 'SUCCESS' ? 'đã gửi' : 'lỗi'} tới ${sms.phone} (${sms.type})`, timeAgo: timeAgo(sms.createdAt), color: sms.status === 'SUCCESS' ? '#22c55e' : '#ef4444' })
  }
  for (const ds of todaySchedules.slice(0, 1)) {
    notifications.push({ id: `ds-${ds.id}`, message: `BS. ${ds.doctor.fullName} có lịch trực ca ${ds.shift.name} (${ds.shift.startTime}–${ds.shift.endTime})`, timeAgo: timeAgo(ds.createdAt), color: '#3b82f6' })
  }
  if (upcomingHoliday) {
    const hDate = new Date(upcomingHoliday.startDate)
    notifications.push({ id: `hol-${upcomingHoliday.id}`, message: `Phòng khám nghỉ ${upcomingHoliday.name} ngày ${pad2(hDate.getDate())}/${pad2(hDate.getMonth() + 1)}`, timeAgo: '', color: '#9333ea' })
  }
  if (notifications.length < 3) {
    for (const log of recentSystemLogs.slice(0, 3 - notifications.length)) {
      notifications.push({ id: `log-${log.id}`, message: log.detail ?? log.action, timeAgo: timeAgo(log.createdAt), color: log.status === 'FAILED' ? '#ef4444' : '#6b7280' })
    }
  }

  return {
    stats: { todayCount, todayDiff: todayCount - yestCount, pendingCount, completedCount, completionRate: todayCount > 0 ? Math.round((completedCount / todayCount) * 100) : 0, newPatientsThisMonth: distinctPhonesMonth.length },
    weeklyChart,
    statusBreakdown,
    todayAppointments: appointmentList,
    notifications: notifications.slice(0, 5),
  }
}
