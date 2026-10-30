import { useState, useEffect, useCallback } from 'react'
import {
  Calculator, User, CalendarDays, ChevronDown,
  CheckCircle2, XCircle, Lock, RefreshCw,
  AlertTriangle, FileText, Clock, TrendingUp,
  Stethoscope, Briefcase, ArrowRight,
} from 'lucide-react'
import {
  salaryApi,
  type PayslipStaff,
  type PayslipDetail,
  type DoctorShiftLine,
} from '../../api/salary.api'

// ─── Constants ────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  DOCTOR:       { label: 'Bác sĩ',  color: '#2563eb', bg: '#eff6ff', icon: Stethoscope },
  RECEPTIONIST: { label: 'Lễ tân',  color: '#0d9488', bg: '#f0fdfa', icon: Briefcase },
  ACCOUNTANT:   { label: 'Kế toán', color: '#7c3aed', bg: '#f5f3ff', icon: Briefcase },
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string; step: number }> = {
  DRAFT:     { label: 'Nháp',     color: '#b45309', bg: '#fef9c3', border: '#fde047', step: 1 },
  APPROVED:  { label: 'Đã duyệt', color: '#1d4ed8', bg: '#dbeafe', border: '#93c5fd', step: 2 },
  FINALIZED: { label: 'Đã chốt',  color: '#15803d', bg: '#dcfce7', border: '#86efac', step: 3 },
  CANCELLED: { label: 'Đã hủy',   color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5', step: 0 },
}

const fmtMoney  = (n: number) => n.toLocaleString('vi-VN') + 'đ'
const fmtHours  = (n: number | null) => n != null ? n.toFixed(2) + 'h' : '—'

// ─── Helpers ──────────────────────────────────────────────────

function monthOptions() {
  const opts: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    opts.push({ value: val, label: `Tháng ${d.getMonth() + 1}/${d.getFullYear()}` })
  }
  return opts
}
function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// ─── Status Badge ─────────────────────────────────────────────
function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  const m = STATUS_META[status]
  if (!m) return null
  return (
    <span style={{ background: m.bg, color: m.color, border: `1.5px solid ${m.border}` }}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide">
      {status === 'DRAFT'     && <FileText size={11} />}
      {status === 'APPROVED'  && <CheckCircle2 size={11} />}
      {status === 'FINALIZED' && <Lock size={11} />}
      {status === 'CANCELLED' && <XCircle size={11} />}
      {m.label}
    </span>
  )
}

// ─── Role Badge ───────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const m = ROLE_META[role]
  if (!m) return null
  const Icon = m.icon
  return (
    <span style={{ background: m.bg, color: m.color }}
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold">
      <Icon size={11} />
      {m.label}
    </span>
  )
}

