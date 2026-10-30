import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, CalendarPlus, Eye, Pencil, X, Loader2,
  CheckCircle2, AlertCircle, Clock, User, CalendarDays, Phone,
  ChevronLeft, ChevronRight, RefreshCw, UserCheck,
} from 'lucide-react'
import {
  appointmentsApi,
  type AppointmentItem, type AppointmentDetail,
  type DoctorOption, type ServiceOption,
  STATUS_META,
} from '../../api/appointments.api'

// ─── Design tokens ────────────────────────────────────────────

const card: React.CSSProperties = {
  backgroundColor: 'white', borderRadius: '14px',
  border: '1px solid #e5e7eb', padding: '20px 24px',
}
const inputCss: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1.5px solid #e5e7eb',
  borderRadius: '8px', fontSize: '13px', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit', backgroundColor: 'white',
}
const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: '9px 20px', borderRadius: '8px', border: 'none',
  backgroundColor: '#2563eb', color: 'white', fontWeight: 600,
  fontSize: '13px', cursor: 'pointer',
}
const btnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '6px',
  padding: '7px 14px', borderRadius: '7px',
  border: '1.5px solid #e5e7eb', backgroundColor: 'white',
  color: '#374151', fontWeight: 500, fontSize: '13px', cursor: 'pointer',
}

// ─── Status badge ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: '#9ca3af', bg: '#f9fafb' }
  return (
    <span style={{
      padding: '3px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: 600,
      color: meta.color, backgroundColor: meta.bg, whiteSpace: 'nowrap',
    }}>
      {meta.label}
    </span>
  )
}

// ─── Detail modal (UC05) ──────────────────────────────────────

