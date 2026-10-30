import { api } from './auth.api'

export interface WeekDayMeta {
  date:        string
  dayLabel:    string
  fullLabel:   string
  displayDate: string
  isToday:     boolean
  isPast:      boolean
}

export interface MyShift {
  scheduleId:       number
  shiftId:          number
  shiftName:        string
  startTime:        string
  endTime:          string
  colorCode:        string
  maxPatients:      number
  totalSlots:       number
  bookedCount:      number
  visitedCount:     number   // bệnh nhân thực tế đã đến (reception)
  freeCount:        number
  serviceGroupId:   number | null
  serviceGroupName: string | null
  note:             string | null
  isOverride:       boolean
  status:           'FREE' | 'BUSY' | 'FULL' | 'VISITED'
}

export interface MyScheduleDay extends WeekDayMeta {
  shifts:       MyShift[]
  totalBooked:  number
  totalVisited: number
  totalFree:    number
}

export interface MyScheduleData {
  weekNumber:    number
  weekStart:     string
  updatedAt:     string
  weekDays:      WeekDayMeta[]
  mySchedule:    MyScheduleDay[]
  serviceGroups: { id: number; name: string }[]
  weekStats: {
    totalShifts:  number
    totalBooked:  number
    totalVisited: number
    totalFree:    number
  }
}

export interface GroupDoctorShift {
  scheduleId:       number
  shiftId:          number
  shiftName:        string
  startTime:        string
  endTime:          string
  colorCode:        string
  maxPatients:      number
  bookedCount:      number
  serviceGroupName: string | null
}

export interface GroupDoctorRow {
  id:           number
  name:         string
  specialty:    string
  initials:     string
  avatarColor:  string
  isMe:         boolean
  sharedGroups: { id: number; name: string }[]
  days:         Record<string, GroupDoctorShift[]>
}

export interface GroupScheduleData {
  weekNumber:    number
  weekStart:     string
  updatedAt:     string
  weekDays:      WeekDayMeta[]
  doctors:       GroupDoctorRow[]
  serviceGroups: { id: number; name: string }[]
}

// ─── My Appointments ─────────────────────────────────────────

export type AptView = 'day' | 'week' | 'month'

export interface DoctorAppointment {
  id:              number
  code:            string
  patientName:     string
  patientPhone:    string
  patientDob:      string | null
  patientGender:   string | null
  note:            string | null
  cancelReason:    string | null
  status:          string
  appointmentDate: string
  serviceId:       number | null
  serviceName:     string | null
  createdAt:       string
}

export interface DoctorAppointmentList {
  items:        DoctorAppointment[]
  pagination:   { page: number; limit: number; total: number; totalPages: number }
  statusCounts: Record<string, number>
  refDate:      string
  view:         AptView
}

// ─── API ──────────────────────────────────────────────────────

export const doctorApi = {
  getMySchedule:    (weekStart: string) =>
    api.get<MyScheduleData>('/doctor/my-schedule', { params: { weekStart } }),
  getGroupSchedule: (weekStart: string) =>
    api.get<GroupScheduleData>('/doctor/group-schedule', { params: { weekStart } }),
  getMyAppointments: (params: {
    view?:   AptView
    date?:   string
    status?: string
    search?: string
    page?:   number
    limit?:  number
  }) => api.get<DoctorAppointmentList>('/doctor/appointments', { params }),
  patchStatus: (id: number, status: string) =>
    api.patch(`/doctor/appointments/${id}/status`, { status }),
  getTodayReceptions: () =>
    api.get<TodayReception[]>('/doctor/today-receptions'),
}

export interface TodayReception {
  id:             number
  code:           string
  status:         string
  visitReason:    string
  arrivedAt:      string
  adminNote:      string | null
  patientId:      number
  patientName:    string
  patientPhone:   string
  patientDob:     string | null
  patientGender:  string | null
  classification: string | null
}
