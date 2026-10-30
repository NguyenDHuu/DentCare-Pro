import { useState, useEffect, useCallback } from 'react'
import {
  Plus, ChevronLeft, ChevronRight, X, Loader2,
  AlertTriangle, Pencil, Trash2, UserRound, CalendarDays,
  LayoutGrid, Users, Layers, CalendarRange, CheckCircle2, XCircle,
} from 'lucide-react'
import {
  scheduleApi,
  type ScheduleItem, type ScheduleInput, type FormDoctor, type HolidayInfo,
  type BatchScheduleInput, type BatchPreviewResult, type BatchDayResult, type BatchCreateResult,
} from '../../api/schedules.api'
import type { WorkShift } from '../../api/shifts.api'

// ─── Date helpers ─────────────────────────────────────────────

const getMondayOfWeek = (d: Date): Date => {
  const date = new Date(d)
  const day  = date.getDay()
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1))
  date.setHours(0, 0, 0, 0)
  return date
}

const addDays = (d: Date, n: number): Date => {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

/** Format Date → "YYYY-MM-DD" dùng LOCAL time (tránh UTC off-by-one ở UTC+7) */
const toDateStr = (d: Date): string => {
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

const fmtDate = (d: Date): string =>
  d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }).replace('/', '-')

const VN_DAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] // idx = js getDay()

/** js getDay() → our applyDay system */
const jsToApplyDay = (jsDay: number): number => (jsDay === 0 ? 0 : jsDay + 1)

const getShiftHours = (start: string, end: string): number => {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em - (sh * 60 + sm)) / 60
}

// ─── Constants ───────────────────────────────────────────────

const WEEK_DAYS_COUNT = 6 // Mon–Sat

const COLOR: Record<string, { text: string; iconBg: string }> = {
  blue:   { text: '#2563eb', iconBg: '#dbeafe' },
  green:  { text: '#16a34a', iconBg: '#dcfce7' },
  purple: { text: '#9333ea', iconBg: '#f3e8ff' },
  orange: { text: '#ea580c', iconBg: '#ffedd5' },
  red:    { text: '#e11d48', iconBg: '#ffe4e6' },
  teal:   { text: '#0d9488', iconBg: '#ccfbf1' },
  pink:   { text: '#c026d3', iconBg: '#fae8ff' },
}

const btn = {
  base:    { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none' } as React.CSSProperties,
  primary: { backgroundColor: '#2563eb', color: 'white' } as React.CSSProperties,
  ghost:   { backgroundColor: 'transparent', color: '#6b7280', border: '1px solid #e5e7eb' } as React.CSSProperties,
  danger:  { backgroundColor: '#dc2626', color: 'white' } as React.CSSProperties,
}

// ─── Holiday helpers ──────────────────────────────────────────

const tmToMin = (t: string): number => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Returns the first holiday that blocks this date+shift combination, or null */
const getHolidayBlock = (
  dateStr: string,
  shiftStart: string,
  shiftEnd:   string,
  holidays:   HolidayInfo[]
): HolidayInfo | null => {
  for (const h of holidays) {
    if (dateStr < h.startDate || dateStr > h.endDate) continue
    if (h.type === 'NATIONAL') return h
    if (!h.startTime || !h.endTime) return h   // full-day PRIVATE/RECURRING
    // Time-window overlap
    if (tmToMin(shiftStart) < tmToMin(h.endTime) && tmToMin(shiftEnd) > tmToMin(h.startTime))
      return h
  }
  return null
}

/** Returns all holidays that cover this date (for header badge) */
const getDayHolidays = (dateStr: string, holidays: HolidayInfo[]): HolidayInfo[] =>
  holidays.filter(h => dateStr >= h.startDate && dateStr <= h.endDate)

// ─── Toast ───────────────────────────────────────────────────

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
      backgroundColor: type === 'success' ? '#22c55e' : '#ef4444',
      color: 'white', padding: '12px 20px', borderRadius: '10px',
      fontSize: '14px', fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      display: 'flex', alignItems: 'center', gap: '10px',
    }}>
      {type === 'success' ? '✓' : '✕'} {msg}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0 }}><X size={14} /></button>
    </div>
  )
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 14px', color: '#dc2626', fontSize: '13px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
      <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '1px' }} /> {msg}
    </div>
  )
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
      {children}
    </div>
  )
}

// ─── Assignment Form Modal ────────────────────────────────────

