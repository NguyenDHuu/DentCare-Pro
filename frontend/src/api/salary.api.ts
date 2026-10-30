import { api } from './auth.api'

// ─── Types ────────────────────────────────────────────────────

export interface HourlyRate {
  id:        number
  amount:    number
  startDate: string
  endDate:   string | null
  status:    'ACTIVE' | 'UPCOMING' | 'EXPIRED'
  createdAt: string
  createdBy: string | null
}

export interface CurrentRate {
  amount:    number
  startDate: string
}

export interface FixedSalary {
  id:        number
  userId:    number
  fullName:  string
  role:      string | null
  amount:    number
  startDate: string
  endDate:   string | null
  status:    'ACTIVE' | 'UPCOMING' | 'EXPIRED'
  createdAt: string
  createdBy: string | null
}

export interface StaffOption {
  id:       number
  fullName: string
  role:     string | null
}

export interface PayslipRow {
  id:           number
  userId:       number
  fullName:     string
  role:         'DOCTOR' | 'RECEPTIONIST' | 'ACCOUNTANT'
  sessionCount: number | null
  hoursWorked:  number | null
  salaryAmount: number
  allowance:    number
  deduction:    number
  netSalary:    number
  status:       'DRAFT' | 'APPROVED' | 'FINALIZED'
  createdAt:    string
}

export interface MonthlyReport {
  month:     string
  totalFund: number
  byRole: {
    DOCTOR:       { count: number; total: number }
    RECEPTIONIST: { count: number; total: number }
    ACCOUNTANT:   { count: number; total: number }
  }
  rows:     PayslipRow[]
  hasDraft: boolean
}

export interface ShiftRow {
  id:        number
  name:      string
  startTime: string
  endTime:   string
  type:      'STANDARD' | 'OVERTIME'
  applyDays: number[]
  days:      Record<number, number | null>   // 1-7 → coefficient | null (disabled)
}

export interface Allowance {
  id:             number
  name:           string
  amount:         number
  appliesTo:      string          // 'BOTH' | 'RECEPTIONIST' | 'ACCOUNTANT'
  appliesToLabel: string
  startDate:      string
  endDate:        string | null
  status:         'ACTIVE' | 'UPCOMING' | 'EXPIRED'
  createdAt:      string
  createdBy:      string | null
}

// UC4.3 – Hệ số ca phức tạp
export interface ComplexityCase {
  receptionId:    number
  receptionCode:  string
  patientName:    string
  services:       string
  proposedCoeff:  number
  proposedReason: string | null
  proposedByName: string | null
  approvedCoeff:  number | null
  complexStatus:  'NORMAL' | 'PENDING' | 'APPROVED'
}

export interface ComplexitySchedule {
  schedId:       number
  doctorId?:     number
  doctorName?:   string
  degree?:       string | null
  shiftName:     string
  startTime:     string
  endTime:       string
  workDate:      string
  cases:         ComplexityCase[]
  totalCoeff:    number
  pendingCount:  number
  approvedCount: number
  totalProposed?: number
}

export interface ComplexityMatrix {
  month:     string
  isLocked?: boolean
  schedules: ComplexitySchedule[]
  kpi?: {
    schedTotal:   number
    complexTotal: number
    pendingTotal: number
  }
}

export interface DoctorFilter {
  id:       number
  fullName: string
  degree:   string | null
}

// UC4.4 – Lập phiếu lương
export interface PayslipStaff {
  id:       number
  fullName: string
  role:     'DOCTOR' | 'RECEPTIONIST' | 'ACCOUNTANT'
  degree:   string | null
  coeff:    number
}

export interface DoctorShiftLine {
  schedId:      number
  workDate:     string
  dayLabel:     string
  shiftName:    string
  shiftHours:   number
  shiftCoeff:   number
  patientCoeff: number
  pendingCnt:   number
  adjHours:     number
  doctorCoeff:  number
  hourlyRate:   number
  shiftPay:     number
}

