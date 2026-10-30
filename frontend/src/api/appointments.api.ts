import { api } from './auth.api'

// ─── Types ────────────────────────────────────────────────────

export interface AppointmentItem {
  id:              number
  code:            string
  patientName:     string
  patientPhone:    string
  patientDob:      string | null
  patientGender:   string | null
  note:            string | null
  cancelReason:    string | null
  status:          string
  appointmentDate: string   // ISO
  doctorId:        number | null
  doctorName:      string | null
  serviceId:       number | null
  serviceName:     string | null
  createdAt:       string
  updatedAt:       string
}

export interface AppointmentListResult {
  items:       AppointmentItem[]
  pagination:  { page: number; limit: number; total: number; totalPages: number }
  tabCounts:   { all: number; today: number; upcoming: number }
  statusCounts: Record<string, number>
}

export interface AppointmentDetail extends AppointmentItem {
  creator?: { id: number; fullName: string } | null
}

export interface DoctorOption { id: number; fullName: string }

export interface ServiceOption { id: number; code: string; name: string; duration: number }

// ─── Status meta ──────────────────────────────────────────────

export const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:     { label: 'Chờ xác nhận', color: '#f97316', bg: '#fff7ed' },
  CONFIRMED:   { label: 'Đã xác nhận',  color: '#3b82f6', bg: '#eff6ff' },
  CHECKED_IN:  { label: 'Đã check-in',  color: '#0891b2', bg: '#ecfeff' },
  IN_PROGRESS: { label: 'Đang khám',    color: '#a855f7', bg: '#faf5ff' },
  COMPLETED:   { label: 'Hoàn thành',   color: '#22c55e', bg: '#f0fdf4' },
  ABSENT:      { label: 'Vắng mặt',     color: '#eab308', bg: '#fefce8' },
  CANCELLED:   { label: 'Đã hủy',       color: '#9ca3af', bg: '#f9fafb' },
}

// ─── API ──────────────────────────────────────────────────────

export const appointmentsApi = {
  list: (params: {
    tab?:      string
    status?:   string
    doctorId?: number | null
    search?:   string
    page?:     number
    limit?:    number
  }) => api.get<AppointmentListResult>('/receptionist/appointments', { params }),

  get: (id: number) =>
    api.get<AppointmentDetail>(`/receptionist/appointments/${id}`),

  update: (id: number, body: {
    patientName?:    string
    patientPhone?:   string
    patientDob?:     string | null
    patientGender?:  string | null
    note?:           string | null
    doctorId?:       number | null
    serviceId?:      number | null
    appointmentDate?: string
  }) => api.put<AppointmentDetail>(`/receptionist/appointments/${id}`, body),

  patchStatus: (id: number, status: string) =>
    api.patch<AppointmentDetail>(`/receptionist/appointments/${id}/status`, { status }),

  cancel: (id: number, reason: string) =>
    api.post<AppointmentDetail>(`/receptionist/appointments/${id}/cancel`, { reason }),

  getDoctors: () =>
    api.get<DoctorOption[]>('/receptionist/doctors-list'),

  getServices: () =>
    api.get<ServiceOption[]>('/receptionist/services'),
}
