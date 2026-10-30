import { api } from './auth.api'

// ─── Types ────────────────────────────────────────────────────

export interface InvoiceItem {
  id:          number
  serviceId:   number
  serviceName: string
  toothNumber: string | null
  unitPrice:   number
  quantity:    number
  bhytCovered: boolean
  amount:      number
  note:        string | null
  service:     { id: number; name: string; code: string }
}

export interface Invoice {
  id:             number
  code:           string
  receptionId:    number
  dentalRecordId: number
  patientId:      number
  doctorId:       number
  subtotal:       number
  discountAmount: number
  discountPct:    number
  voucherCode:    string | null
  totalAmount:    number
  bhytAmount:     number
  paymentMethod:  string | null
  paymentNote:    string | null
  paidAt:         string | null
  notes:          string | null
  status:         'WAITING_PAYMENT' | 'PAID' | 'CANCELLED' | 'REFUNDED'
  confirmedBy:    number | null
  createdAt:      string
  updatedAt:      string
  patient:   { id: number; code: string; fullName: string; phone: string; classification: string; dateOfBirth?: string; bhytCode?: string | null }
  doctor:    { id: number; fullName: string }
  reception: { id: number; code: string; arrivedAt: string; chair?: { name: string; number: number } | null }
  dentalRecord: { id: number; code: string; icd10Code: string | null; icd10Description: string | null; signedAt?: string | null }
  confirmer?:   { id: number; fullName: string } | null
  items:     InvoiceItem[]
}

export interface InvoiceListResult {
  items: Invoice[]
  total: number
  page:  number
  limit: number
}

export interface ChartPoint {
  label:    string
  revenue:  number
  patients: number
}

export interface TopService {
  name:       string
  count:      number
  revenue:    number
  percentage: number
}

export interface DoctorRevenue {
  doctorId:   number
  doctorName: string
  revenue:    number
  patients:   number
}

export interface StatsSummary {
  totalRevenue:    number
  patientCount:    number
  avgRevenue:      number
  totalDebt:       number
  overdueCount:    number
  revenueGrowth:   number
  patientGrowth:   number
}

export interface StatsData {
  period:           string
  summary:          StatsSummary
  chartData:        ChartPoint[]
  topServices:      TopService[]
  revenueByDoctor:  DoctorRevenue[]
}

// ─── API ──────────────────────────────────────────────────────

export const invoiceApi = {
  list(params?: { status?: string; search?: string; page?: number; patientId?: number }): Promise<InvoiceListResult> {
    return api.get('/invoice', { params }).then(r => r.data)
  },

  get(id: number): Promise<Invoice> {
    return api.get(`/invoice/${id}`).then(r => r.data)
  },

  applyDiscount(id: number, data: { discountPct?: number; voucherCode?: string; discountAmount?: number }): Promise<Invoice> {
    return api.post(`/invoice/${id}/discount`, data).then(r => r.data)
  },

  pay(id: number, data: { paymentMethod: string; paymentNote?: string }): Promise<Invoice> {
    return api.post(`/invoice/${id}/pay`, data).then(r => r.data)
  },

  cancel(id: number, reason: string): Promise<Invoice> {
    return api.post(`/invoice/${id}/cancel`, { reason }).then(r => r.data)
  },

  getStats(period: 'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR'): Promise<StatsData> {
    return api.get('/invoice/stats', { params: { period } }).then(r => r.data)
  },
}