export interface PayslipDetail {
  role:                 'DOCTOR' | 'RECEPTIONIST' | 'ACCOUNTANT'
  fullName:             string
  degree:               string | null
  doctorCoeff:          number | null
  shifts:               DoctorShiftLine[]
  sessionCount:         number | null
  totalAdjHours:        number | null
  totalShiftPay:        number
  hourlyRate:           number | null
  baseSalary:           number
  salaryAmount:         number
  hasPendingComplexity: boolean
  // existing payslip
  payslipId:            number | null
  status:               'DRAFT' | 'APPROVED' | 'FINALIZED' | 'CANCELLED' | null
  allowance:            number
  deduction:            number
  netSalary:            number
  note:                 string | null
  createdAt:            string | null
  userId:               number
  month:                string
}

// UC4.6 – Annual personal report
export interface StaffForReport {
  id:             number
  fullName:       string
  role:           'DOCTOR' | 'RECEPTIONIST' | 'ACCOUNTANT'
  degree:         string | null
  specialization: string | null
}

export interface AnnualMonthRow {
  month:        string            // 'YYYY-MM'
  sessionCount: number | null
  hoursWorked:  number | null
  salaryAmount: number | null
  allowance:    number | null
  deduction:    number | null
  netSalary:    number | null
  status:       'FINALIZED' | 'APPROVED' | 'DRAFT' | 'NONE'
}

export interface AnnualPersonalReport {
  user: {
    id:             number
    fullName:       string
    role:           string
    degree:         string | null
    specialization: string | null
  }
  year:          number
  totalAnnual:   number
  avgMonthly:    number
  totalSessions: number
  totalHours:    number
  months:        AnnualMonthRow[]
}

// UC4.7 – Annual full report
export interface AnnualMonthChart {
  month:        string
  label:        string
  DOCTOR:       number
  RECEPTIONIST: number
  ACCOUNTANT:   number
}

export interface AnnualEmployee {
  id:          number
  fullName:    string
  role:        'DOCTOR' | 'RECEPTIONIST' | 'ACCOUNTANT'
  monthCount:  number
  totalAnnual: number
  avgMonthly:  number
}

export interface AnnualFullReport {
  year:               number
  totalFund:          number
  avgMonthly:         number
  byRole: {
    DOCTOR:       { count: number; total: number }
    RECEPTIONIST: { count: number; total: number }
    ACCOUNTANT:   { count: number; total: number }
  }
  monthlyChart:       AnnualMonthChart[]
  employees:          AnnualEmployee[]
  countActiveMonths:  number
}

// ─── API ──────────────────────────────────────────────────────

