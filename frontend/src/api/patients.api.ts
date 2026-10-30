import { api } from './auth.api'

// ─── Classification ───────────────────────────────────────────

export const CLASSIFICATION_META: Record<string, { label: string; color: string; bg: string }> = {
  NEW:      { label: 'Mới',               color: '#2563eb', bg: '#eff6ff' },
  VIP:      { label: 'VIP',               color: '#b45309', bg: '#fef9c3' },
  RETURNING:{ label: 'Tái khám',          color: '#059669', bg: '#ecfdf5' },
  SPECIAL:  { label: 'Theo dõi đặc biệt', color: '#dc2626', bg: '#fff1f2' },
}

export const ANXIETY_META: Record<string, { label: string; color: string }> = {
  NONE:   { label: 'Không lo lắng', color: '#059669' },
  LOW:    { label: 'Lo lắng nhẹ',   color: '#2563eb' },
  MEDIUM: { label: 'Lo lắng vừa',   color: '#d97706' },
  HIGH:   { label: 'Lo lắng nhiều', color: '#dc2626' },
}

// ─── Tooth chart ──────────────────────────────────────────────

export type ToothStatus = 'HEALTHY' | 'CAVITY' | 'MISSING' | 'FILLED' | 'CROWN' | 'IMPLANT' | 'NEEDS_TREATMENT'

export const TOOTH_STATUS_META: Record<ToothStatus, { label: string; bg: string; border: string; text: string }> = {
  HEALTHY:          { label: 'Lành mạnh',    bg: '#f0fdf4', border: '#86efac', text: '#15803d' },
  CAVITY:           { label: 'Sâu răng',     bg: '#fef2f2', border: '#fca5a5', text: '#dc2626' },
  MISSING:          { label: 'Đã mất',       bg: '#f3f4f6', border: '#d1d5db', text: '#6b7280' },
  FILLED:           { label: 'Đã trám',      bg: '#eff6ff', border: '#93c5fd', text: '#1d4ed8' },
  CROWN:            { label: 'Chụp sứ',      bg: '#faf5ff', border: '#c4b5fd', text: '#7c3aed' },
  IMPLANT:          { label: 'Implant',      bg: '#f0fdfa', border: '#5eead4', text: '#0f766e' },
  NEEDS_TREATMENT:  { label: 'Cần điều trị', bg: '#fefce8', border: '#fde047', text: '#92400e' },
}

export interface ToothCondition { status: ToothStatus; notes?: string }
export type ToothChartData = Record<string, ToothCondition>

// ─── Patient types ────────────────────────────────────────────

export interface PatientRow {
  id:             number
  code:           string
  fullName:       string
  dateOfBirth:    string
  gender:         string
  phone:          string
  nationalId:     string | null
  classification: string
  isComplete:     boolean
  isActive:       boolean
  lastVisit:      string | null
  createdAt:      string
}

export interface PatientDetail extends PatientRow {
  bhytCode:              string | null
  address:               string | null
  occupation:            string | null
  emergencyContactName:  string | null
  emergencyContactPhone: string | null
  adminNote:             string | null
  // Medical (doctor/admin only)
  allergies:             string | null
  systemicDiseases:      string | null
  dentalAnxietyLevel:    string | null
  internalNote:          string | null
  toothChart:            ToothChartData | null
  appointments: PatientAppointment[]
}

export interface PatientAppointment {
  id:              number
  code:            string
  appointmentDate: string
  status:          string
  note:            string | null
  doctor:          { fullName: string } | null
  service:         { name: string }     | null
}

export interface AppointmentHit {
  id:             number
  code:           string
  patientName:    string
  patientPhone:   string
  patientDob:     string | null
  patientGender:  string | null
  appointmentDate: string
}

export interface ListPatientsResponse {
  patients:        PatientRow[]
  total:           number
  page:            number
  limit:           number
  totalPages:      number
  appointmentHits: AppointmentHit[]
}

export interface CreatePatientPayload {
  fullName:               string
  dateOfBirth:            string
  gender:                 string
  phone:                  string
  nationalId?:            string
  bhytCode?:              string
  address?:               string
  occupation?:            string
  emergencyContactName?:  string
  emergencyContactPhone?: string
  adminNote?:             string
  appointmentId?:         number
}

export interface UpdateMedicalPayload {
  allergies?:          string | null
  systemicDiseases?:   string | null
  dentalAnxietyLevel?: string | null
  internalNote?:       string | null
  toothChart?:         ToothChartData | null
}

export interface DuplicateError {
  message:   string
  duplicate: { type: 'NATIONAL_ID' | 'PHONE'; patient: { id: number; code: string; fullName: string; phone: string } }
}

// ─── API ──────────────────────────────────────────────────────

export const patientsApi = {
  list: (params: { q?: string; page?: number; limit?: number }) =>
    api.get<ListPatientsResponse>('/patients', { params }),

  get: (id: number) =>
    api.get<PatientDetail>(`/patients/${id}`),

  getAppointments: (id: number) =>
    api.get<PatientAppointment[]>(`/patients/${id}/appointments`),

  create: (body: CreatePatientPayload) =>
    api.post<PatientDetail>('/patients', body),

  update: (id: number, body: Partial<CreatePatientPayload & UpdateMedicalPayload>) =>
    api.put<PatientDetail>(`/patients/${id}`, body),

  updateMedical: (id: number, body: UpdateMedicalPayload) =>
    api.put<PatientDetail>(`/patients/${id}`, body),

  deactivate: (id: number) =>
    api.patch(`/patients/${id}/deactivate`),
}