function DetailModal({
  apt, doctors, services,
  onClose, onEdit, onCancel, onStatusChange,
  statusLoading,
}: {
  apt:           AppointmentDetail
  doctors:       DoctorOption[]
  services:      ServiceOption[]
  onClose:       () => void
  onEdit:        () => void
  onCancel:      () => void
  onStatusChange: (newStatus: string) => void
  statusLoading:  boolean
}) {
  const d        = new Date(apt.appointmentDate)
  const dateStr  = d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr  = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  const canEdit   = ['PENDING', 'CONFIRMED'].includes(apt.status)
  const canCancel = ['PENDING', 'CONFIRMED'].includes(apt.status)

  // Next valid status action (chỉ dành cho lễ tân)
  // CHECKED_IN → IN_PROGRESS sẽ do bác sĩ thực hiện ở trang bác sĩ (chưa phát triển)
  const NEXT_ACTION: Record<string, { label: string; status: string; color: string; icon?: React.ReactNode }> = {
    PENDING:   { label: 'Xác nhận lịch hẹn',  status: 'CONFIRMED',  color: '#2563eb' },
    CONFIRMED: { label: 'Bệnh nhân đã đến',    status: 'CHECKED_IN', color: '#0891b2' },
  }
  const nextAction = NEXT_ACTION[apt.status]

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...card, width: '100%', maxWidth: '520px', padding: '28px 32px', position: 'relative' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '9px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CalendarDays size={18} color="#2563eb" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#111827', margin: 0 }}>
                Chi tiết lịch hẹn {apt.code}
              </h3>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>Trạng thái lịch hẹn:</span>
          <StatusBadge status={apt.status} />
        </div>

        {/* Info rows */}
        {[
          { icon: <User size={15} />,        label: 'Bệnh nhân',       value: apt.patientName },
          { icon: <Phone size={15} />,        label: 'Số điện thoại',   value: apt.patientPhone },
          { icon: <CalendarDays size={15} />, label: 'Ngày hẹn',        value: dateStr },
          { icon: <Clock size={15} />,        label: 'Giờ hẹn',         value: timeStr },
          { icon: <User size={15} />,         label: 'Bác sĩ phụ trách', value: apt.doctorName ? `BS. ${apt.doctorName}` : '—' },
          { icon: <CheckCircle2 size={15} />, label: 'Dịch vụ',         value: apt.serviceName ?? '—' },
        ].map(row => (
          <div key={row.label} style={{ display: 'flex', gap: '12px', padding: '10px 0', borderBottom: '1px solid #f3f4f6', alignItems: 'flex-start' }}>
            <div style={{ color: '#9ca3af', marginTop: '1px', flexShrink: 0 }}>{row.icon}</div>
            <div>
              <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{row.label}</p>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>{row.value}</p>
            </div>
          </div>
        ))}

        {apt.note && (
          <div style={{ marginTop: '10px', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '8px', fontSize: '13px', color: '#6b7280' }}>
            <strong style={{ color: '#374151' }}>Ghi chú:</strong> {apt.note}
          </div>
        )}

        {apt.cancelReason && (
          <div style={{ marginTop: '10px', padding: '10px 12px', backgroundColor: '#fef2f2', borderRadius: '8px', fontSize: '13px', color: '#dc2626' }}>
            <strong>Lý do hủy:</strong> {apt.cancelReason}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {canCancel && (
            <button onClick={onCancel} style={{ ...btnGhost, color: '#dc2626', borderColor: '#fca5a5' }}>
              Hủy lịch
            </button>
          )}
          {canEdit && (
            <button onClick={onEdit} style={{ ...btnGhost }}>
              <Pencil size={13} /> Sửa
            </button>
          )}
          {nextAction && (
            <button
              onClick={() => onStatusChange(nextAction.status)}
              disabled={statusLoading}
              style={{ ...btnPrimary, backgroundColor: nextAction.color, opacity: statusLoading ? 0.7 : 1 }}>
              {statusLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : null}
              {nextAction.label}
            </button>
          )}
          {['CONFIRMED', 'CHECKED_IN'].includes(apt.status) && (
            <button
              onClick={() => onStatusChange('ABSENT')}
              disabled={statusLoading}
              style={{ ...btnGhost, color: '#b45309', borderColor: '#fcd34d' }}>
              Vắng mặt
            </button>
          )}
          {apt.status === 'CHECKED_IN' && (
            <div style={{ fontSize: '11px', color: '#0891b2', backgroundColor: '#ecfeff', padding: '6px 10px', borderRadius: '7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <UserCheck size={12} />
              Chờ bác sĩ tiếp nhận
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Cancel modal (UC03) ──────────────────────────────────────

const CANCEL_REASONS = [
  'Bệnh nhân tự hủy',
  'Bác sĩ có việc đột xuất',
  'Phòng khám đóng cửa',
  'Bệnh nhân không liên lạc được',
  'Lý do khác',
]

function CancelModal({
  apt, onConfirm, onClose, saving,
}: {
  apt:      AppointmentItem
  onConfirm: (reason: string) => void
  onClose:   () => void
  saving:    boolean
}) {
  const [reason,  setReason]  = useState('')
  const [custom,  setCustom]  = useState('')
  const [touched, setTouched] = useState(false)

  const finalReason = reason === 'Lý do khác' ? custom.trim() : reason
  const valid = !!finalReason

  const now = new Date()
  const aptTime = new Date(apt.appointmentDate)
  const minsToApt = (aptTime.getTime() - now.getTime()) / 60_000
  const isUrgent = minsToApt >= 0 && minsToApt <= 30

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: '16px' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...card, width: '100%', maxWidth: '480px', padding: '28px 32px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '9px', backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertCircle size={18} color="#dc2626" />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#111827', margin: 0 }}>
            Hủy lịch hẹn (UC03)
          </h3>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
            <X size={18} />
          </button>
        </div>

        {/* Confirmation message */}
        <p style={{ fontSize: '14px', color: '#374151', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px' }}>
          Bạn có chắc muốn hủy lịch hẹn <strong style={{ color: '#2563eb' }}>{apt.code}</strong> của bệnh nhân <strong>{apt.patientName}</strong>?
        </p>

        {/* Urgent warning */}
        {isUrgent && (
          <div style={{ display: 'flex', gap: '8px', padding: '10px 12px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', marginBottom: '14px', fontSize: '12px', color: '#92400e' }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>Lịch hẹn sắp đến trong <strong>{Math.round(minsToApt)} phút</strong>. Bạn xác nhận muốn hủy?</span>
          </div>
        )}

        {/* Reason */}
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
          Lý do hủy <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <select
          value={reason}
          onChange={e => setReason(e.target.value)}
          onBlur={() => setTouched(true)}
          style={{ ...inputCss, borderColor: touched && !reason ? '#ef4444' : '#e5e7eb', marginBottom: '8px' }}>
          <option value="">Chọn lý do hủy</option>
          {CANCEL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        {reason === 'Lý do khác' && (
          <textarea
            value={custom} rows={2}
            placeholder="Nhập lý do cụ thể..."
            onChange={e => setCustom(e.target.value)}
            style={{ ...inputCss, resize: 'vertical', marginBottom: '8px' }}
          />
        )}

        {touched && !reason && (
          <p style={{ fontSize: '11px', color: '#ef4444', marginBottom: '8px' }}>Vui lòng chọn lý do hủy</p>
        )}

        {/* SMS notice */}
        <div style={{ display: 'flex', gap: '8px', padding: '10px 12px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', marginBottom: '20px', fontSize: '12px', color: '#92400e' }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>Hệ thống sẽ tự động gửi SMS cho bệnh nhân và cập nhật trạng thái thành đã hủy.</span>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnGhost}>Không hủy</button>
          <button
            onClick={() => { setTouched(true); if (valid) onConfirm(finalReason) }}
            disabled={saving}
            style={{ ...btnPrimary, backgroundColor: '#dc2626', opacity: saving ? 0.7 : 1 }}>
            {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            Xác nhận hủy lịch
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit modal (UC02) ────────────────────────────────────────

function EditModal({
  apt, doctors, services,
  onSave, onClose, saving, errorMsg,
}: {
  apt:      AppointmentDetail
  doctors:  DoctorOption[]
  services: ServiceOption[]
  onSave:   (data: Record<string, unknown>) => void
  onClose:  () => void
  saving:   boolean
  errorMsg: string
}) {
  const d = new Date(apt.appointmentDate)
  const pad = (n: number) => String(n).padStart(2, '0')

  const [form, setForm] = useState({
    patientName:     apt.patientName,
    patientPhone:    apt.patientPhone,
    patientDob:      apt.patientDob ?? '',
    patientGender:   apt.patientGender ?? '',
    date:            `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,
    time:            `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    doctorId:        apt.doctorId  ? String(apt.doctorId)  : '',
    serviceId:       apt.serviceId ? String(apt.serviceId) : '',
    note:            apt.note ?? '',
  })

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = () => {
    onSave({
      patientName:     form.patientName.trim(),
      patientPhone:    form.patientPhone.trim(),
      patientDob:      form.patientDob  || null,
      patientGender:   form.patientGender || null,
      doctorId:        form.doctorId  ? Number(form.doctorId)  : null,
      serviceId:       form.serviceId ? Number(form.serviceId) : null,
      note:            form.note.trim() || null,
      appointmentDate: `${form.date}T${form.time}`,
    })
  }

  const inputRow = (label: string, node: React.ReactNode) => (
    <div>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>{label}</label>
      {node}
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1010, padding: '16px' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...card, width: '100%', maxWidth: '580px', padding: '28px 32px', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '9px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Pencil size={16} color="#2563eb" />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#111827', margin: 0 }}>
            Cập nhật lịch hẹn (UC02) — {apt.code}
          </h3>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
            <X size={18} />
          </button>
        </div>

        {/* Form grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
          {inputRow('Họ tên bệnh nhân *',
            <input value={form.patientName} onChange={e => set('patientName', e.target.value)}
              style={inputCss}
              onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
              onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
            />
          )}
          {inputRow('Số điện thoại *',
            <input value={form.patientPhone} onChange={e => set('patientPhone', e.target.value)}
              style={inputCss}
              onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
              onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
            />
          )}
          {inputRow('Ngày hẹn *',
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              style={inputCss}
              onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
              onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
            />
          )}
          {inputRow('Giờ hẹn *',
            <input type="time" value={form.time} onChange={e => set('time', e.target.value)}
              style={inputCss}
              onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
              onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
            />
          )}
          {inputRow('Bác sĩ phụ trách *',
            <select value={form.doctorId} onChange={e => set('doctorId', e.target.value)}
              style={{ ...inputCss, appearance: 'none' }}
              onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
              onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
            >
              <option value="">— Chọn bác sĩ —</option>
              {doctors.map(d => <option key={d.id} value={d.id}>BS. {d.fullName}</option>)}
            </select>
          )}
          {inputRow('Dịch vụ *',
            <select value={form.serviceId} onChange={e => set('serviceId', e.target.value)}
              style={{ ...inputCss, appearance: 'none' }}
              onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
              onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
            >
              <option value="">— Chọn dịch vụ —</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>

        {inputRow('Ghi chú',
          <textarea value={form.note} rows={2} onChange={e => set('note', e.target.value)}
            style={{ ...inputCss, resize: 'vertical' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
            onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
          />
        )}

        {/* Conflict check notice */}
        <div style={{ display: 'flex', gap: '8px', padding: '10px 12px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', margin: '14px 0', fontSize: '12px', color: '#92400e' }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            <strong>Kiểm tra xung đột lịch</strong><br />
            Hệ thống sẽ tự động kiểm tra xung đột lịch và thông báo nếu ca khám đã đầy.
          </div>
        </div>

        {errorMsg && (
          <div style={{ padding: '10px 12px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '13px', color: '#dc2626', marginBottom: '12px' }}>
            {errorMsg}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnGhost}>Hủy bỏ</button>
          <button onClick={handleSave} disabled={saving}
            style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}>
            {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            Cập nhật
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Toast notification ───────────────────────────────────────

function Toast({ msg, type, onDismiss }: { msg: string; type: 'success' | 'error'; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 2000,
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '12px 18px', borderRadius: '10px', maxWidth: '360px',
      backgroundColor: type === 'success' ? '#f0fdf4' : '#fef2f2',
      border: `1px solid ${type === 'success' ? '#bbf7d0' : '#fca5a5'}`,
      boxShadow: '0 4px 16px rgba(0,0,0,.12)',
      fontSize: '13px', fontWeight: 600,
      color: type === 'success' ? '#16a34a' : '#dc2626',
    }}>
      {type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      {msg}
      <button onClick={onDismiss} style={{ marginLeft: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '2px' }}>
        <X size={13} />
      </button>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════════════════════════

type Tab = 'all' | 'today' | 'upcoming'

export default function AppointmentListPage() {
  const navigate = useNavigate()

  // ── Filters ───────────────────────────────────────────────────
  const [tab,      setTab]      = useState<Tab>('all')
  const [search,   setSearch]   = useState('')
  const [statusF,  setStatusF]  = useState('')
  const [doctorF,  setDoctorF]  = useState<number | null>(null)
  const [page,     setPage]     = useState(1)

  // ── Data ──────────────────────────────────────────────────────
  const [items,        setItems]        = useState<AppointmentItem[]>([])
  const [pagination,   setPagination]   = useState({ page: 1, limit: 20, total: 0, totalPages: 1 })
  const [tabCounts,    setTabCounts]    = useState({ all: 0, today: 0, upcoming: 0 })
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [loading,      setLoading]      = useState(false)

  const [doctors,  setDoctors]  = useState<DoctorOption[]>([])
  const [services, setServices] = useState<ServiceOption[]>([])

  // ── Modal state ───────────────────────────────────────────────
  const [detailApt, setDetailApt] = useState<AppointmentDetail | null>(null)
  const [detailOpen,   setDetailOpen]   = useState(false)
  const [editOpen,     setEditOpen]     = useState(false)
  const [cancelOpen,   setCancelOpen]   = useState(false)
  const [cancelTarget, setCancelTarget] = useState<AppointmentItem | null>(null)

  const [saving,       setSaving]       = useState(false)
  const [statusBusy,   setStatusBusy]   = useState(false)
  const [statusBusyId, setStatusBusyId] = useState<number | null>(null)
  const [editError,    setEditError]    = useState('')
  const [toast,       setToast]       = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // search debounce
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 400)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search])

  // ── Load list ─────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await appointmentsApi.list({
        tab, status: statusF || undefined, doctorId: doctorF ?? undefined,
        search: debouncedSearch || undefined, page, limit: 20,
      })
      setItems(res.data.items)
      setPagination(res.data.pagination)
      setTabCounts(res.data.tabCounts)
      setStatusCounts(res.data.statusCounts)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [tab, statusF, doctorF, debouncedSearch, page])

  useEffect(() => { loadList() }, [loadList])

  // Load dropdowns once
  useEffect(() => {
    appointmentsApi.getDoctors().then(r => setDoctors(r.data)).catch(() => {})
    appointmentsApi.getServices().then(r => setServices(r.data)).catch(() => {})
  }, [])

  // ── Helpers ───────────────────────────────────────────────────
  const showToast = (msg: string, type: 'success' | 'error') => setToast({ msg, type })

  const openDetail = async (id: number) => {
    try {
      const res = await appointmentsApi.get(id)
      setDetailApt(res.data)
      setDetailOpen(true)
    } catch { showToast('Không thể tải chi tiết lịch hẹn', 'error') }
  }

  const openEdit = async (id: number) => {
    try {
      const res = await appointmentsApi.get(id)
      setDetailApt(res.data)
      setEditOpen(true); setDetailOpen(false)
      setEditError('')
    } catch { showToast('Không thể tải thông tin lịch hẹn', 'error') }
  }

  const handleStatusChange = async (id: number, newStatus: string) => {
    setStatusBusy(true)
    setStatusBusyId(id)
    try {
      const res = await appointmentsApi.patchStatus(id, newStatus)
      // Cập nhật detailApt nếu modal đang mở
      if (detailApt?.id === id) setDetailApt(res.data as AppointmentDetail)
      const STATUS_LABEL: Record<string, string> = {
        CONFIRMED:  'Đã xác nhận lịch hẹn',
        CHECKED_IN: 'Đã check-in bệnh nhân',
        IN_PROGRESS:'Bắt đầu khám',
        COMPLETED:  'Đã hoàn thành',
        ABSENT:     'Đã đánh dấu vắng mặt',
      }
      showToast(STATUS_LABEL[newStatus] ?? 'Cập nhật trạng thái thành công', 'success')
      loadList()
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Lỗi cập nhật trạng thái', 'error')
    } finally { setStatusBusy(false); setStatusBusyId(null) }
  }

  const handleEdit = async (data: Record<string, unknown>) => {
    if (!detailApt) return
    setSaving(true); setEditError('')
    try {
      await appointmentsApi.update(detailApt.id, data as Parameters<typeof appointmentsApi.update>[1])
      showToast('Cập nhật lịch hẹn thành công', 'success')
      setEditOpen(false)
      loadList()
    } catch (e: any) {
      setEditError(e.response?.data?.message || 'Lỗi khi cập nhật. Vui lòng thử lại.')
    } finally { setSaving(false) }
  }

  const handleCancel = async (reason: string) => {
    if (!cancelTarget) return
    setSaving(true)
    try {
      await appointmentsApi.cancel(cancelTarget.id, reason)
      showToast('Đã hủy lịch hẹn thành công', 'success')
      setCancelOpen(false); setCancelTarget(null)
      if (detailOpen && detailApt?.id === cancelTarget.id) setDetailOpen(false)
      loadList()
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Lỗi khi hủy lịch hẹn', 'error')
    } finally { setSaving(false) }
  }

  // ── Render helpers ────────────────────────────────────────────
  const formatDateTime = (iso: string) => {
    const d = new Date(iso)
    return {
      date: `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`,
      time: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`,
    }
  }

  // Quick status actions visible directly in the table row
  const INLINE_ACTION: Record<string, { label: string; status: string; color: string; bg: string; icon: React.ReactNode }> = {
    PENDING:   { label: 'Xác nhận',       status: 'CONFIRMED',  color: '#2563eb', bg: '#eff6ff', icon: <CheckCircle2 size={12} /> },
    CONFIRMED: { label: 'Check-in',       status: 'CHECKED_IN', color: '#0891b2', bg: '#ecfeff', icon: <UserCheck size={12} /> },
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'all',      label: `Tất cả (${tabCounts.all})` },
    { key: 'today',    label: `Hôm nay (${tabCounts.today})` },
    { key: 'upcoming', label: `Sắp tới (${tabCounts.upcoming})` },
  ]

  const STATUS_ORDER = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'ABSENT', 'CANCELLED']

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>Danh sách lịch hẹn</h2>
          <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>Hệ thống quản lý phòng khám DentCare Pro</p>
        </div>
        <button onClick={() => navigate('/staff/appointments/new')} style={btnPrimary}>
          <CalendarPlus size={15} /> + Đặt lịch hẹn mới
        </button>
      </div>

      {/* ── UC label + status counters ── */}
      <div style={{ ...card, marginBottom: '16px', padding: '16px 24px' }}>
        <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 10px', letterSpacing: '0.3px' }}>
          Quản lý Lịch hẹn &nbsp;•&nbsp;
          {['UC01','UC02','UC03','UC04','UC05'].map((uc, i) => (
            <span key={uc} style={{ color: ['#f97316','#3b82f6','#ef4444','#a855f7','#22c55e'][i], fontWeight: 700 }}>{uc}{i < 4 ? ' • ' : ''}</span>
          ))}
        </p>
        <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
          {/* Total */}
          <div>
            <p style={{ fontSize: '28px', fontWeight: 800, color: '#111827', margin: 0, lineHeight: 1 }}>
              {Object.values(statusCounts).reduce((a, b) => a + b, 0)}
            </p>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0' }}>Tất cả</p>
          </div>
          {STATUS_ORDER.map(st => {
            const cnt  = statusCounts[st] ?? 0
            const meta = STATUS_META[st]
            if (!cnt) return null
            return (
              <div key={st}>
                <p style={{ fontSize: '28px', fontWeight: 800, color: meta.color, margin: 0, lineHeight: 1 }}>{cnt}</p>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0' }}>{meta.label}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '14px', borderBottom: '2px solid #e5e7eb', paddingBottom: '0' }}>
        {TABS.map(t => (
          <button key={t.key}
            onClick={() => { setTab(t.key); setPage(1) }}
            style={{
              padding: '9px 18px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? '#2563eb' : '#6b7280',
              borderBottom: `2px solid ${tab === t.key ? '#2563eb' : 'transparent'}`,
              marginBottom: '-2px', transition: 'color .15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Search + Filters ── */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '260px' }}>
          <Search size={14} color="#9ca3af" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type="text" value={search} placeholder="Tìm theo tên bệnh nhân, mã lịch, SĐT..."
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputCss, paddingLeft: '32px' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
            onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
          />
        </div>
        <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1) }}
          style={{ ...inputCss, width: 'auto', minWidth: '160px', appearance: 'none' }}>
          <option value="">Tất cả trạng thái</option>
          {STATUS_ORDER.map(st => (
            <option key={st} value={st}>{STATUS_META[st]?.label ?? st}</option>
          ))}
        </select>
        <select value={doctorF ?? ''} onChange={e => { setDoctorF(e.target.value ? Number(e.target.value) : null); setPage(1) }}
          style={{ ...inputCss, width: 'auto', minWidth: '170px', appearance: 'none' }}>
          <option value="">Tất cả bác sĩ</option>
          {doctors.map(d => <option key={d.id} value={d.id}>BS. {d.fullName}</option>)}
        </select>
        <button onClick={() => { setSearch(''); setStatusF(''); setDoctorF(null); setPage(1) }}
          style={{ ...btnGhost, padding: '8px 10px' }} title="Xóa bộ lọc">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* ── Table ── */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '140px 1fr 1fr 1fr 130px 160px 80px',
          gap: '0', backgroundColor: '#f9fafb',
          borderBottom: '1px solid #e5e7eb', padding: '10px 20px',
        }}>
          {['MÃ / NGÀY', 'BỆNH NHÂN', 'BÁC SĨ', 'DỊCH VỤ', 'TRẠNG THÁI', 'CẬP NHẬT NHANH', 'THAO TÁC'].map(h => (
            <div key={h} style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{h}</div>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
            <Loader2 size={24} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af', fontSize: '14px' }}>
            Không tìm thấy lịch hẹn nào phù hợp
          </div>
        ) : (
          items.map((apt, idx) => {
            const { date, time } = formatDateTime(apt.appointmentDate)
            const canEdit   = ['PENDING', 'CONFIRMED'].includes(apt.status)
            const canCancel = ['PENDING', 'CONFIRMED'].includes(apt.status)

            const inlineAction = INLINE_ACTION[apt.status]
            const isRowBusy = statusBusyId === apt.id

            return (
              <div key={apt.id} style={{
                display: 'grid',
                gridTemplateColumns: '140px 1fr 1fr 1fr 130px 160px 80px',
                gap: '0', padding: '12px 20px', alignItems: 'center',
                borderBottom: idx < items.length - 1 ? '1px solid #f3f4f6' : 'none',
                backgroundColor: 'white',
              }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fafbff')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'white')}
              >
                {/* Code + date */}
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#2563eb', margin: '0 0 2px' }}>{apt.code}</p>
                  <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>
                    {date} &nbsp;
                    <span style={{ color: '#374151', fontWeight: 600 }}>{time}</span>
                  </p>
                </div>

                {/* Patient */}
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                    {apt.patientName}
                  </p>
                  <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>{apt.patientPhone}</p>
                </div>

                {/* Doctor */}
                <p style={{ fontSize: '13px', color: '#374151', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {apt.doctorName ? `BS. ${apt.doctorName}` : <span style={{ color: '#d1d5db' }}>—</span>}
                </p>

                {/* Service */}
                <p style={{ fontSize: '13px', color: '#374151', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {apt.serviceName ?? <span style={{ color: '#d1d5db' }}>—</span>}
                </p>

                {/* Status */}
                <StatusBadge status={apt.status} />

                {/* Quick status update */}
                <div>
                  {inlineAction ? (
                    <button
                      onClick={() => handleStatusChange(apt.id, inlineAction.status)}
                      disabled={isRowBusy || statusBusy}
                      title={inlineAction.label}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '5px 11px', borderRadius: '7px', border: 'none',
                        backgroundColor: inlineAction.bg, color: inlineAction.color,
                        fontWeight: 600, fontSize: '12px', cursor: 'pointer',
                        opacity: (isRowBusy || statusBusy) ? 0.6 : 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isRowBusy
                        ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                        : inlineAction.icon}
                      {inlineAction.label}
                    </button>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#d1d5db' }}>—</span>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  {/* View */}
                  <button onClick={() => openDetail(apt.id)} title="Xem chi tiết"
                    style={{ padding: '6px', borderRadius: '6px', border: 'none', backgroundColor: '#eff6ff', cursor: 'pointer', color: '#2563eb', display: 'flex', alignItems: 'center' }}>
                    <Eye size={14} />
                  </button>
                  {/* Edit */}
                  {canEdit && (
                    <button onClick={() => openEdit(apt.id)} title="Chỉnh sửa"
                      style={{ padding: '6px', borderRadius: '6px', border: 'none', backgroundColor: '#fafafa', cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center' }}>
                      <Pencil size={14} />
                    </button>
                  )}
                  {/* Cancel */}
                  {canCancel && (
                    <button
                      onClick={() => { setCancelTarget(apt); setCancelOpen(true) }}
                      title="Hủy lịch hẹn"
                      style={{ padding: '6px', borderRadius: '6px', border: 'none', backgroundColor: '#fef2f2', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center' }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid #f3f4f6', backgroundColor: '#fafafa' }}>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
              Hiển thị {Math.min((page - 1) * pagination.limit + 1, pagination.total)}–{Math.min(page * pagination.limit, pagination.total)} / {pagination.total} lịch hẹn
            </p>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ ...btnGhost, padding: '6px 10px', opacity: page === 1 ? 0.4 : 1 }}>
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                // Window of 5 pages around current
                const half  = 2
                let start = Math.max(1, page - half)
                const end   = Math.min(pagination.totalPages, start + 4)
                start = Math.max(1, end - 4)
                const n = start + i
                if (n > pagination.totalPages) return null
                return (
                  <button key={n} onClick={() => setPage(n)}
                    style={{
                      padding: '6px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                      fontWeight: n === page ? 700 : 500, fontSize: '13px', minWidth: '34px',
                      backgroundColor: n === page ? '#2563eb' : 'white',
                      color: n === page ? 'white' : '#374151',
                    }}>
                    {n}
                  </button>
                )
              })}
              <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
                style={{ ...btnGhost, padding: '6px 10px', opacity: page === pagination.totalPages ? 0.4 : 1 }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
        {pagination.totalPages <= 1 && items.length > 0 && (
          <div style={{ padding: '10px 20px', borderTop: '1px solid #f3f4f6', backgroundColor: '#fafafa' }}>
            <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
              Hiển thị {items.length} / {pagination.total} lịch hẹn
            </p>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {detailOpen && detailApt && (
        <DetailModal
          apt={detailApt}
          doctors={doctors}
          services={services}
          onClose={() => setDetailOpen(false)}
          onEdit={() => { setEditOpen(true); setDetailOpen(false); setEditError('') }}
          onCancel={() => { setCancelTarget(detailApt); setCancelOpen(true) }}
          onStatusChange={(s) => handleStatusChange(detailApt.id, s)}
          statusLoading={statusBusy}
        />
      )}

      {editOpen && detailApt && (
        <EditModal
          apt={detailApt}
          doctors={doctors}
          services={services}
          onSave={handleEdit}
          onClose={() => setEditOpen(false)}
          saving={saving}
          errorMsg={editError}
        />
      )}

      {cancelOpen && cancelTarget && (
        <CancelModal
          apt={cancelTarget}
          onConfirm={handleCancel}
          onClose={() => { setCancelOpen(false); setCancelTarget(null) }}
          saving={saving}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />
      )}

      {/* Keyframe for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