export const salaryApi = {
  /** Đơn giá hiện tại */
  getCurrentRate(): Promise<CurrentRate | null> {
    return api.get('/salary/hourly-rates/current').then(r => r.data)
  },

  /** Lịch sử đơn giá giờ */
  getHourlyRates(): Promise<HourlyRate[]> {
    return api.get('/salary/hourly-rates').then(r => r.data)
  },

  /** Thêm đơn giá giờ mới */
  createHourlyRate(data: { amount: number; startDate: string; endDate?: string }): Promise<HourlyRate> {
    return api.post('/salary/hourly-rates', data).then(r => r.data)
  },

  /** Danh sách lễ tân / kế toán đủ điều kiện */
  getEligibleStaff(): Promise<StaffOption[]> {
    return api.get('/salary/staff').then(r => r.data)
  },

  /** Danh sách lương cố định từng nhân viên */
  getFixedSalaries(): Promise<FixedSalary[]> {
    return api.get('/salary/fixed-salaries').then(r => r.data)
  },

  /** Thiết lập lương cố định tháng cho nhân viên */
  createFixedSalary(data: {
    userId: number; amount: number; startDate: string; endDate?: string
  }): Promise<FixedSalary> {
    return api.post('/salary/fixed-salaries', data).then(r => r.data)
  },

  /** Báo cáo lương tháng toàn nhân sự (UC4.5) */
  getMonthlySalaryReport(month: string): Promise<MonthlyReport> {
    return api.get('/salary/report/monthly', { params: { month } }).then(r => r.data)
  },

  /** Ma trận hệ số ca làm việc (UC4.2) */
  getShiftMatrix(): Promise<ShiftRow[]> {
    return api.get('/salary/shift-coefficients').then(r => r.data)
  },

  /** Lưu toàn bộ ma trận hệ số */
  saveShiftMatrix(items: { shiftId: number; dayOfWeek: number; coefficient: number }[]): Promise<{ ok: boolean }> {
    return api.post('/salary/shift-coefficients', items).then(r => r.data)
  },

  /** Danh sách phụ cấp chung */
  getAllowances(): Promise<Allowance[]> {
    return api.get('/salary/allowances').then(r => r.data)
  },

  /** Thêm phụ cấp mới */
  createAllowance(data: {
    name: string; amount: number; appliesTo: string; startDate: string; endDate?: string
  }): Promise<Allowance> {
    return api.post('/salary/allowances', data).then(r => r.data)
  },

  // ── UC4.3 ──────────────────────────────────────────────────
  getDoctorsForFilter(): Promise<DoctorFilter[]> {
    return api.get('/salary/complexity/doctors').then(r => r.data)
  },
  getComplexityMatrix(month: string, doctorId?: number): Promise<ComplexityMatrix> {
    return api.get('/salary/complexity/matrix', { params: { month, doctorId } }).then(r => r.data)
  },
  getDoctorComplexityCases(month: string): Promise<ComplexityMatrix> {
    return api.get('/salary/complexity/my-cases', { params: { month } }).then(r => r.data)
  },
  proposeComplexity(data: { receptionId: number; proposedCoeff: number; proposedReason?: string }): Promise<{ ok: boolean }> {
    return api.post('/salary/complexity/propose', data).then(r => r.data)
  },
  saveComplexityCases(items: { receptionId: number; approvedCoeff: number }[]): Promise<{ ok: boolean }> {
    return api.post('/salary/complexity/save', items).then(r => r.data)
  },

  // ── UC4.4 ──────────────────────────────────────────────────
  getPayslipStaffList(): Promise<PayslipStaff[]> {
    return api.get('/salary/payslip/staff-list').then(r => r.data)
  },
  getPayslipData(userId: number, month: string): Promise<PayslipDetail> {
    return api.get('/salary/payslip/data', { params: { userId, month } }).then(r => r.data)
  },
  savePayslip(data: {
    userId: number; month: string
    allowance: number; deduction: number; note?: string
  }): Promise<{ payslipId: number; ok: boolean }> {
    return api.post('/salary/payslip/save', data).then(r => r.data)
  },
  recalcPayslip(id: number): Promise<{ payslipId: number; ok: boolean }> {
    return api.post(`/salary/payslip/${id}/recalc`).then(r => r.data)
  },
  approvePayslip(id: number): Promise<{ ok: boolean }> {
    return api.post(`/salary/payslip/${id}/approve`).then(r => r.data)
  },
  finalizePayslip(id: number): Promise<{ ok: boolean }> {
    return api.post(`/salary/payslip/${id}/finalize`).then(r => r.data)
  },
  cancelPayslip(id: number): Promise<{ ok: boolean }> {
    return api.post(`/salary/payslip/${id}/cancel`).then(r => r.data)
  },

  /** Danh sách tất cả nhân sự cho dropdown báo cáo (UC4.6) */
  getAllStaffForReport(): Promise<StaffForReport[]> {
    return api.get('/salary/report/staff').then(r => r.data)
  },

  /** Báo cáo lương năm – 1 nhân sự (UC4.6) */
  getAnnualPersonalReport(userId: number, year: number): Promise<AnnualPersonalReport> {
    return api.get('/salary/report/annual/personal', { params: { userId, year } }).then(r => r.data)
  },

  /** Báo cáo quỹ lương năm – toàn bộ (UC4.7) */
  getAnnualFullReport(year: number): Promise<AnnualFullReport> {
    return api.get('/salary/report/annual/full', { params: { year } }).then(r => r.data)
  },
}
