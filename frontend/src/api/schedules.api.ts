import { api } from './auth.api'
import type { WorkShift } from './shifts.api'

export interface ScheduleItem {
  id:                number
  doctorId:          number
  doctorName:        string
  shiftId:           number
  shiftName:         string
  shiftStartTime:    string
  shiftEndTime:      string
  shiftColorCode:    string
  shiftMaxPatients:  number
  shiftSlotDuration: number
  shiftBufferTime:   number
  shiftReserveSlots: number
  workDate:          string   // "YYYY-MM-DD"
  serviceGroupId:    number | null
  serviceGroupName:  string | null
  note:              string | null
  isOverride:        boolean
  appointmentCount:  number
}

export interface FormDoctor {
  id:       number
  fullName: string
  groups:   { id: number; name: string }[]
}

export interface FormData {
  doctors: FormDoctor[]
  shifts:  WorkShift[]
  groups:  { id: number; name: string }[]
}

export interface HolidayInfo {
  id:        number
  name:      string
  startDate: string       // "YYYY-MM-DD"
  endDate:   string       // "YYYY-MM-DD"
  type:      string       // NATIONAL | PRIVATE | RECURRING
  startTime: string | null
  endTime:   string | null
  color:     string       // hex
}

export interface WeekData {
  schedules: ScheduleItem[]
  holidays:  HolidayInfo[]
}

export type ScheduleInput = {
  doctorId:        number
  shiftId:         number
  workDate:        string
  serviceGroupId?: number | null
  note?:           string
  isOverride?:     boolean
}

// ── Phân công hàng loạt ───────────────────────────────────────

export interface BatchScheduleInput {
  doctorId:        number
  shiftId:         number
  workDates:       string[]
  serviceGroupId?: number | null
  note?:           string
  isOverride?:     boolean
}

export interface BatchDayResult {
  workDate: string
  valid:    boolean
  error?:   string
}

export interface BatchPreviewResult {
  doctorName:  string
  shiftName:   string
  results:     BatchDayResult[]
  validCount:  number
  errorCount:  number
}

export interface BatchCreateResult {
  created:     ScheduleItem[]
  errors:      BatchDayResult[]
  savedCount:  number
  failedCount: number
}

export const scheduleApi = {
  getWeek:      (weekStart: string)                => api.get<WeekData>('/schedules', { params: { weekStart } }),
  getFormData:  ()                                 => api.get<FormData>('/schedules/form-data'),
  create:       (data: ScheduleInput)              => api.post<ScheduleItem>('/schedules', data),
  update:       (id: number, data: Partial<ScheduleInput & { isOverride: boolean }>) => api.put(`/schedules/${id}`, data),
  delete:       (id: number, isOverride?: boolean) => api.delete(`/schedules/${id}`, { data: { isOverride } }),
  // Phân công hàng loạt nhiều ngày
  previewBatch: (data: BatchScheduleInput)         => api.post<BatchPreviewResult>('/schedules/batch/preview', data),
  createBatch:  (data: BatchScheduleInput & { confirmedDates: string[] }) =>
    api.post<BatchCreateResult>('/schedules/batch', data),
}
