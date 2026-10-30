import { api } from './auth.api'

// ─── Types ────────────────────────────────────────────────────

export interface TreatmentQueueItem {
  id:            number
  code:          string
  status:        string
  queuePriority: number
  arrivedAt:     string
  visitReason:   string
  patient: {
    id:                 number
    code:               string
    fullName:           string
    phone:              string
    classification:     string
    allergies:          string | null
    systemicDiseases:   string | null
    dentalAnxietyLevel: string | null
    toothChart:         Record<string, any> | null
  }
  doctor:  { id: number; fullName: string } | null
  chair:   { id: number; name: string; number: number } | null
  dentalRecord: { id: number; code: string; status: string; icd10Code: string | null; icd10Description: string | null } | null
}

export interface DentalRecordService {
  id:          number
  serviceId:   number
  toothNumber: string
  unitPrice:   number
  quantity:    number
  note:        string | null
  service:     { id: number; name: string }
}

export interface DentalRecord {
  id:               number
  code:             string
  receptionId:      number
  patientId:        number
  doctorId:         number
  visitReason:      string | null
  symptoms:         string | null
  icd10Code:        string | null
  icd10Description: string | null
  clinicalNotes:    string | null
  aftercareNotes:   string | null
  followUpDate:     string | null
  status:           'DRAFT' | 'SIGNED'
  signedAt:         string | null
  services:         DentalRecordService[]
}

export interface ServiceOption {
  id:        number
  code:      string
  name:      string
  group:     string
  unitPrice: number
}

export interface SaveDraftPayload {
  visitReason?:      string
  symptoms?:         string
  icd10Code?:        string
  icd10Description?: string
  clinicalNotes?:    string
  aftercareNotes?:   string
  followUpDate?:     string | null
  toothChart?:       Record<string, any> | null
  services?: Array<{
    serviceId:   number
    toothNumber: string
    unitPrice:   number
    quantity:    number
    note?:       string
  }>
}

// ─── API ──────────────────────────────────────────────────────

export const treatmentApi = {
  /** Hàng chờ điều trị hôm nay */
  getQueue(doctorId?: number): Promise<TreatmentQueueItem[]> {
    return api.get('/treatment/queue', { params: doctorId ? { doctorId } : {} }).then(r => r.data)
  },

  /** Lấy hoặc tạo draft cho 1 tiếp đón */
  getOrCreate(receptionId: number): Promise<DentalRecord> {
    return api.get(`/treatment/reception/${receptionId}`).then(r => r.data)
  },

  /** Chi tiết hồ sơ */
  getRecord(id: number): Promise<DentalRecord> {
    return api.get(`/treatment/${id}`).then(r => r.data)
  },

  /** Lưu nháp */
  saveDraft(id: number, payload: SaveDraftPayload): Promise<DentalRecord> {
    return api.put(`/treatment/${id}`, payload).then(r => r.data)
  },

  /** Ký số & chốt */
  signRecord(id: number): Promise<DentalRecord> {
    return api.post(`/treatment/${id}/sign`).then(r => r.data)
  },

  /** Dịch vụ active */
  getServices(): Promise<ServiceOption[]> {
    return api.get('/treatment/services').then(r => r.data)
  },

  /** Lịch sử điều trị của BN */
  getPatientHistory(patientId: number): Promise<DentalRecord[]> {
    return api.get(`/treatment/patient/${patientId}/history`).then(r => r.data)
  },
}
