import { api } from './auth.api'

// ─── Dashboard ────────────────────────────────────────────────

export interface DashboardStats {
  todayCount: number; todayDiff: number; pendingCount: number
  completedCount: number; completionRate: number; newPatientsThisMonth: number
}
export interface WeeklyChartItem  { day: string; total: number; completed: number; cancelled: number }
export interface StatusBreakdownItem { status: string; label: string; count: number; color: string }
export interface TodayAppointment { id: number; code: string; time: string; patientName: string; doctorName: string; serviceName: string; status: string }
export interface Notification     { id: string; message: string; timeAgo: string; color: string }
export interface DashboardData    { stats: DashboardStats; weeklyChart: WeeklyChartItem[]; statusBreakdown: StatusBreakdownItem[]; todayAppointments: TodayAppointment[]; notifications: Notification[] }

// ─── Booking ──────────────────────────────────────────────────

export interface PatientLookup {
  patientName: string; patientPhone: string
  patientDob: string | null; patientGender: string | null
}

export interface BookingService { id: number; code: string; name: string; duration: number }

/** Week-level doctor availability */
export interface BookingDoctor {
  id: number
  name: string
  totalSlots: number
  bookedSlots: number
  freeSlots: number
  /** FREE=green, BUSY=yellow, FULL=red, UNSCHEDULED=blue */
  availability: 'FREE' | 'BUSY' | 'FULL' | 'UNSCHEDULED'
  nextAvailableDate: string | null
  nextAvailableTime: string | null
}

/** A single time slot */
export interface TimeSlot { time: string; available: boolean; patientName?: string }

/** A shift within a day of the doctor's timeline */
export interface TimelineShift {
  shiftId: number
  name: string
  startTime: string
  endTime: string
  colorCode: string
  bookedCount: number
  maxPatients: number
  freeCount: number
  isUnscheduled: boolean
  /** FREE | BUSY | FULL | UNSCHEDULED */
  status: string
  slots: TimeSlot[]
}

/** One day in the doctor's weekly timeline */
export interface TimelineDay {
  date: string
  dayLabel: string        // T2, T3, ... CN
  displayDate: string     // 02/06
  isToday: boolean
  isPast: boolean
  hasSchedule: boolean
  shifts: TimelineShift[]
  unscheduledShifts: TimelineShift[]
  totalFree: number
  totalBooked: number
}

/** Per-day simple slot view (for getSlots endpoint) */
export interface ShiftSlots {
  shiftId: number; name: string; startTime: string; endTime: string
  bookedCount: number; maxPatients: number
  isUnscheduled: boolean
  status: string
  slots: TimeSlot[]
}

export interface CreatedAppointment {
  id: number; code: string
  patientName: string; patientPhone: string
  appointmentDate: string; status: string
  doctor:  { fullName: string } | null
  service: { name: string }     | null
}

// ─── API ──────────────────────────────────────────────────────

// ─── Schedule overview ────────────────────────────────────────

export interface ScheduleShiftInfo {
  scheduleId:  number
  shiftId:     number
  shiftName:   string
  startTime:   string
  endTime:     string
  colorCode:   string
  maxPatients: number
  bookedCount: number
}

export interface ScheduleDoctorRow {
  id:          number
  name:        string
  specialty:   string
  initials:    string
  avatarColor: string
  /** keys are "YYYY-MM-DD" */
  days:        Record<string, ScheduleShiftInfo[]>
}

export interface CalendarShift {
  shiftId:     number
  shiftName:   string
  startTime:   string
  endTime:     string
  colorCode:   string
  doctorCount: number
  bookedCount: number
  totalSlots:  number
}

export interface CalendarDay {
  date:        string
  dayLabel:    string
  fullLabel:   string
  displayDate: string
  isToday:     boolean
  isPast:      boolean
  hasSchedule: boolean
  shifts:      CalendarShift[]
}

export interface WeekDayMeta {
  date:        string
  dayLabel:    string
  fullLabel:   string
  displayDate: string
  isToday:     boolean
  isPast:      boolean
}

export interface ScheduleOverviewData {
  weekNumber:   number
  weekStart:    string
  updatedAt:    string
  weekDays:     WeekDayMeta[]
  doctors:      ScheduleDoctorRow[]
  calendarDays: CalendarDay[]
}

// ─────────────────────────────────────────────────────────────

export const receptionistApi = {
  getDashboard:  () =>
    api.get<DashboardData>('/receptionist/dashboard'),

  lookupPatient: (phone: string) =>
    api.get<PatientLookup | null>('/receptionist/patient', { params: { phone } }),

  getServices:   () =>
    api.get<BookingService[]>('/receptionist/services'),

  /** Returns week-level doctor availability */
  getDoctors:    (serviceId: number, weekStart: string) =>
    api.get<{ doctors: BookingDoctor[]; serviceName: string }>('/receptionist/doctors', { params: { serviceId, weekStart } }),

  /** Returns full 7-day timeline for one doctor */
  getDoctorWeek: (doctorId: number, weekStart: string) =>
    api.get<{ weekDays: TimelineDay[] }>('/receptionist/doctor-week', { params: { doctorId, weekStart } }),

  getSlots:      (doctorId: number, date: string) =>
    api.get<{ shifts: ShiftSlots[] }>('/receptionist/slots', { params: { doctorId, date } }),

  createAppointment: (body: {
    patientName: string; patientPhone: string
    patientDob?: string | null; patientGender?: string | null; note?: string | null
    doctorId?: number | null; serviceId?: number | null
    appointmentDate: string
    shiftId?: number | null   // for auto-create DoctorSchedule on unscheduled days
  }) => api.post<CreatedAppointment>('/receptionist/appointments', body),

  getScheduleOverview: (weekStart: string) =>
    api.get<ScheduleOverviewData>('/receptionist/schedule-overview', { params: { weekStart } }),
}
