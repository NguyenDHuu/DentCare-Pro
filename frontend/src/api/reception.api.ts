import { api } from './auth.api'

// ─── Types ────────────────────────────────────────────────────

export interface ReceptionPatient {
  id:             number
  code:           string
  fullName:       string
  phone:          string
  classification: string
  allergies:      string | null
}

export interface ReceptionDoctor {
  id:       number
  fullName: string
}

export interface ReceptionChairInfo {
  id:     number
  name:   string
  number: number
}

export interface ReceptionItem {
  id:             number
  code:           string
  arrivedAt:      string
  seatStartAt:    string | null
  endAt:          string | null
  status:         string
  visitReason:    string
  queuePriority:  number
  queuePosition:  number | null
  cancelReason:   string | null
  adminNote:      string | null
  patient:        ReceptionPatient
  appointment:    { id: number; code: string; service: { name: string } } | null
  doctor:         ReceptionDoctor | null
  chair:          ReceptionChairInfo | null
  receptionist:   { id: number; fullName: string }
}

export interface ChairStatus {
  id:     number
  name:   string
  number: number
  status: 'EMPTY' | 'ASSIGNED' | 'IN_TREATMENT'
  currentReception: {
    id:          number
    patientName: string
    doctorName:  string | null
    status:      string
  } | null
}

export interface QueueStats {
  waiting:        number
  inTreatment:    number
  waitingPayment: number
  completed:      number
  total:          number
}

export interface TodayQueueResult {
  queue:  ReceptionItem[]
  chairs: ChairStatus[]
  stats:  QueueStats
}

export interface SearchPatientResult {
  id:             number
  code:           string
  fullName:       string
  phone:          string
  dateOfBirth:    string | null
  gender:         string | null
  classification: string
  allergies:      string | null
  todayAppointment: {
    id:              number
    code:            string
    appointmentDate: string
    status:          string
    service:         { name: string }
    doctor:          { id: number; fullName: string } | null
  } | null
  activeReception: { code: string; status: string } | null
}

export interface DoctorOption {
  id:               number
  fullName:         string
  isScheduledToday: boolean
}

export interface CheckInPayload {
  patientId:     number
  appointmentId?: number
  doctorId?:     number
  chairId?:      number
  visitReason:   string
  adminNote?:    string
}

export interface UpdateStatusPayload {
  status:        string
  chairId?:      number | null
  doctorId?:     number | null
  cancelReason?: string
  adminNote?:    string
}

export interface AssignPayload {
  chairId?:  number | null
  doctorId?: number | null
}

// ─── API calls ────────────────────────────────────────────────

export const receptionApi = {
  /** Hàng chờ hôm nay + ghế + thống kê */
  getTodayQueue(): Promise<TodayQueueResult> {
    return api.get('/reception/queue').then(r => r.data)
  },

  /** Tìm kiếm bệnh nhân khi check-in */
  searchPatients(q: string): Promise<SearchPatientResult[]> {
    return api.get('/reception/search-patients', { params: { q } }).then(r => r.data)
  },

  /** Danh sách bác sĩ */
  getDoctors(): Promise<DoctorOption[]> {
    return api.get('/reception/doctors').then(r => r.data)
  },

  /** Trạng thái ghế */
  getChairs(): Promise<ChairStatus[]> {
    return api.get('/reception/chairs').then(r => r.data)
  },

  /** Check-in bệnh nhân */
  checkIn(payload: CheckInPayload): Promise<ReceptionItem> {
    return api.post('/reception/checkin', payload).then(r => r.data)
  },

  /** Cập nhật trạng thái */
  updateStatus(id: number, payload: UpdateStatusPayload): Promise<ReceptionItem> {
    return api.put(`/reception/${id}/status`, payload).then(r => r.data)
  },

  /** Phân công ghế + bác sĩ */
  assign(id: number, payload: AssignPayload): Promise<ReceptionItem> {
    return api.put(`/reception/${id}/assign`, payload).then(r => r.data)
  },

  /** Chi tiết 1 bản ghi */
  getReception(id: number): Promise<ReceptionItem> {
    return api.get(`/reception/${id}`).then(r => r.data)
  },

  /** Lịch sử tiếp đón của bệnh nhân */
  getPatientHistory(patientId: number): Promise<ReceptionItem[]> {
    return api.get(`/reception/patients/${patientId}/history`).then(r => r.data)
  },

  /** Thay đổi phân loại bệnh nhân (UC3.6) */
  changeClassification(patientId: number, classification: string, reason: string) {
    return api.patch(`/reception/patients/${patientId}/classification`, { classification, reason }).then(r => r.data)
  },
}