function AssignModal({
  doctors, shifts, groups,
  prefillDate, prefillShiftId,
  onSave, onClose,
}: {
  doctors:         FormDoctor[]
  shifts:          WorkShift[]
  groups:          { id: number; name: string }[]
  prefillDate?:    string
  prefillShiftId?: number
  onSave:          (data: ScheduleInput) => Promise<void>
  onClose:         () => void
}) {
  const [doctorId,       setDoctorId]       = useState<number>(doctors[0]?.id ?? 0)
  const [workDate,       setWorkDate]       = useState(prefillDate ?? '')
  const [shiftId,        setShiftId]        = useState<number>(prefillShiftId ?? (shifts[0]?.id ?? 0))
  const [serviceGroupId, setServiceGroupId] = useState<number>(0)
  const [note,           setNote]           = useState('')
  const [isOverride,     setIsOverride]     = useState(false)
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState('')

  const selectedDoctor = doctors.find(d => d.id === doctorId)
  const doctorGroups   = selectedDoctor?.groups ?? []

  // Filter shifts by selected date
  const availableShifts = workDate
    ? shifts.filter(s => {
        const applyDay = jsToApplyDay(new Date(workDate + 'T12:00:00').getDay())
        return (s.applyDays as number[]).includes(applyDay)
      })
    : shifts

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb',
    borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  }
  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    (e.currentTarget.style.borderColor = '#3b82f6')
  const onBlur  = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    (e.currentTarget.style.borderColor = '#e5e7eb')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!doctorId) { setError('Vui lòng chọn bác sĩ'); return }
    if (!workDate) { setError('Vui lòng chọn ngày làm việc'); return }
    if (!shiftId)  { setError('Vui lòng chọn ca làm việc'); return }
    setLoading(true); setError('')
    try {
      await onSave({
        doctorId, shiftId, workDate,
        serviceGroupId: serviceGroupId || null,
        note: note.trim() || undefined,
        isOverride,
      })
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi hệ thống')
      setLoading(false)
    }
  }

  return (
    <Overlay>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#111827', margin: 0 }}>Phân công lịch trực</h3>
            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Đăng ký ca trực cho bác sĩ (UC08)</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px' }}><X size={18} /></button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ overflow: 'auto', flex: 1 }}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {error && <ErrorBanner msg={error} />}

            {/* Bác sĩ */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Bác sĩ <span style={{ color: '#ef4444' }}>*</span></label>
              <select value={doctorId} onChange={e => { setDoctorId(Number(e.target.value)); setServiceGroupId(0) }}
                style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }} onFocus={onFocus} onBlur={onBlur}>
                <option value={0} disabled>-- Chọn bác sĩ --</option>
                {doctors.map(d => <option key={d.id} value={d.id}>BS. {d.fullName}</option>)}
              </select>
            </div>

            {/* Ngày + Ca */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Ngày làm việc <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="date" value={workDate} onChange={e => setWorkDate(e.target.value)}
                  min={toDateStr(new Date(Date.now() + 86400000))}
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Ca làm việc <span style={{ color: '#ef4444' }}>*</span></label>
                <select value={shiftId} onChange={e => setShiftId(Number(e.target.value))}
                  style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }} onFocus={onFocus} onBlur={onBlur}>
                  <option value={0} disabled>-- Chọn ca --</option>
                  {availableShifts.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
                  ))}
                </select>
                {workDate && availableShifts.length === 0 && (
                  <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>Không có ca nào hoạt động ngày này</p>
                )}
              </div>
            </div>

            {/* Nhóm dịch vụ */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Nhóm dịch vụ phụ trách</label>
              <select value={serviceGroupId} onChange={e => setServiceGroupId(Number(e.target.value))}
                style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }} onFocus={onFocus} onBlur={onBlur}>
                <option value={0}>-- Không chỉ định --</option>
                {(doctorGroups.length > 0 ? doctorGroups : groups).map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              {doctorGroups.length > 0 && (
                <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Hiển thị nhóm bác sĩ được phân công</p>
              )}
            </div>

            {/* Ghi chú */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Ghi chú</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="Ghi chú thêm (nếu có)..."
                style={{ ...inputStyle, resize: 'vertical' }}
                onFocus={onFocus} onBlur={onBlur} />
            </div>

            {/* Override */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', padding: '10px 12px', backgroundColor: isOverride ? '#fff7ed' : '#f9fafb', borderRadius: '8px', border: `1px solid ${isOverride ? '#fed7aa' : '#e5e7eb'}` }}>
              <input type="checkbox" checked={isOverride} onChange={e => setIsOverride(e.target.checked)}
                style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: '#ea580c', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: isOverride ? '#ea580c' : '#374151', margin: 0 }}>Nghỉ đột xuất / Trường hợp khẩn cấp [E3]</p>
                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Bỏ qua ràng buộc đăng ký trước 1 ngày. Sẽ ghi nhật ký đặc biệt.</p>
              </div>
            </label>
          </div>

          {/* Footer */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={onClose} style={{ ...btn.base, ...btn.ghost }}>Hủy</button>
            <button type="submit" disabled={loading} style={{ ...btn.base, ...btn.primary, opacity: loading ? 0.7 : 1 }}>
              {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              Lưu lịch trực
            </button>
          </div>
        </form>
      </div>
    </Overlay>
  )
}

// ─── Delete Confirm Modal ─────────────────────────────────────

function DeleteModal({ item, onConfirm, onClose }: { item: ScheduleItem; onConfirm: (override: boolean) => Promise<void>; onClose: () => void }) {
  const [loading,    setLoading]    = useState(false)
  const [override,   setOverride]   = useState(false)
  const [error,      setError]      = useState('')

  const handleConfirm = async () => {
    setLoading(true); setError('')
    try { await onConfirm(override) }
    catch (e: any) { setError(e.response?.data?.message || 'Không thể hủy lịch trực'); setLoading(false) }
  }

  const isToday = item.workDate === toDateStr(new Date())
  const isPast  = item.workDate < toDateStr(new Date())

  return (
    <Overlay>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '420px', padding: '28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={18} color="#dc2626" />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>Hủy lịch trực</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px' }}><X size={18} /></button>
        </div>

        <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px' }}>
          <p style={{ fontSize: '14px', color: '#111827', fontWeight: 600, margin: '0 0 4px' }}>BS. {item.doctorName}</p>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{item.shiftName} · {item.workDate}</p>
          {item.serviceGroupName && <p style={{ fontSize: '13px', color: '#6b7280', margin: '2px 0 0' }}>{item.serviceGroupName}</p>}
        </div>

        {(isToday || isPast) && (
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', padding: '10px 12px', backgroundColor: '#fff7ed', borderRadius: '8px', border: '1px solid #fed7aa', marginBottom: '16px' }}>
            <input type="checkbox" checked={override} onChange={e => setOverride(e.target.checked)}
              style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: '#ea580c', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#ea580c', margin: 0 }}>Nghỉ đột xuất [E3]</p>
              <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Hủy ca trong ngày hôm nay/đã qua. Ghi log khẩn cấp.</p>
            </div>
          </label>
        )}

        {error && <div style={{ marginBottom: '16px' }}><ErrorBanner msg={error} /></div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} style={{ ...btn.base, ...btn.ghost }}>Đóng</button>
          <button onClick={handleConfirm} disabled={loading} style={{ ...btn.base, ...btn.danger, opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            Xác nhận hủy
          </button>
        </div>
      </div>
    </Overlay>
  )
}

// ─── Doctor Summary Card ──────────────────────────────────────

function DoctorCard({ doctorId, doctorName, schedules, shifts }: {
  doctorId:  number
  doctorName: string
  schedules: ScheduleItem[]
  shifts:    WorkShift[]
}) {
  const mySchedules = schedules.filter(s => s.doctorId === doctorId)
  const totalHours  = mySchedules.reduce((sum, s) => {
    const sh = shifts.find(sh => sh.id === s.shiftId)
    return sum + (sh ? getShiftHours(sh.startTime, sh.endTime) : getShiftHours(s.shiftStartTime, s.shiftEndTime))
  }, 0)
  const STANDARD    = 48
  const pct         = Math.min(100, (totalHours / STANDARD) * 100)
  const isOver      = totalHours > STANDARD

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '16px', minWidth: '200px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <UserRound size={16} color="#2563eb" />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>BS. {doctorName}</p>
          <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>Tổng: <strong style={{ color: isOver ? '#dc2626' : '#374151' }}>{totalHours.toFixed(1)}h</strong></p>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>
        <span>Giờ chuẩn</span>
        <span style={{ fontWeight: 600, color: isOver ? '#dc2626' : '#374151' }}>{totalHours.toFixed(1)}h</span>
      </div>
      <div style={{ height: '6px', backgroundColor: '#f3f4f6', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: isOver ? '#dc2626' : '#3b82f6', borderRadius: '99px', transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

// ─── Schedule Card (in grid cell) ────────────────────────────

function ScheduleCell({
  schedules: cellSchedules, allDaySchedules, shift,
  onAdd, onEdit, onDelete,
}: {
  schedules:      ScheduleItem[]
  allDaySchedules: ScheduleItem[]
  shift:          WorkShift
  onAdd:          () => void
  onEdit:         (item: ScheduleItem) => void
  onDelete:       (item: ScheduleItem) => void
}) {
  const [hover, setHover] = useState(false)

  if (cellSchedules.length === 0) {
    return (
      <div
        onClick={onAdd}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', borderRadius: '8px',
          backgroundColor: hover ? '#f0fdf4' : 'transparent',
          transition: 'background 0.15s',
        }}
      >
        <span style={{ fontSize: '12px', color: hover ? '#16a34a' : '#d1d5db', display: 'flex', alignItems: 'center', gap: '4px' }}>
          {hover ? <><Plus size={12} /> Thêm</> : 'Chưa phân công'}
        </span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '4px 0' }}>
      {cellSchedules.map(item => {
        const docDayShifts  = allDaySchedules.filter(s => s.doctorId === item.doctorId && s.workDate === item.workDate)
        const dayHours      = docDayShifts.reduce((sum, s) => sum + getShiftHours(s.shiftStartTime, s.shiftEndTime), 0)
        const overtimeHours = Math.max(0, dayHours - 8)
        const isOvertime    = overtimeHours > 0
        const c             = COLOR[shift.colorCode] ?? COLOR.blue

        return (
          <div key={item.id}
            style={{
              backgroundColor: isOvertime ? '#fef9c3' : c.iconBg,
              border: `1px solid ${isOvertime ? '#fde047' : '#e5e7eb'}`,
              borderRadius: '8px', padding: '8px 10px',
              position: 'relative',
            }}
          >
            <p style={{ fontSize: '12px', fontWeight: 700, color: isOvertime ? '#92400e' : '#111827', margin: 0 }}>
              BS. {item.doctorName}
            </p>
            {item.serviceGroupName && (
              <p style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.serviceGroupName}
              </p>
            )}
            <p style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 0' }}>
              {item.shiftStartTime}–{item.shiftEndTime}
            </p>
            <p style={{ fontSize: '11px', color: '#374151', margin: '2px 0 0' }}>
              {item.appointmentCount}/{item.shiftMaxPatients} lịch hẹn
            </p>
            {isOvertime && (
              <p style={{ fontSize: '10px', color: '#d97706', fontWeight: 700, margin: '3px 0 0' }}>
                +{overtimeHours.toFixed(1)}h tăng ca
              </p>
            )}
            {/* Edit/Delete buttons */}
            <div style={{ position: 'absolute', top: '6px', right: '6px', display: 'flex', gap: '3px' }}>
              <button onClick={e => { e.stopPropagation(); onEdit(item) }}
                style={{ width: '22px', height: '22px', border: 'none', borderRadius: '4px', background: 'rgba(255,255,255,0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                <Pencil size={11} />
              </button>
              <button onClick={e => { e.stopPropagation(); onDelete(item) }}
                style={{ width: '22px', height: '22px', border: 'none', borderRadius: '4px', background: 'rgba(255,255,255,0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        )
      })}

      {/* Add more */}
      <button onClick={onAdd}
        style={{ fontSize: '11px', color: '#9ca3af', background: 'none', border: '1px dashed #e5e7eb', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#16a34a'; e.currentTarget.style.color = '#16a34a' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#9ca3af' }}
      >
        <Plus size={10} /> Thêm
      </button>
    </div>
  )
}

// ─── Edit Schedule Modal (đầy đủ như AssignModal) ────────────

function EditScheduleModal({
  item, doctors, shifts, groups,
  onSave, onClose,
}: {
  item:    ScheduleItem
  doctors: FormDoctor[]
  shifts:  WorkShift[]
  groups:  { id: number; name: string }[]
  onSave:  (data: Partial<ScheduleInput & { isOverride: boolean }>) => Promise<void>
  onClose: () => void
}) {
  const [doctorId,       setDoctorId]       = useState<number>(item.doctorId)
  const [workDate,       setWorkDate]       = useState(item.workDate)
  const [shiftId,        setShiftId]        = useState<number>(item.shiftId)
  const [serviceGroupId, setServiceGroupId] = useState<number>(item.serviceGroupId ?? 0)
  const [note,           setNote]           = useState(item.note ?? '')
  const [isOverride,     setIsOverride]     = useState(item.isOverride)
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState('')

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb',
    borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  }
  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    (e.currentTarget.style.borderColor = '#3b82f6')
  const onBlur  = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    (e.currentTarget.style.borderColor = '#e5e7eb')

  // Lọc ca theo ngày đã chọn
  const availableShifts = workDate
    ? shifts.filter(s => (s.applyDays as number[]).includes(jsToApplyDay(new Date(workDate + 'T12:00:00').getDay())))
    : shifts

  const selectedDoctor = doctors.find(d => d.id === doctorId)
  const doctorGroups   = selectedDoctor?.groups ?? []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!doctorId) { setError('Vui lòng chọn bác sĩ'); return }
    if (!workDate) { setError('Vui lòng chọn ngày làm việc'); return }
    if (!shiftId)  { setError('Vui lòng chọn ca làm việc'); return }
    setLoading(true); setError('')
    try {
      await onSave({
        doctorId, shiftId, workDate,
        serviceGroupId: serviceGroupId || null,
        note: note.trim() || undefined,
        isOverride,
      })
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi hệ thống')
      setLoading(false)
    }
  }

  return (
    <Overlay>
      <div style={{
        backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#111827', margin: 0 }}>Sửa lịch trực</h3>
            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Chỉnh sửa thông tin ca trực — UC08</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px' }}><X size={18} /></button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ overflow: 'auto', flex: 1 }}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {error && <ErrorBanner msg={error} />}

            {/* Bác sĩ */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Bác sĩ <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select value={doctorId}
                onChange={e => { setDoctorId(Number(e.target.value)); setServiceGroupId(0) }}
                style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
                onFocus={onFocus} onBlur={onBlur}>
                <option value={0} disabled>-- Chọn bác sĩ --</option>
                {doctors.map(d => <option key={d.id} value={d.id}>BS. {d.fullName}</option>)}
              </select>
            </div>

            {/* Ngày + Ca */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Ngày làm việc <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input type="date" value={workDate}
                  onChange={e => setWorkDate(e.target.value)}
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Ca làm việc <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select value={shiftId} onChange={e => setShiftId(Number(e.target.value))}
                  style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
                  onFocus={onFocus} onBlur={onBlur}>
                  <option value={0} disabled>-- Chọn ca --</option>
                  {availableShifts.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>
                  ))}
                </select>
                {workDate && availableShifts.length === 0 && (
                  <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>Không có ca nào hoạt động ngày này</p>
                )}
              </div>
            </div>

            {/* Nhóm dịch vụ */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Nhóm dịch vụ phụ trách
              </label>
              <select value={serviceGroupId} onChange={e => setServiceGroupId(Number(e.target.value))}
                style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
                onFocus={onFocus} onBlur={onBlur}>
                <option value={0}>-- Không chỉ định --</option>
                {(doctorGroups.length > 0 ? doctorGroups : groups).map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              {doctorGroups.length > 0 && (
                <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Hiển thị nhóm bác sĩ được phân công</p>
              )}
            </div>

            {/* Ghi chú */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Ghi chú
              </label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="Ghi chú thêm (nếu có)..."
                style={{ ...inputStyle, resize: 'vertical' }}
                onFocus={onFocus} onBlur={onBlur} />
            </div>

            {/* Override */}
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer',
              padding: '10px 12px', borderRadius: '8px',
              backgroundColor: isOverride ? '#fff7ed' : '#f9fafb',
              border: `1px solid ${isOverride ? '#fed7aa' : '#e5e7eb'}`,
            }}>
              <input type="checkbox" checked={isOverride} onChange={e => setIsOverride(e.target.checked)}
                style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: '#ea580c', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: isOverride ? '#ea580c' : '#374151', margin: 0 }}>
                  Override khẩn cấp [E3]
                </p>
                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                  Cho phép sửa lịch ngày đã qua hoặc trường hợp đặc biệt. Ghi nhật ký riêng.
                </p>
              </div>
            </label>
          </div>

          {/* Footer */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={onClose} style={{ ...btn.base, ...btn.ghost }}>Hủy</button>
            <button type="submit" disabled={loading} style={{ ...btn.base, ...btn.primary, opacity: loading ? 0.7 : 1 }}>
              {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </Overlay>
  )
}

// ─── Batch Assign Modal – phân công nhiều ngày cùng lúc ──────

const VN_DAY_FULL = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

function BatchAssignModal({
  doctors, shifts, groups,
  defaultWeekStart,
  onSaved, onClose,
}: {
  doctors:          FormDoctor[]
  shifts:           WorkShift[]
  groups:           { id: number; name: string }[]
  defaultWeekStart: Date
  onSaved:          () => void
  onClose:          () => void
}) {
  type Step = 'config' | 'preview' | 'result'
  const [step,           setStep]           = useState<Step>('config')
  const [doctorId,       setDoctorId]       = useState<number>(doctors[0]?.id ?? 0)
  const [shiftId,        setShiftId]        = useState<number>(shifts[0]?.id ?? 0)
  const [weekStart,      setWeekStart]      = useState<Date>(defaultWeekStart)
  const [serviceGroupId, setServiceGroupId] = useState<number>(0)
  const [note,           setNote]           = useState('')
  const [isOverride,     setIsOverride]     = useState(false)
  const [selectedDays,   setSelectedDays]   = useState<string[]>([])
  const [loading,        setLoading]        = useState(false)
  const [error,          setError]          = useState('')
  const [previewResult,  setPreviewResult]  = useState<BatchPreviewResult | null>(null)
  const [confirmedDates, setConfirmedDates] = useState<string[]>([])
  const [batchResult,    setBatchResult]    = useState<BatchCreateResult | null>(null)

  const weekDays       = Array.from({ length: 6 }, (_, i) => addDays(weekStart, i))
  const selectedShift  = shifts.find(s => s.id === shiftId)
  const selectedDoctor = doctors.find(d => d.id === doctorId)
  const doctorGroups   = selectedDoctor?.groups ?? []

  const isShiftAppliesToDay = (d: Date): boolean => {
    if (!selectedShift) return false
    return (selectedShift.applyDays as number[]).includes(jsToApplyDay(d.getDay()))
  }

  const toggleDay = (dateStr: string, dayDate: Date) => {
    if (!isShiftAppliesToDay(dayDate)) return
    setSelectedDays(prev =>
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    )
  }

  const toggleAll = () => {
    const applicable = weekDays.filter(d => isShiftAppliesToDay(d)).map(toDateStr)
    const allChecked = applicable.every(d => selectedDays.includes(d))
    setSelectedDays(prev =>
      allChecked ? prev.filter(d => !applicable.includes(d)) : [...new Set([...prev, ...applicable])]
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb',
    borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  }
  const onFocus = (e: React.FocusEvent<any>) => (e.currentTarget.style.borderColor = '#3b82f6')
  const onBlur  = (e: React.FocusEvent<any>) => (e.currentTarget.style.borderColor = '#e5e7eb')

  const handlePreview = async () => {
    if (!doctorId)              { setError('Vui lòng chọn bác sĩ'); return }
    if (!shiftId)               { setError('Vui lòng chọn ca làm việc'); return }
    if (!selectedDays.length)   { setError('Vui lòng chọn ít nhất 1 ngày'); return }
    setLoading(true); setError('')
    try {
      const r = await scheduleApi.previewBatch({
        doctorId, shiftId, workDates: selectedDays,
        serviceGroupId: serviceGroupId || null, note: note.trim() || undefined, isOverride,
      })
      setPreviewResult(r.data)
      setConfirmedDates(r.data.results.filter(x => x.valid).map(x => x.workDate))
      setStep('preview')
    } catch (e: any) {
      setError(e.response?.data?.message || 'Không thể kiểm tra, vui lòng thử lại')
    } finally { setLoading(false) }
  }

  const handleSave = async () => {
    if (!confirmedDates.length) { setError('Không có ngày nào được chọn để lưu'); return }
    setLoading(true); setError('')
    try {
      const r = await scheduleApi.createBatch({
        doctorId, shiftId, workDates: selectedDays,
        serviceGroupId: serviceGroupId || null, note: note.trim() || undefined, isOverride,
        confirmedDates,
      })
      setBatchResult(r.data)
      setStep('result')
    } catch (e: any) {
      setError(e.response?.data?.message || 'Lỗi khi lưu lịch trực')
    } finally { setLoading(false) }
  }

  const toggleConfirm = (date: string, valid: boolean) => {
    if (!valid) return
    setConfirmedDates(prev =>
      prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
    )
  }

  return (
    <Overlay>
      <div style={{
        backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '640px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarRange size={18} color="#7c3aed" />
              {step === 'config'  ? 'Phân công nhiều ngày — Bước 1: Cấu hình'  : ''}
              {step === 'preview' ? 'Phân công nhiều ngày — Bước 2: Xem trước' : ''}
              {step === 'result'  ? 'Kết quả phân công hàng loạt'               : ''}
            </h3>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '3px' }}>
              {step === 'config'  && 'Chọn bác sĩ, ca làm việc và các ngày cần phân công'}
              {step === 'preview' && 'Kiểm tra từng ngày. Bỏ chọn ngày lỗi để bỏ qua, hoặc quay lại sửa.'}
              {step === 'result'  && `Đã lưu ${batchResult?.savedCount ?? 0} lịch trực${batchResult?.failedCount ? `, ${batchResult.failedCount} ngày thất bại` : ''}`}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px', flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflow: 'auto', flex: 1, padding: '18px 24px' }}>
          {error && <div style={{ marginBottom: '12px' }}><ErrorBanner msg={error} /></div>}

          {/* ── Step 1: Config ── */}
          {step === 'config' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Bác sĩ */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Bác sĩ <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select value={doctorId}
                  onChange={e => { setDoctorId(Number(e.target.value)); setServiceGroupId(0) }}
                  style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
                  onFocus={onFocus} onBlur={onBlur}>
                  <option value={0} disabled>-- Chọn bác sĩ --</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>BS. {d.fullName}</option>)}
                </select>
              </div>

              {/* Ca làm việc */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Ca làm việc <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select value={shiftId}
                  onChange={e => { setShiftId(Number(e.target.value)); setSelectedDays([]) }}
                  style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
                  onFocus={onFocus} onBlur={onBlur}>
                  <option value={0} disabled>-- Chọn ca --</option>
                  {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>)}
                </select>
                {selectedShift && (
                  <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                    Áp dụng: {(selectedShift.applyDays as number[])
                      .map(d => ({0:'CN',2:'T2',3:'T3',4:'T4',5:'T5',6:'T6',7:'T7'} as Record<number,string>)[d] ?? '')
                      .filter(Boolean).join(', ')}
                  </p>
                )}
              </div>

              {/* Nhóm dịch vụ */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Nhóm dịch vụ phụ trách
                </label>
                <select value={serviceGroupId} onChange={e => setServiceGroupId(Number(e.target.value))}
                  style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
                  onFocus={onFocus} onBlur={onBlur}>
                  <option value={0}>-- Không chỉ định --</option>
                  {(doctorGroups.length > 0 ? doctorGroups : groups).map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {/* Điều hướng tuần */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Tuần áp dụng
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button onClick={() => { setWeekStart(addDays(weekStart, -7)); setSelectedDays([]) }}
                    style={{ width: '32px', height: '32px', border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronLeft size={14} color="#6b7280" />
                  </button>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', flex: 1, textAlign: 'center' }}>
                    {toDateStr(weekStart)} – {toDateStr(addDays(weekStart, 5))}
                  </span>
                  <button onClick={() => { setWeekStart(addDays(weekStart, 7)); setSelectedDays([]) }}
                    style={{ width: '32px', height: '32px', border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronRight size={14} color="#6b7280" />
                  </button>
                </div>
              </div>

              {/* Chọn ngày */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                    Chọn ngày làm việc <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <button onClick={toggleAll}
                    style={{ fontSize: '12px', color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                    Chọn/bỏ tất cả
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {weekDays.map(day => {
                    const dateStr  = toDateStr(day)
                    const applies  = isShiftAppliesToDay(day)
                    const checked  = selectedDays.includes(dateStr)
                    const isPast   = day < new Date(new Date().setHours(0,0,0,0))
                    const disabled = !applies || (isPast && !isOverride)
                    return (
                      <label key={dateStr} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '9px 12px', borderRadius: '8px',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        border: `1.5px solid ${checked ? '#7c3aed' : disabled ? '#f3f4f6' : '#e5e7eb'}`,
                        backgroundColor: checked ? '#f5f3ff' : disabled ? '#f9fafb' : 'white',
                        opacity: disabled ? 0.5 : 1,
                        transition: 'all 0.12s',
                      }}>
                        <input type="checkbox" checked={checked} disabled={disabled}
                          onChange={() => toggleDay(dateStr, day)}
                          style={{ width: '15px', height: '15px', accentColor: '#7c3aed', flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: checked ? '#6d28d9' : '#374151', margin: 0 }}>
                            {VN_DAY[day.getDay()]} {fmtDate(day)}
                          </p>
                          {!applies && <p style={{ fontSize: '11px', color: '#9ca3af', margin: '1px 0 0' }}>Ca không áp dụng</p>}
                          {applies && isPast && !isOverride && <p style={{ fontSize: '11px', color: '#9ca3af', margin: '1px 0 0' }}>Ngày đã qua</p>}
                        </div>
                      </label>
                    )
                  })}
                </div>
                {selectedDays.length > 0 && (
                  <p style={{ fontSize: '12px', color: '#7c3aed', marginTop: '8px', fontWeight: 600 }}>
                    ✓ Đã chọn {selectedDays.length} ngày
                  </p>
                )}
              </div>

              {/* Ghi chú */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Ghi chú (áp dụng cho tất cả ngày)
                </label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                  placeholder="Ghi chú thêm nếu có..."
                  style={{ ...inputStyle, resize: 'vertical' }}
                  onFocus={onFocus} onBlur={onBlur} />
              </div>

              {/* Override */}
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer',
                padding: '10px 12px', borderRadius: '8px',
                backgroundColor: isOverride ? '#fff7ed' : '#f9fafb',
                border: `1px solid ${isOverride ? '#fed7aa' : '#e5e7eb'}`,
              }}>
                <input type="checkbox" checked={isOverride}
                  onChange={e => { setIsOverride(e.target.checked); setSelectedDays([]) }}
                  style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: '#ea580c', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: isOverride ? '#ea580c' : '#374151', margin: 0 }}>
                    Phân công khẩn cấp
                  </p>
                  <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                    Bỏ qua ràng buộc đăng ký trước 1 ngày. Ghi nhật ký đặc biệt.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* ── Step 2: Preview ── */}
          {step === 'preview' && previewResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Tóm tắt */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px',
                padding: '14px 16px', backgroundColor: '#f9fafb', borderRadius: '10px', border: '1px solid #e5e7eb',
              }}>
                <div>
                  <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 2px' }}>Bác sĩ</p>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>BS. {previewResult.doctorName}</p>
                </div>
                <div>
                  <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 2px' }}>Ca làm việc</p>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>{previewResult.shiftName}</p>
                </div>
                <div>
                  <p style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600, margin: 0 }}>✓ {previewResult.validCount} ngày hợp lệ</p>
                </div>
                {previewResult.errorCount > 0 && (
                  <div>
                    <p style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600, margin: 0 }}>✗ {previewResult.errorCount} ngày có lỗi</p>
                  </div>
                )}
              </div>

              {previewResult.errorCount > 0 && (
                <div style={{ backgroundColor: '#fef9c3', border: '1px solid #fde047', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#854d0e' }}>
                  Các ngày lỗi đã bị bỏ chọn. Bạn có thể quay lại điều chỉnh hoặc bỏ qua chúng.
                </div>
              )}

              {/* Bảng xem trước */}
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb' }}>
                      {['Chọn', 'Ngày', 'Thứ', 'Kết quả kiểm tra'].map((h, i) => (
                        <th key={h} style={{
                          padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151',
                          borderBottom: '1px solid #e5e7eb', width: i === 0 ? '44px' : undefined,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewResult.results.map((r, idx) => {
                      const d      = new Date(r.workDate + 'T12:00:00')
                      const isSel  = confirmedDates.includes(r.workDate)
                      return (
                        <tr key={r.workDate}
                          style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#fafafa', cursor: r.valid ? 'pointer' : 'not-allowed' }}
                          onClick={() => toggleConfirm(r.workDate, r.valid)}>
                          <td style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6' }}>
                            <input type="checkbox" checked={isSel} disabled={!r.valid}
                              onChange={() => toggleConfirm(r.workDate, r.valid)}
                              style={{ width: '15px', height: '15px', accentColor: '#7c3aed' }} />
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6' }}>
                            {r.workDate}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>
                            {VN_DAY_FULL[d.getDay()]}
                          </td>
                          <td style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6' }}>
                            {r.valid
                              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#16a34a', fontWeight: 600 }}>
                                  <CheckCircle2 size={14} /> Hợp lệ
                                </span>
                              : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#dc2626', fontSize: '12px' }}>
                                  <XCircle size={14} /> {r.error}
                                </span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <p style={{ fontSize: '13px', color: '#374151', margin: 0 }}>
                Sẽ lưu <strong style={{ color: '#7c3aed' }}>{confirmedDates.length}</strong> ngày được chọn.
              </p>
            </div>
          )}

          {/* ── Step 3: Result ── */}
          {step === 'result' && batchResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '10px',
                backgroundColor: batchResult.savedCount > 0 ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${batchResult.savedCount > 0 ? '#bbf7d0' : '#fca5a5'}`,
              }}>
                {batchResult.savedCount > 0
                  ? <CheckCircle2 size={28} color="#16a34a" />
                  : <XCircle size={28} color="#dc2626" />}
                <div>
                  <p style={{ fontSize: '15px', fontWeight: 700, color: batchResult.savedCount > 0 ? '#15803d' : '#dc2626', margin: 0 }}>
                    {batchResult.savedCount > 0
                      ? `Đã lưu thành công ${batchResult.savedCount} lịch trực`
                      : 'Không lưu được lịch trực nào'}
                  </p>
                  {batchResult.failedCount > 0 && (
                    <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                      {batchResult.failedCount} ngày thất bại
                    </p>
                  )}
                </div>
              </div>

              {batchResult.created.length > 0 && (
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#374151', margin: '0 0 8px' }}>Đã lưu:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {batchResult.created.map(s => (
                      <span key={s.id} style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: '#dcfce7', color: '#15803d', fontSize: '12px', fontWeight: 600 }}>
                        ✓ {s.workDate} — {s.shiftName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {batchResult.errors.length > 0 && (
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#374151', margin: '0 0 8px' }}>Không lưu được:</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {batchResult.errors.map(e => (
                      <div key={e.workDate} style={{ padding: '6px 10px', borderRadius: '6px', backgroundColor: '#fef2f2', color: '#dc2626', fontSize: '12px' }}>
                        ✗ {e.workDate} — {e.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            {step === 'preview' && (
              <button onClick={() => { setStep('config'); setError('') }}
                style={{ ...btn.base, ...btn.ghost }}>
                <ChevronLeft size={14} /> Quay lại
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {step === 'result' ? (
              <button onClick={() => { onSaved(); onClose() }}
                style={{ ...btn.base, ...btn.primary }}>
                Đóng & Làm mới
              </button>
            ) : (
              <>
                <button onClick={onClose} style={{ ...btn.base, ...btn.ghost }}>Hủy</button>
                {step === 'config' && (
                  <button onClick={handlePreview} disabled={loading || !selectedDays.length}
                    style={{ ...btn.base, backgroundColor: '#7c3aed', color: 'white', opacity: loading || !selectedDays.length ? 0.6 : 1 }}>
                    {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                    Xem trước ({selectedDays.length} ngày)
                  </button>
                )}
                {step === 'preview' && (
                  <button onClick={handleSave} disabled={loading || !confirmedDates.length}
                    style={{ ...btn.base, backgroundColor: '#7c3aed', color: 'white', opacity: loading || !confirmedDates.length ? 0.6 : 1 }}>
                    {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                    Xác nhận lưu ({confirmedDates.length} ngày)
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Overlay>
  )
}

// ─── By Doctor Tab ────────────────────────────────────────────

function ByDoctorTab({ schedules, doctors, weekDays }: {
  schedules: ScheduleItem[]
  doctors:   FormDoctor[]
  weekDays:  Date[]
}) {
  const doctorsWithSchedules = doctors.filter(d => schedules.some(s => s.doctorId === d.id))

  if (doctorsWithSchedules.length === 0) {
    return <EmptyTab msg="Chưa có lịch trực nào trong tuần này." />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {doctorsWithSchedules.map(doc => {
        const docSchedules = schedules.filter(s => s.doctorId === doc.id)
        return (
          <div key={doc.id} style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <UserRound size={15} color="#2563eb" />
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>BS. {doc.fullName}</span>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>({docSchedules.length} ca tuần này)</span>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {docSchedules.map(s => {
                const d = weekDays.find(d => toDateStr(d) === s.workDate)
                return (
                  <div key={s.id} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: '#f9fafb', fontSize: '13px' }}>
                    <span style={{ fontWeight: 600, color: '#111827' }}>{d ? VN_DAY[d.getDay()] : ''} {s.workDate}</span>
                    <span style={{ color: '#6b7280', marginLeft: '8px' }}>{s.shiftName} ({s.shiftStartTime}–{s.shiftEndTime})</span>
                    {s.serviceGroupName && <span style={{ color: '#9ca3af', marginLeft: '8px', fontSize: '12px' }}>{s.serviceGroupName}</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ByGroupTab({ schedules, groups, shifts, weekDays }: {
  schedules: ScheduleItem[]
  groups:    { id: number; name: string }[]
  shifts:    WorkShift[]
  weekDays:  Date[]
}) {
  if (schedules.length === 0) {
    return <EmptyTab msg="Chưa có lịch trực nào trong tuần này." />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {groups.map(group => {
        const groupSchedules = schedules.filter(s => s.serviceGroupId === group.id)
        return (
          <div key={group.id} style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Layers size={15} color="#9333ea" />
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{group.name}</span>
              {groupSchedules.length === 0
                ? <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 600 }}>⚠ Chưa có bác sĩ trực tuần này</span>
                : <span style={{ fontSize: '12px', color: '#16a34a' }}>✓ {groupSchedules.length} ca</span>
              }
            </div>
            {groupSchedules.length > 0 && (
              <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {groupSchedules.map(s => (
                  <div key={s.id} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #dcfce7', backgroundColor: '#f0fdf4', fontSize: '13px' }}>
                    <span style={{ fontWeight: 600, color: '#16a34a' }}>BS. {s.doctorName}</span>
                    <span style={{ color: '#6b7280', marginLeft: '8px' }}>{s.shiftName} · {s.workDate}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function EmptyTab({ msg }: { msg: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 24px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
      <CalendarDays size={32} color="#d1d5db" style={{ marginBottom: '12px' }} />
      <p style={{ fontSize: '14px', color: '#9ca3af' }}>{msg}</p>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════════════════════

export default function SchedulesPage() {
  const [weekStart,    setWeekStart]    = useState(() => getMondayOfWeek(new Date()))
  const [schedules,    setSchedules]    = useState<ScheduleItem[]>([])
  const [holidays,     setHolidays]     = useState<HolidayInfo[]>([])
  const [shifts,       setShifts]       = useState<WorkShift[]>([])
  const [doctors,      setDoctors]      = useState<FormDoctor[]>([])
  const [groups,       setGroups]       = useState<{ id: number; name: string }[]>([])
  const [loading,      setLoading]      = useState(true)
  const [view,         setView]         = useState<'overview' | 'doctor' | 'group'>('overview')
  const [addOpen,      setAddOpen]      = useState(false)
  const [batchOpen,    setBatchOpen]    = useState(false)
  const [prefillDate,  setPrefillDate]  = useState<string | undefined>()
  const [prefillShift, setPrefillShift] = useState<number | undefined>()
  const [editTarget,   setEditTarget]   = useState<ScheduleItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ScheduleItem | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type })

  const weekDays = Array.from({ length: WEEK_DAYS_COUNT }, (_, i) => addDays(weekStart, i))

  const loadSchedules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await scheduleApi.getWeek(toDateStr(weekStart))
      setSchedules(res.data.schedules)
      setHolidays(res.data.holidays)
    } catch { showToast('Không thể tải lịch trực', 'error') }
    finally { setLoading(false) }
  }, [weekStart])

  useEffect(() => {
    loadSchedules()
  }, [loadSchedules])

  useEffect(() => {
    scheduleApi.getFormData().then(r => {
      setDoctors(r.data.doctors)
      setShifts(r.data.shifts)
      setGroups(r.data.groups)
    }).catch(() => {})
  }, [])

  const handleAdd = async (data: ScheduleInput) => {
    await scheduleApi.create(data)
    setAddOpen(false); setPrefillDate(undefined); setPrefillShift(undefined)
    showToast('Phân công lịch trực thành công')
    loadSchedules()
  }

  const handleEdit = async (data: Partial<ScheduleInput & { isOverride: boolean }>) => {
    if (!editTarget) return
    await scheduleApi.update(editTarget.id, data)
    setEditTarget(null)
    showToast('Cập nhật lịch trực thành công')
    loadSchedules()
  }

  const handleDelete = async (override: boolean) => {
    if (!deleteTarget) return
    await scheduleApi.delete(deleteTarget.id, override)
    setDeleteTarget(null)
    showToast('Đã hủy lịch trực')
    loadSchedules()
  }

  const openAdd = (date?: Date, shift?: WorkShift) => {
    setPrefillDate(date ? toDateStr(date) : undefined)
    setPrefillShift(shift?.id)
    setAddOpen(true)
  }

  // Calculate per-day counts for all doctors (to detect overtime)
  const allDaySchedules = schedules // pass all to cell for overtime calc

  // Active doctors (those assigned in this week OR all from form data)
  const activeDoctors = doctors

  // Warning: service groups with no doctor in any shift this week
  const coveredGroupIds = new Set(schedules.map(s => s.serviceGroupId).filter(Boolean))
  const uncoveredGroups = groups.filter(g => !coveredGroupIds.has(g.id))

  // Total hours per doctor
  const totalWeekHours = activeDoctors.map(d => {
    const h = schedules.filter(s => s.doctorId === d.id)
      .reduce((sum, s) => sum + getShiftHours(s.shiftStartTime, s.shiftEndTime), 0)
    return { id: d.id, hours: h }
  }).filter(d => d.hours > 0)

  const weekLabel = `${toDateStr(weekStart)} – ${toDateStr(addDays(weekStart, 6))}`

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>
            Phân công lịch trực <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 400 }}>(UC08)</span>
          </h2>
          <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
            Quản lý lịch trực của bác sĩ theo tuần và nhóm dịch vụ
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setBatchOpen(true)}
            style={{ ...btn.base, backgroundColor: '#7c3aed', color: 'white' }}>
            <CalendarRange size={15} /> Phân công nhiều ngày
          </button>
          <button onClick={() => openAdd()} style={{ ...btn.base, ...btn.primary }}>
            <Plus size={15} /> Phân công 1 ngày
          </button>
        </div>
      </div>

      {/* ── Week navigator ── */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '14px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        <button onClick={() => setWeekStart(addDays(weekStart, -7))}
          style={{ width: '32px', height: '32px', border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={16} color="#6b7280" />
        </button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>
            {toDateStr(weekStart) === toDateStr(getMondayOfWeek(new Date())) ? 'Tuần hiện tại' : 'Tuần đã chọn'}
          </p>
          <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{weekLabel}</p>
        </div>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))}
          style={{ width: '32px', height: '32px', border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronRight size={16} color="#6b7280" />
        </button>
        <button onClick={() => setWeekStart(getMondayOfWeek(new Date()))}
          style={{ ...btn.base, ...btn.ghost, padding: '6px 12px', fontSize: '12px', marginLeft: '8px' }}>
          Tuần này
        </button>
      </div>

      {/* ── View tabs ── */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '-1px' }}>
        {([
          { key: 'overview', icon: <LayoutGrid size={14} />, label: 'Tổng quan tất cả phòng khám' },
          { key: 'doctor',   icon: <Users size={14} />,      label: 'Theo bác sĩ' },
          { key: 'group',    icon: <Layers size={14} />,     label: 'Theo nhóm dịch vụ' },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setView(tab.key)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
              fontSize: '13px', fontWeight: view === tab.key ? 700 : 500, cursor: 'pointer',
              background: 'none', border: 'none',
              color: view === tab.key ? '#2563eb' : '#6b7280',
              borderBottom: view === tab.key ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: '-1px',
            }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Warning ── */}
      <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px' }}>
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#92400e', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <AlertTriangle size={14} /> Cảnh báo giờ làm việc
        </p>
        <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {[
            'Một bác sĩ làm tối đa 6 ngày/tuần = 48 giờ/tuần',
            'Làm trên 48h/tuần sẽ tính vào tăng ca và hiển thị trên timeline',
            'Mỗi ca phải có ít nhất 2 bác sĩ trực cho 1 nhóm dịch vụ',
          ].map(t => (
            <li key={t} style={{ fontSize: '12px', color: uncoveredGroups.length > 0 && t.includes('nhóm dịch vụ') ? '#dc2626' : '#b45309' }}>{t}</li>
          ))}
        </ul>
        {uncoveredGroups.length > 0 && (
          <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '6px', fontWeight: 600 }}>
            ⚠ Nhóm chưa có bác sĩ trực tuần này: {uncoveredGroups.map(g => g.name).join(', ')}
          </p>
        )}
      </div>

      {/* ── Doctor summary cards ── */}
      {activeDoctors.length > 0 && totalWeekHours.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          {activeDoctors.filter(d => totalWeekHours.some(h => h.id === d.id)).map(doc => (
            <DoctorCard
              key={doc.id}
              doctorId={doc.id}
              doctorName={doc.fullName}
              schedules={schedules}
              shifts={shifts}
            />
          ))}
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px', color: '#9ca3af' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : view === 'doctor' ? (
        <ByDoctorTab schedules={schedules} doctors={doctors} weekDays={weekDays} />
      ) : view === 'group' ? (
        <ByGroupTab schedules={schedules} groups={groups} shifts={shifts} weekDays={weekDays} />
      ) : (
        /* ── Overview grid ── */
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          {/* Grid header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `120px repeat(${WEEK_DAYS_COUNT}, 1fr)`,
            backgroundColor: '#f9fafb',
            borderBottom: '1px solid #e5e7eb',
          }}>
            <div style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', borderRight: '1px solid #e5e7eb' }}>
              Ca / Ngày
            </div>
            {weekDays.map((d, i) => {
              const dayHols = getDayHolidays(toDateStr(d), holidays)
              return (
                <div key={i} style={{ padding: '10px 6px', textAlign: 'center', borderRight: i < WEEK_DAYS_COUNT - 1 ? '1px solid #e5e7eb' : 'none' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#374151', margin: 0 }}>{VN_DAY[d.getDay()]}</p>
                  <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0' }}>{fmtDate(d)}</p>
                  {dayHols.map(h => (
                    <div key={h.id} style={{
                      marginTop: '5px', fontSize: '10px', fontWeight: 700,
                      color: 'white', backgroundColor: h.color,
                      borderRadius: '4px', padding: '2px 5px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      maxWidth: '100%',
                    }} title={h.name}>
                      🎌 {h.name}
                      {h.startTime && h.endTime ? ` ${h.startTime}–${h.endTime}` : ''}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          {/* Grid rows (one per shift) */}
          {shifts.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
              Chưa có ca làm việc nào. Vui lòng thiết lập ca tại <strong>Cấu hình → Ca làm việc</strong>.
            </div>
          ) : (
            shifts.map((shift, sIdx) => {
              const c = COLOR[shift.colorCode] ?? COLOR.blue
              return (
                <div key={shift.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `120px repeat(${WEEK_DAYS_COUNT}, 1fr)`,
                    borderBottom: sIdx < shifts.length - 1 ? '1px solid #f3f4f6' : 'none',
                    minHeight: '100px',
                  }}
                >
                  {/* Shift label */}
                  <div style={{
                    padding: '14px 12px', borderRight: '1px solid #e5e7eb',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '3px',
                    backgroundColor: c.iconBg + '55',
                  }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: c.text, margin: 0 }}>{shift.name}</p>
                    <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>{shift.startTime}–{shift.endTime}</p>
                  </div>

                  {/* Day cells */}
                  {weekDays.map((day, dIdx) => {
                    const applyDay = jsToApplyDay(day.getDay())
                    const applies  = (shift.applyDays as number[]).includes(applyDay)
                    const dateStr  = toDateStr(day)
                    const cellSchedules = schedules.filter(
                      s => s.shiftId === shift.id && s.workDate === dateStr
                    )
                    const blocked = applies
                      ? getHolidayBlock(dateStr, shift.startTime, shift.endTime, holidays)
                      : null

                    return (
                      <div key={dIdx}
                        style={{
                          padding: '8px',
                          borderRight: dIdx < WEEK_DAYS_COUNT - 1 ? '1px solid #f3f4f6' : 'none',
                          backgroundColor: blocked
                            ? blocked.color + '14'
                            : !applies ? '#fafafa' : 'white',
                          minHeight: '100px',
                          position: 'relative',
                        }}
                      >
                        {!applies ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <span style={{ fontSize: '11px', color: '#e5e7eb' }}>—</span>
                          </div>
                        ) : blocked ? (
                          /* Holiday blocked cell */
                          <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            justifyContent: 'center', height: '100%', minHeight: '80px',
                            gap: '5px', padding: '8px 4px',
                          }}>
                            <div style={{
                              width: '28px', height: '28px', borderRadius: '50%',
                              backgroundColor: blocked.color + '22',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '14px',
                            }}>🎌</div>
                            <p style={{
                              fontSize: '11px', fontWeight: 700, color: blocked.color,
                              textAlign: 'center', margin: 0,
                              overflow: 'hidden', textOverflow: 'ellipsis',
                              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                              maxWidth: '100%',
                            }}>{blocked.name}</p>
                            {blocked.startTime && blocked.endTime && (
                              <p style={{ fontSize: '10px', color: blocked.color + 'cc', margin: 0 }}>
                                {blocked.startTime}–{blocked.endTime}
                              </p>
                            )}
                            {cellSchedules.length > 0 && (
                              <p style={{ fontSize: '10px', color: '#ef4444', margin: 0, fontStyle: 'italic' }}>
                                ⚠ {cellSchedules.length} ca cũ
                              </p>
                            )}
                          </div>
                        ) : (
                          <ScheduleCell
                            schedules={cellSchedules}
                            allDaySchedules={allDaySchedules}
                            shift={shift}
                            onAdd={() => openAdd(day, shift)}
                            onEdit={item => setEditTarget(item)}
                            onDelete={item => setDeleteTarget(item)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {addOpen && (
        <AssignModal
          doctors={doctors} shifts={shifts} groups={groups}
          prefillDate={prefillDate} prefillShiftId={prefillShift}
          onSave={handleAdd} onClose={() => { setAddOpen(false); setPrefillDate(undefined); setPrefillShift(undefined) }}
        />
      )}
      {batchOpen && (
        <BatchAssignModal
          doctors={doctors} shifts={shifts} groups={groups}
          defaultWeekStart={weekStart}
          onSaved={() => { showToast('Phân công hàng loạt thành công'); loadSchedules() }}
          onClose={() => setBatchOpen(false)}
        />
      )}
      {editTarget && (
        <EditScheduleModal
          item={editTarget}
          doctors={doctors}
          shifts={shifts}
          groups={groups}
          onSave={handleEdit}
          onClose={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteModal item={deleteTarget} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