// ─── Shift Table ──────────────────────────────────────────────
function ShiftTable({ shifts }: { shifts: DoctorShiftLine[] }) {
  if (!shifts.length)
    return (
      <div className="text-center py-12 text-gray-400">
        <Clock size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">Không có ca trực nào trong tháng này</p>
      </div>
    )

  const totAdj = shifts.reduce((s, r) => s + r.adjHours, 0)
  const totPay = shifts.reduce((s, r) => s + r.shiftPay, 0)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 rounded-l-lg">Ngày</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">Thứ</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">Ca làm việc</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">Giờ ca</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-blue-400 uppercase tracking-wider bg-blue-50">HS ca</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-purple-400 uppercase tracking-wider bg-purple-50">HS BN</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-100">Giờ QĐ</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-indigo-400 uppercase tracking-wider bg-indigo-50">HS BS</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">Đơn giá/h</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-green-500 uppercase tracking-wider bg-green-50 rounded-r-lg">Thành tiền</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {shifts.map((s, i) => (
            <tr key={s.schedId} className={`transition-colors hover:bg-blue-50/40 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
              <td className="px-4 py-3">
                <span className="font-mono text-sm font-semibold text-gray-700">
                  {s.workDate.slice(8)}/{s.workDate.slice(5, 7)}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">{s.dayLabel}</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                  <span className="font-medium text-gray-800">{s.shiftName}</span>
                </span>
              </td>
              <td className="px-4 py-3 text-center font-mono text-gray-600">{s.shiftHours.toFixed(2)}h</td>
              <td className="px-4 py-3 text-center">
                <span className="inline-block bg-blue-50 text-blue-600 font-semibold rounded-md px-2 py-0.5 text-xs font-mono">
                  {s.shiftCoeff.toFixed(2)}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={`inline-flex items-center gap-0.5 font-semibold rounded-md px-2 py-0.5 text-xs font-mono
                  ${s.patientCoeff > 0 ? 'bg-purple-50 text-purple-600' : 'bg-gray-50 text-gray-400'}`}>
                  {s.patientCoeff.toFixed(2)}
                  {s.pendingCnt > 0 && <AlertTriangle size={10} className="text-orange-400" />}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="inline-block bg-gray-100 text-gray-800 font-bold rounded-md px-2 py-0.5 text-xs font-mono">
                  {s.adjHours.toFixed(2)}h
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="inline-block bg-indigo-50 text-indigo-600 font-semibold rounded-md px-2 py-0.5 text-xs font-mono">
                  ×{s.doctorCoeff.toFixed(2)}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs text-gray-400">{fmtMoney(s.hourlyRate)}</td>
              <td className="px-4 py-3 text-right">
                <span className="font-bold text-green-700">{fmtMoney(s.shiftPay)}</span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: 'linear-gradient(90deg,#f0fdf4,#dcfce7)' }}
            className="border-t-2 border-green-200">
            <td colSpan={6} className="px-4 py-3 text-right text-sm font-bold text-gray-600">
              Tổng cộng ({shifts.length} ca)
            </td>
            <td className="px-4 py-3 text-center">
              <span className="font-bold text-gray-800 font-mono">{totAdj.toFixed(2)}h</span>
            </td>
            <td colSpan={2} />
            <td className="px-4 py-3 text-right">
              <span className="text-lg font-extrabold text-green-700">{fmtMoney(totPay)}</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Summary Panel ────────────────────────────────────────────
interface SummaryProps {
  detail: PayslipDetail
  allowance: number
  deduction: number
  note: string
  onChange: (field: 'allowance' | 'deduction' | 'note', value: number | string) => void
  readonly: boolean
}

function SummaryPanel({ detail, allowance, deduction, note, onChange, readonly }: SummaryProps) {
  const net = detail.salaryAmount + allowance - deduction

  return (
    <div className="space-y-0">
      {/* Lương cơ bản */}
      <div className="flex items-center justify-between py-4 border-b border-gray-100">
        <div>
          <p className="text-sm font-medium text-gray-700">
            {detail.role === 'DOCTOR' ? 'Tổng lương theo ca' : 'Lương cố định tháng'}
          </p>
          {detail.role === 'DOCTOR' && (
            <p className="text-xs text-gray-400 mt-0.5">
              {detail.sessionCount} ca × tổng giờ quy đổi × HS BS × đơn giá
            </p>
          )}
        </div>
        <span className="text-lg font-bold text-gray-800">{fmtMoney(detail.salaryAmount)}</span>
      </div>

      {/* Phụ cấp */}
      <div className="flex items-center justify-between py-4 border-b border-gray-100">
        <div>
          <p className="text-sm font-medium text-gray-700">Phụ cấp</p>
          <p className="text-xs text-gray-400 mt-0.5">Phụ cấp chuyên cần, thêm giờ…</p>
        </div>
        {readonly ? (
          <span className="text-base font-bold text-blue-600">+{fmtMoney(allowance)}</span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-blue-500 font-bold">+</span>
            <input type="number" min={0} step={50000} value={allowance}
              onChange={e => onChange('allowance', Number(e.target.value))}
              className="w-36 text-right border-0 border-b-2 border-blue-300 bg-transparent
                         focus:outline-none focus:border-blue-500 py-1 text-base font-bold text-blue-600
                         transition-colors" />
            <span className="text-gray-400 text-xs">đ</span>
          </div>
        )}
      </div>

      {/* Khấu trừ */}
      <div className="flex items-center justify-between py-4 border-b border-gray-100">
        <div>
          <p className="text-sm font-medium text-gray-700">Khấu trừ</p>
          <p className="text-xs text-gray-400 mt-0.5">BHXH, đi muộn, nghỉ không phép…</p>
        </div>
        {readonly ? (
          <span className="text-base font-bold text-red-500">−{fmtMoney(deduction)}</span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-red-400 font-bold">−</span>
            <input type="number" min={0} step={50000} value={deduction}
              onChange={e => onChange('deduction', Number(e.target.value))}
              className="w-36 text-right border-0 border-b-2 border-red-300 bg-transparent
                         focus:outline-none focus:border-red-500 py-1 text-base font-bold text-red-500
                         transition-colors" />
            <span className="text-gray-400 text-xs">đ</span>
          </div>
        )}
      </div>

      {/* Net */}
      <div className="pt-4">
        <div style={{ background: 'linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%)', border: '2px solid #86efac' }}
          className="rounded-2xl px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-green-700">💰 Lương thực nhận</p>
            <p className="text-xs text-green-600 mt-0.5 font-mono">
              {fmtMoney(detail.salaryAmount)} + {fmtMoney(allowance)} − {fmtMoney(deduction)}
            </p>
          </div>
          <span className="text-3xl font-extrabold text-green-700 tracking-tight">{fmtMoney(net)}</span>
        </div>
      </div>

      {/* Note */}
      <div className="pt-4">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Ghi chú
        </label>
        {readonly ? (
          <p className="text-sm text-gray-500 italic bg-gray-50 rounded-xl px-4 py-3">
            {note || 'Không có ghi chú'}
          </p>
        ) : (
          <textarea rows={2} value={note}
            onChange={e => onChange('note', e.target.value)}
            placeholder="Ghi chú thêm về phiếu lương này…"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300
                       resize-none placeholder-gray-400 transition-all" />
        )}
      </div>
    </div>
  )
}

// ─── Status Stepper ───────────────────────────────────────────
function StatusStepper({ status }: { status: string | null }) {
  const steps = [
    { key: 'DRAFT',     label: 'Nháp',     icon: FileText },
    { key: 'APPROVED',  label: 'Đã duyệt', icon: CheckCircle2 },
    { key: 'FINALIZED', label: 'Đã chốt',  icon: Lock },
  ]
  const currentStep = status ? (STATUS_META[status]?.step ?? 0) : 0
  const isCancelled = status === 'CANCELLED'

  if (isCancelled) return (
    <div style={{ background: '#fee2e2' }}
      className="rounded-xl px-4 py-2.5 flex items-center gap-2 text-red-600 text-sm font-medium">
      <XCircle size={16} />
      Phiếu đã bị hủy — lập phiếu mới để tiếp tục
    </div>
  )

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => {
        const m      = STATUS_META[step.key]
        const done   = currentStep > i + 1
        const active = currentStep === i + 1
        const Icon   = step.icon
        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div style={{
                background: active ? m.bg : done ? '#dcfce7' : '#f9fafb',
                border: `2px solid ${active ? m.border : done ? '#86efac' : '#e5e7eb'}`,
                color: active ? m.color : done ? '#16a34a' : '#9ca3af',
              }} className="w-9 h-9 rounded-full flex items-center justify-center transition-all">
                <Icon size={16} />
              </div>
              <span className={`text-xs font-semibold whitespace-nowrap
                ${active ? 'text-gray-800' : done ? 'text-green-600' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-16 mx-2 mb-5 rounded transition-all
                ${done || active ? 'bg-green-300' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Action Buttons ───────────────────────────────────────────
interface ActionsProps {
  detail: PayslipDetail
  saving: boolean
  onSave: () => void
  onRecalc: () => void
  onApprove: () => void
  onFinalize: () => void
  onCancel: () => void
}

function ActionButtons({ detail, saving, onSave, onRecalc, onApprove, onFinalize, onCancel }: ActionsProps) {
  const { status } = detail
  const noSlip  = !status || status === 'CANCELLED'
  const isDraft = status === 'DRAFT'
  const isApproved = status === 'APPROVED'

  const BtnPrimary = ({ onClick, icon: Icon, label, color = '#2563eb' }: any) => (
    <button onClick={onClick} disabled={saving}
      style={{ background: color }}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-semibold text-sm
                 shadow-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-40">
      <Icon size={16} />
      {saving ? 'Đang xử lý...' : label}
    </button>
  )

  const BtnOutline = ({ onClick, icon: Icon, label, danger = false }: any) => (
    <button onClick={onClick} disabled={saving}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm
                  border-2 transition-all disabled:opacity-40 active:scale-95
                  ${danger
                    ? 'border-red-200 text-red-500 hover:bg-red-50'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
      <Icon size={16} />
      {saving ? '...' : label}
    </button>
  )

  return (
    <div className="flex flex-wrap items-center gap-3">
      {noSlip && (
        <BtnPrimary onClick={onSave} icon={FileText} label="Lập phiếu nháp" color="#2563eb" />
      )}
      {isDraft && <>
        <BtnPrimary onClick={onSave}    icon={FileText}    label="Lưu thay đổi"  color="#d97706" />
        <BtnOutline onClick={onRecalc}  icon={RefreshCw}   label="Tính lại" />
        <BtnPrimary onClick={onApprove} icon={CheckCircle2} label="Duyệt phiếu" color="#2563eb" />
        <BtnOutline onClick={onCancel}  icon={XCircle}     label="Hủy phiếu" danger />
      </>}
      {isApproved && <>
        <BtnPrimary onClick={onFinalize} icon={Lock}   label="Chốt phiếu" color="#16a34a" />
        <BtnOutline onClick={onCancel}   icon={XCircle} label="Hủy phiếu" danger />
      </>}
      {status === 'FINALIZED' && (
        <div style={{ background: '#f0fdf4', border: '2px solid #86efac' }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-green-700 text-sm font-semibold">
          <Lock size={16} />
          Phiếu đã chốt — liên hệ Admin nếu cần hủy
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────
export default function PayslipPage() {
  const months = monthOptions()

  const [staffList, setStaffList]         = useState<PayslipStaff[]>([])
  const [selectedStaff, setSelectedStaff] = useState<PayslipStaff | null>(null)
  const [month, setMonth]                 = useState(currentMonth())
  const [detail, setDetail]               = useState<PayslipDetail | null>(null)
  const [loading, setLoading]             = useState(false)
  const [saving,  setSaving]              = useState(false)
  const [error,   setError]               = useState<string | null>(null)
  const [toast,   setToast]               = useState<{ msg: string; ok: boolean } | null>(null)

  const [allowance, setAllowance] = useState(0)
  const [deduction, setDeduction] = useState(0)
  const [note,      setNote]      = useState('')

  useEffect(() => { salaryApi.getPayslipStaffList().then(setStaffList).catch(() => {}) }, [])

  useEffect(() => {
    if (!detail) return
    setAllowance(detail.allowance)
    setDeduction(detail.deduction)
    setNote(detail.note ?? '')
  }, [detail])

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const loadData = useCallback(async (uid: number, m: string) => {
    setLoading(true); setError(null); setDetail(null)
    try { setDetail(await salaryApi.getPayslipData(uid, m)) }
    catch (e: any) { setError(e?.response?.data?.message || 'Không thể tải dữ liệu phiếu lương') }
    finally { setLoading(false) }
  }, [])

  const handleGenerate = () => { if (selectedStaff) loadData(selectedStaff.id, month) }

  const doAction = async (fn: () => Promise<any>, successMsg: string) => {
    setSaving(true)
    try {
      await fn()
      showToast(successMsg)
      if (selectedStaff) loadData(selectedStaff.id, month)
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Có lỗi xảy ra', false)
    } finally { setSaving(false) }
  }

  const handleSave     = () => doAction(() =>
    salaryApi.savePayslip({ userId: selectedStaff!.id, month, allowance, deduction, note: note || undefined }),
    'Đã lưu phiếu nháp')
  const handleRecalc   = () => doAction(() => salaryApi.recalcPayslip(detail!.payslipId!),   'Đã tính lại thành công')
  const handleApprove  = () => {
    if (!confirm('Duyệt phiếu lương này?')) return
    doAction(() => salaryApi.approvePayslip(detail!.payslipId!),  'Phiếu đã được duyệt')
  }
  const handleFinalize = () => {
    if (!confirm('Chốt phiếu? Sau khi chốt không thể chỉnh sửa.')) return
    doAction(() => salaryApi.finalizePayslip(detail!.payslipId!), 'Phiếu đã được chốt')
  }
  const handleCancel   = () => {
    if (!confirm('Hủy phiếu lương này?')) return
    doAction(() => salaryApi.cancelPayslip(detail!.payslipId!),   'Phiếu đã bị hủy')
  }

  const handleFieldChange = (field: 'allowance' | 'deduction' | 'note', value: number | string) => {
    if (field === 'allowance') setAllowance(value as number)
    else if (field === 'deduction') setDeduction(value as number)
    else setNote(value as string)
  }

  const isReadonly = detail?.status === 'FINALIZED' || detail?.status === 'CANCELLED'

  const staffByRole: Record<string, PayslipStaff[]> = {}
  for (const s of staffList) {
    if (!staffByRole[s.role]) staffByRole[s.role] = []
    staffByRole[s.role].push(s)
  }

  const net = detail ? detail.salaryAmount + allowance - deduction : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div style={{
          background: toast.ok ? '#16a34a' : '#dc2626',
          boxShadow: '0 8px 30px rgba(0,0,0,.18)',
        }} className="fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl text-white text-sm font-semibold">
          {toast.ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          {toast.msg}
        </div>
      )}

      <div className="max-w-6xl mx-auto p-6 space-y-5">

        {/* ── Page Header ───────────────────────────── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Lập phiếu lương</h1>
            <p className="text-gray-500 text-sm mt-1">Tính toán và quản lý phiếu lương hàng tháng</p>
          </div>
          <div style={{ background: 'linear-gradient(135deg,#2563eb,#7c3aed)' }}
            className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg">
            <Calculator size={22} className="text-white" />
          </div>
        </div>

        {/* ── Selector Card ─────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Staff */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                <User size={12} /> Nhân viên
              </label>
              <div className="relative">
                <select value={selectedStaff?.id ?? ''}
                  onChange={e => {
                    const id = Number(e.target.value)
                    setSelectedStaff(staffList.find(s => s.id === id) ?? null)
                    setDetail(null)
                  }}
                  className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl
                             px-4 py-2.5 pr-10 text-sm font-medium text-gray-700
                             focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400
                             transition-all cursor-pointer">
                  <option value="">Chọn nhân viên…</option>
                  {Object.entries(staffByRole).map(([role, members]) => (
                    <optgroup key={role} label={ROLE_META[role]?.label ?? role}>
                      {members.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.fullName}{s.role === 'DOCTOR' && s.degree ? ` (${s.degree})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Month */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                <CalendarDays size={12} /> Tháng lập phiếu
              </label>
              <div className="relative">
                <select value={month}
                  onChange={e => { setMonth(e.target.value); setDetail(null) }}
                  className="w-full appearance-none bg-gray-50 border border-gray-200 rounded-xl
                             px-4 py-2.5 pr-10 text-sm font-medium text-gray-700
                             focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400
                             transition-all cursor-pointer">
                  {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Button */}
            <div className="flex items-end">
              <button onClick={handleGenerate} disabled={!selectedStaff || loading}
                style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)' }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                           text-white font-semibold text-sm shadow-md
                           hover:shadow-lg hover:opacity-95 active:scale-95
                           transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {loading
                  ? <><RefreshCw size={16} className="animate-spin" /> Đang tính…</>
                  : <><Calculator size={16} /> Lập phiếu lương</>}
              </button>
            </div>
          </div>
        </div>

        {/* ── Error ─────────────────────────────────── */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5' }}
            className="rounded-2xl p-4 flex items-center gap-3 text-red-700">
            <AlertTriangle size={18} className="flex-shrink-0" />
            <p className="text-sm flex-1">{error}</p>
            <button onClick={() => setError(null)}
              className="text-red-300 hover:text-red-500 transition-colors text-lg leading-none">×</button>
          </div>
        )}

        {/* ── Detail ────────────────────────────────── */}
        {detail && (
          <div className="space-y-4">

            {/* Profile + KPIs */}
            <div style={{ background: 'linear-gradient(135deg,#1e40af 0%,#4338ca 100%)' }}
              className="rounded-2xl p-6 text-white shadow-xl">
              <div className="flex flex-wrap items-start justify-between gap-4">

                {/* Left: name + info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-2xl font-extrabold tracking-tight">{detail.fullName}</h2>
                    <span style={{ background: 'rgba(255,255,255,.2)', backdropFilter: 'blur(4px)' }}
                      className="px-2.5 py-0.5 rounded-full text-xs font-semibold">
                      {ROLE_META[detail.role]?.label}
                    </span>
                    {detail.status && (
                      <span style={{ background: 'rgba(255,255,255,.15)' }}
                        className="px-2.5 py-0.5 rounded-full text-xs font-semibold">
                        {STATUS_META[detail.status]?.label}
                      </span>
                    )}
                  </div>
                  {detail.role === 'DOCTOR' && detail.degree && (
                    <p className="text-blue-200 text-sm">
                      Học hàm: <strong className="text-white">{detail.degree}</strong>
                      <span className="mx-2 opacity-40">·</span>
                      HS bác sĩ: <strong className="text-yellow-300">×{detail.doctorCoeff?.toFixed(2)}</strong>
                    </p>
                  )}
                  <p className="text-blue-200 text-sm">
                    Tháng <strong className="text-white">{month.slice(5)}/{month.slice(0, 4)}</strong>
                    {detail.sessionCount !== null && (
                      <span> · <strong className="text-white">{detail.sessionCount}</strong> ca trực</span>
                    )}
                    {detail.totalAdjHours !== null && (
                      <span> · <strong className="text-white">{fmtHours(detail.totalAdjHours)}</strong> quy đổi</span>
                    )}
                  </p>
                </div>

                {/* Right: KPI cards */}
                <div className="flex gap-3 flex-wrap">
                  {detail.role === 'DOCTOR' && detail.hourlyRate && (
                    <div style={{ background: 'rgba(255,255,255,.12)', backdropFilter: 'blur(8px)' }}
                      className="rounded-xl px-4 py-3 text-center min-w-[100px]">
                      <p className="text-xs text-blue-200 font-medium mb-1">Đơn giá/h</p>
                      <p className="text-base font-bold text-white">{fmtMoney(detail.hourlyRate)}</p>
                    </div>
                  )}
                  <div style={{ background: 'rgba(255,255,255,.12)', backdropFilter: 'blur(8px)' }}
                    className="rounded-xl px-4 py-3 text-center min-w-[110px]">
                    <p className="text-xs text-blue-200 font-medium mb-1">Lương ca/CB</p>
                    <p className="text-base font-bold text-white">{fmtMoney(detail.salaryAmount)}</p>
                  </div>
                  <div style={{ background: 'rgba(134,239,172,.2)', border: '1px solid rgba(134,239,172,.4)' }}
                    className="rounded-xl px-5 py-3 text-center min-w-[130px]">
                    <p className="text-xs text-green-200 font-medium mb-1">Lương thực nhận</p>
                    <p className="text-xl font-extrabold text-green-300">{fmtMoney(net)}</p>
                  </div>
                </div>
              </div>

              {/* Pending warning */}
              {detail.hasPendingComplexity && (
                <div style={{ background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.4)' }}
                  className="mt-4 rounded-xl px-4 py-2.5 flex items-center gap-2 text-yellow-200 text-xs">
                  <AlertTriangle size={14} />
                  Còn hệ số phức tạp bệnh nhân chưa phê duyệt (UC4.3) — kết quả có thể thay đổi sau khi chốt duyệt
                </div>
              )}
            </div>

            {/* Doctor shift detail */}
            {detail.role === 'DOCTOR' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div style={{ background: '#eff6ff' }}
                      className="w-8 h-8 rounded-xl flex items-center justify-center">
                      <CalendarDays size={16} className="text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-sm">Chi tiết ca trực</h3>
                      <p className="text-xs text-gray-400">
                        Giờ QĐ = Giờ ca × (HS ca + HS BN) &nbsp;·&nbsp; Thành tiền = Giờ QĐ × HS BS × Đơn giá/h
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-blue-100 border border-blue-300 inline-block" />
                      HS ca
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-purple-100 border border-purple-300 inline-block" />
                      HS BN
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-indigo-100 border border-indigo-300 inline-block" />
                      HS BS
                    </span>
                  </div>
                </div>
                <div className="px-2 py-2">
                  <ShiftTable shifts={detail.shifts} />
                </div>
              </div>
            )}

            {/* Fixed salary info for staff */}
            {detail.role !== 'DOCTOR' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div style={{ background: '#f0fdf4' }}
                    className="w-8 h-8 rounded-xl flex items-center justify-center">
                    <TrendingUp size={16} className="text-green-600" />
                  </div>
                  <h3 className="font-bold text-gray-800 text-sm">Lương cố định</h3>
                </div>
                <div style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1.5px solid #86efac' }}
                  className="rounded-2xl px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-green-800">
                      Lương cố định tháng {month.slice(5)}/{month.slice(0, 4)}
                    </p>
                    <p className="text-xs text-green-600 mt-0.5">Theo quy định tại UC4.1 – Cấu hình lương</p>
                  </div>
                  <span className="text-2xl font-extrabold text-green-700">{fmtMoney(detail.baseSalary)}</span>
                </div>
              </div>
            )}

            {/* Summary + Actions row */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

              {/* Summary: 3/5 */}
              <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-5">
                  <div style={{ background: '#eff6ff' }}
                    className="w-8 h-8 rounded-xl flex items-center justify-center">
                    <Calculator size={16} className="text-blue-600" />
                  </div>
                  <h3 className="font-bold text-gray-800 text-sm">Tổng kết phiếu lương</h3>
                </div>
                <SummaryPanel
                  detail={detail}
                  allowance={allowance}
                  deduction={deduction}
                  note={note}
                  onChange={handleFieldChange}
                  readonly={isReadonly ?? false}
                />
              </div>

              {/* Actions + status: 2/5 */}
              <div className="lg:col-span-2 space-y-4">

                {/* Status stepper */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                    Trạng thái phiếu
                  </p>
                  <StatusStepper status={detail.status} />
                  {detail.createdAt && (
                    <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
                      Lập lúc: {new Date(detail.createdAt).toLocaleString('vi-VN')}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                    Thao tác
                  </p>
                  <ActionButtons
                    detail={detail}
                    saving={saving}
                    onSave={handleSave}
                    onRecalc={handleRecalc}
                    onApprove={handleApprove}
                    onFinalize={handleFinalize}
                    onCancel={handleCancel}
                  />
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
                    <ArrowRight size={12} />
                    {!detail.status && 'Lập nháp → duyệt → chốt'}
                    {detail.status === 'DRAFT' && 'Chỉnh sửa, tính lại rồi duyệt'}
                    {detail.status === 'APPROVED' && 'Đã duyệt — chốt để hoàn tất'}
                    {detail.status === 'FINALIZED' && 'Phiếu đã chốt, không thể chỉnh sửa'}
                    {detail.status === 'CANCELLED' && 'Lập phiếu mới để tiếp tục'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Empty state ────────────────────────────── */}
        {!detail && !loading && !error && (
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
            <div style={{ background: 'linear-gradient(135deg,#eff6ff,#f5f3ff)' }}
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Calculator size={28} className="text-blue-400" />
            </div>
            <h3 className="text-base font-bold text-gray-600 mb-1">Chưa có phiếu lương</h3>
            <p className="text-gray-400 text-sm">Chọn nhân viên và tháng rồi nhấn <strong>Lập phiếu lương</strong></p>
          </div>
        )}
      </div>
    </div>
  )
}
