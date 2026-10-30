import { useState, useEffect, useCallback } from 'react'
import {
  Plus, X, Loader2, AlertTriangle, Pencil, Trash2,
  CalendarDays, CalendarX, Bell, CalendarCheck,
} from 'lucide-react'
import { holidayApi, type Holiday, type HolidayInput } from '../../api/holidays.api'

// ─── Constants ───────────────────────────────────────────────

const TYPE_CONFIG = {
  NATIONAL:  { label: 'Ngày lễ quốc gia', color: '#ef4444', bg: '#fef2f2', iconBg: '#fee2e2', text: '#dc2626' },
  PRIVATE:   { label: 'Ngày nghỉ riêng',  color: '#9333ea', bg: '#f3e8ff', iconBg: '#ede9fe', text: '#7c3aed' },
  RECURRING: { label: 'Hằng năm',         color: '#d97706', bg: '#fef3c7', iconBg: '#fde68a', text: '#b45309' },
} as const

const MONTH_NAMES = [
  'Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
  'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12',
]

const DOW_HEADERS = ['T2','T3','T4','T5','T6','T7','CN']

// ─── Helpers ─────────────────────────────────────────────────

const toDateStr = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

const fmtVN = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

const fmtRange = (h: Holiday): string =>
  h.startDate === h.endDate
    ? fmtVN(h.startDate)
    : `${fmtVN(h.startDate)} đến ${fmtVN(h.endDate)}`

const durationDays = (h: Holiday): number => {
  const ms = new Date(h.endDate).getTime() - new Date(h.startDate).getTime()
  return Math.round(ms / 86400000) + 1
}

const isPast = (h: Holiday): boolean => h.endDate < toDateStr(new Date())

/** Get calendar grid for a month (Mon-first, null = padding) */
const getCalendarGrid = (year: number, month: number): (number | null)[] => {
  const firstDow = new Date(year, month - 1, 1).getDay() // 0=Sun
  const offset   = firstDow === 0 ? 6 : firstDow - 1    // Mon=0…Sun=6
  const daysInMonth = new Date(year, month, 0).getDate()
  const grid: (number | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) grid.push(d)
  return grid
}

/** Return holiday type for a given date string, or null */
const getDayHoliday = (
  dateStr: string,
  holidays: Holiday[]
): keyof typeof TYPE_CONFIG | null => {
  for (const h of holidays) {
    if (dateStr >= h.startDate && dateStr <= h.endDate)
      return h.type as keyof typeof TYPE_CONFIG
  }
  return null
}

// ─── Shared UI ───────────────────────────────────────────────

const btn = {
  base:    { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none' } as React.CSSProperties,
  primary: { backgroundColor: '#2563eb', color: 'white' } as React.CSSProperties,
  ghost:   { backgroundColor: 'transparent', color: '#6b7280', border: '1px solid #e5e7eb' } as React.CSSProperties,
  danger:  { backgroundColor: '#dc2626', color: 'white' } as React.CSSProperties,
}

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
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0 }}>
        <X size={14} />
      </button>
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

// ─── Holiday Form Modal ───────────────────────────────────────

function HolidayFormModal({
  holiday, onSave, onClose,
}: {
  holiday?: Holiday
  onSave:   (data: HolidayInput) => Promise<void>
  onClose:  () => void
}) {
  const isEdit = !!holiday

  const [name,       setName]       = useState(holiday?.name       ?? '')
  const [startDate,  setStartDate]  = useState(holiday?.startDate  ?? '')
  const [endDate,    setEndDate]    = useState(holiday?.endDate     ?? '')
  const [type,       setType]       = useState<string>(holiday?.type ?? 'NATIONAL')
  const [startTime,  setStartTime]  = useState(holiday?.startTime  ?? '')
  const [endTime,    setEndTime]    = useState(holiday?.endTime     ?? '')
  const [sendSms,    setSendSms]    = useState(holiday?.sendSms    ?? false)
  const [autoCancel, setAutoCancel] = useState(holiday?.autoCancel ?? false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  const hasTimeConfig = type === 'PRIVATE' || type === 'RECURRING'

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb',
    borderRadius: '8px', fontSize: '14px', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
  }
  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) =>
    (e.currentTarget.style.borderColor = '#3b82f6')
  const onBlur  = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) =>
    (e.currentTarget.style.borderColor = '#e5e7eb')

  const handleStartChange = (v: string) => {
    setStartDate(v)
    if (!endDate || endDate < v) setEndDate(v)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Tên ngày nghỉ không được để trống'); return }
    if (!startDate)   { setError('Vui lòng chọn ngày bắt đầu'); return }
    if (!endDate)     { setError('Vui lòng chọn ngày kết thúc'); return }
    if (endDate < startDate) { setError('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu'); return }
    if (hasTimeConfig && startTime && endTime && startTime >= endTime) {
      setError('Giờ kết thúc phải sau giờ bắt đầu'); return
    }
    setLoading(true); setError('')
    try {
      await onSave({
        name: name.trim(), startDate, endDate, type, sendSms, autoCancel,
        startTime: hasTimeConfig && startTime ? startTime : null,
        endTime:   hasTimeConfig && endTime   ? endTime   : null,
      })
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi hệ thống')
      setLoading(false)
    }
  }

  const tc = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG]

  return (
    <Overlay>
      <div style={{
        backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '480px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#111827', margin: 0 }}>
              {isEdit ? 'Chỉnh sửa ngày nghỉ' : 'Thêm ngày nghỉ mới'}
            </h3>
            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
              {isEdit ? 'Cập nhật thông tin ngày nghỉ' : 'Cấu hình ngày nghỉ cho phòng khám'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ overflow: 'auto', flex: 1 }}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {error && <ErrorBanner msg={error} />}

            {/* Name */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Tên ngày nghỉ <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="VD: Tết Nguyên Đán..."
                style={inputStyle} onFocus={onFocus} onBlur={onBlur}
              />
            </div>

            {/* Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Ngày bắt đầu <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="date" value={startDate}
                  onChange={e => handleStartChange(e.target.value)}
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Ngày kết thúc
                </label>
                <input
                  type="date" value={endDate} min={startDate}
                  onChange={e => setEndDate(e.target.value)}
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur}
                />
                {startDate && endDate && endDate !== startDate && (
                  <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                    {durationDays({ startDate, endDate } as Holiday)} ngày nghỉ
                  </p>
                )}
              </div>
            </div>

            {/* Type */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Loại ngày nghỉ
              </label>
              <select
                value={type} onChange={e => setType(e.target.value)}
                style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
                onFocus={onFocus} onBlur={onBlur}
              >
                <option value="NATIONAL">Ngày lễ quốc gia</option>
                <option value="PRIVATE">Ngày nghỉ riêng</option>
                <option value="RECURRING">Hằng năm</option>
              </select>
              {tc && (
                <div style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '99px', backgroundColor: tc.bg }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: tc.color }} />
                  <span style={{ fontSize: '12px', color: tc.text, fontWeight: 600 }}>{tc.label}</span>
                </div>
              )}
            </div>

            {/* Time window (PRIVATE / RECURRING only) */}
            {hasTimeConfig && (
              <div style={{ backgroundColor: '#f8faff', border: '1px solid #c7d2fe', borderRadius: '10px', padding: '14px' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#4338ca', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🕐 Khung giờ nghỉ <span style={{ fontWeight: 400, color: '#6b7280' }}>(tuỳ chọn — để trống = nghỉ cả ngày)</span>
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>
                      Từ giờ
                    </label>
                    <input
                      type="time" value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      style={{ ...inputStyle, fontSize: '13px' }}
                      onFocus={onFocus} onBlur={onBlur}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>
                      Đến giờ
                    </label>
                    <input
                      type="time" value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                      style={{ ...inputStyle, fontSize: '13px' }}
                      onFocus={onFocus} onBlur={onBlur}
                    />
                  </div>
                </div>
                {startTime && endTime && (
                  <p style={{ fontSize: '11px', color: '#6366f1', marginTop: '8px' }}>
                    Ca làm việc nằm trong {startTime}–{endTime} sẽ bị khoá, ngoài khung này vẫn phân ca được.
                  </p>
                )}
              </div>
            )}

            {/* Checkboxes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer',
                padding: '10px 12px', backgroundColor: sendSms ? '#eff6ff' : '#f9fafb',
                borderRadius: '8px', border: `1px solid ${sendSms ? '#bfdbfe' : '#e5e7eb'}`,
              }}>
                <input
                  type="checkbox" checked={sendSms} onChange={e => setSendSms(e.target.checked)}
                  style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: '#2563eb', flexShrink: 0 }}
                />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: sendSms ? '#1d4ed8' : '#374151', margin: 0 }}>
                    Gửi SMS thông báo
                  </p>
                  <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                    Gửi tin nhắn cho bệnh nhân đã đặt lịch trong ngày nghỉ này
                  </p>
                </div>
              </label>

              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer',
                padding: '10px 12px', backgroundColor: autoCancel ? '#fff7ed' : '#f9fafb',
                borderRadius: '8px', border: `1px solid ${autoCancel ? '#fed7aa' : '#e5e7eb'}`,
              }}>
                <input
                  type="checkbox" checked={autoCancel} onChange={e => setAutoCancel(e.target.checked)}
                  style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: '#ea580c', flexShrink: 0 }}
                />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: autoCancel ? '#ea580c' : '#374151', margin: 0 }}>
                    Tự động hủy lịch trong ngày
                  </p>
                  <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                    Hệ thống tự động đánh dấu hủy các lịch hẹn trong khoảng ngày này
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={onClose} style={{ ...btn.base, ...btn.ghost }}>Hủy</button>
            <button type="submit" disabled={loading} style={{ ...btn.base, ...btn.primary, opacity: loading ? 0.7 : 1 }}>
              {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              {isEdit ? 'Lưu thay đổi' : 'Thêm ngày nghỉ'}
            </button>
          </div>
        </form>
      </div>
    </Overlay>
  )
}

// ─── Delete Confirm Modal ─────────────────────────────────────

function DeleteModal({ holiday, onConfirm, onClose }: {
  holiday:   Holiday
  onConfirm: () => Promise<void>
  onClose:   () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const handleConfirm = async () => {
    setLoading(true); setError('')
    try { await onConfirm() }
    catch (e: any) { setError(e.response?.data?.message || 'Không thể xóa ngày nghỉ'); setLoading(false) }
  }

  const tc = TYPE_CONFIG[holiday.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.NATIONAL

  return (
    <Overlay>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '420px', padding: '28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={18} color="#dc2626" />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>Xóa ngày nghỉ</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px' }}>
          <p style={{ fontSize: '14px', color: '#111827', fontWeight: 700, margin: '0 0 4px' }}>{holiday.name}</p>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{fmtRange(holiday)}</p>
          <div style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '99px', backgroundColor: tc.bg }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: tc.color }} />
            <span style={{ fontSize: '11px', color: tc.text, fontWeight: 600 }}>{tc.label}</span>
          </div>
        </div>

        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
          Hành động này không thể hoàn tác. Ngày này sẽ trở lại là ngày làm việc bình thường.
        </p>

        {error && <div style={{ marginBottom: '16px' }}><ErrorBanner msg={error} /></div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} style={{ ...btn.base, ...btn.ghost }}>Đóng</button>
          <button onClick={handleConfirm} disabled={loading} style={{ ...btn.base, ...btn.danger, opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            Xác nhận xóa
          </button>
        </div>
      </div>
    </Overlay>
  )
}

// ─── Mini Calendar ────────────────────────────────────────────

function MiniCalendar({ year, month, holidays, onMonthChange }: {
  year:          number
  month:         number
  holidays:      Holiday[]
  onMonthChange: (m: number) => void
}) {
  const grid    = getCalendarGrid(year, month)
  const todayStr = toDateStr(new Date())

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px' }}>
      <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: '0 0 14px' }}>Phân bổ theo tháng</p>

      {/* Month selector */}
      <select
        value={month}
        onChange={e => onMonthChange(Number(e.target.value))}
        style={{
          width: '100%', padding: '8px 12px', border: '1.5px solid #e5e7eb', borderRadius: '8px',
          fontSize: '14px', outline: 'none', cursor: 'pointer', appearance: 'none',
          backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236b7280\' stroke-width=\'2\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E")',
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', paddingRight: '30px',
          marginBottom: '14px', fontFamily: 'inherit', backgroundColor: 'white',
        }}
      >
        {MONTH_NAMES.map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}
      </select>

      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
        {DOW_HEADERS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#9ca3af', padding: '3px 0' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {grid.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} />

          const m       = String(month).padStart(2, '0')
          const dd      = String(day).padStart(2, '0')
          const dateStr = `${year}-${m}-${dd}`
          const isToday = dateStr === todayStr
          const hType   = getDayHoliday(dateStr, holidays)
          const tc      = hType ? TYPE_CONFIG[hType] : null

          return (
            <div
              key={day}
              style={{
                textAlign: 'center', fontSize: '12px', fontWeight: isToday ? 700 : 400,
                width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%', margin: '0 auto', cursor: 'default',
                backgroundColor: isToday
                  ? '#2563eb'
                  : tc ? tc.bg : 'transparent',
                color: isToday
                  ? 'white'
                  : tc ? tc.text : '#374151',
                border: isToday ? 'none' : tc ? `1px solid ${tc.color}22` : 'none',
              }}
            >
              {day}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ marginTop: '16px', borderTop: '1px solid #f3f4f6', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {Object.entries(TYPE_CONFIG).map(([, cfg]) => (
          <div key={cfg.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: cfg.color, flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: '#6b7280' }}>{cfg.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Stats Card ───────────────────────────────────────────────

function StatCard({ icon, value, label, color, bg }: {
  icon:  React.ReactNode
  value: number
  label: string
  color: string
  bg:    string
}) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', padding: '20px', display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
      <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: '28px', fontWeight: 800, color: '#111827', margin: 0, lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{label}</p>
      </div>
    </div>
  )
}

// ─── Holiday List Item ────────────────────────────────────────

function HolidayItem({ holiday, onEdit, onDelete }: {
  holiday:  Holiday
  onEdit:   () => void
  onDelete: () => void
}) {
  const tc      = TYPE_CONFIG[holiday.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.NATIONAL
  const days    = durationDays(holiday)
  const pastDay = isPast(holiday)

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '14px',
      padding: '14px 16px', backgroundColor: 'white', borderRadius: '10px',
      border: '1px solid #e5e7eb', opacity: pastDay ? 0.65 : 1,
    }}>
      {/* Icon */}
      <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: tc.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
        <CalendarDays size={18} color={tc.color} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>{holiday.name}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>{fmtRange(holiday)}</span>
          {holiday.startTime && holiday.endTime && (
            <>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>•</span>
              <span style={{ fontSize: '11px', color: '#6366f1', fontWeight: 600, backgroundColor: '#eef2ff', padding: '2px 7px', borderRadius: '99px' }}>
                🕐 {holiday.startTime}–{holiday.endTime}
              </span>
            </>
          )}
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>•</span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: tc.text, backgroundColor: tc.bg, padding: '2px 8px', borderRadius: '99px' }}>
            {tc.label}
          </span>
          {holiday.sendSms && (
            <span style={{ fontSize: '11px', color: '#2563eb', backgroundColor: '#dbeafe', padding: '2px 7px', borderRadius: '99px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Bell size={9} /> SMS
            </span>
          )}
          {holiday.autoCancel && (
            <span style={{ fontSize: '11px', color: '#ea580c', backgroundColor: '#ffedd5', padding: '2px 7px', borderRadius: '99px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <CalendarX size={9} /> Tự hủy
            </span>
          )}
        </div>
        {holiday.conflictCount > 0 && (
          <p style={{ fontSize: '12px', color: '#d97706', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={12} /> {holiday.conflictCount} lịch hẹn cần xử lý
          </p>
        )}
        {pastDay && (
          <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>Đã qua</p>
        )}
      </div>

      {/* Duration badge */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
        <div style={{ backgroundColor: days === 1 ? '#f0fdf4' : '#eff6ff', color: days === 1 ? '#16a34a' : '#2563eb', fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '8px', whiteSpace: 'nowrap' }}>
          {days === 1 ? '1 ngày' : `${days} ngày`}
        </div>
        {!pastDay && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={onEdit}
              style={{ width: '30px', height: '30px', border: '1px solid #e5e7eb', borderRadius: '6px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}
              title="Chỉnh sửa"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={onDelete}
              style={{ width: '30px', height: '30px', border: '1px solid #fca5a5', borderRadius: '6px', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}
              title="Xóa"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════════════════════

export default function HolidaysPage() {
  const currentYear  = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const [year,         setYear]         = useState(currentYear)
  const [month,        setMonth]        = useState(currentMonth)
  const [holidays,     setHolidays]     = useState<Holiday[]>([])
  const [loading,      setLoading]      = useState(true)
  const [addOpen,      setAddOpen]      = useState(false)
  const [editTarget,   setEditTarget]   = useState<Holiday | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null)
  const [toast, setToast]               = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') =>
    setToast({ msg, type })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await holidayApi.getAll(year)
      setHolidays(res.data)
    } catch {
      showToast('Không thể tải danh sách ngày nghỉ', 'error')
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { load() }, [load])

  // ── Stats ──────────────────────────────────────────────────
  const total         = holidays.length
  const national      = holidays.filter(h => h.type === 'NATIONAL').length
  const privateH      = holidays.filter(h => h.type === 'PRIVATE').length
  const todayStr      = toDateStr(new Date())
  const needNotif     = holidays.filter(h => h.sendSms && h.startDate >= todayStr).length

  // ── Handlers ───────────────────────────────────────────────
  const handleAdd = async (data: HolidayInput) => {
    await holidayApi.create(data)
    setAddOpen(false)
    showToast('Đã thêm ngày nghỉ thành công')
    load()
  }

  const handleEdit = async (data: HolidayInput) => {
    if (!editTarget) return
    await holidayApi.update(editTarget.id, data)
    setEditTarget(null)
    showToast('Cập nhật ngày nghỉ thành công')
    load()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await holidayApi.remove(deleteTarget.id)
    setDeleteTarget(null)
    showToast('Đã xóa ngày nghỉ')
    load()
  }

  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2]

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>
            Quản lý Ngày nghỉ lễ <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 400 }}>(UC07)</span>
          </h2>
          <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
            Cấu hình ngày nghỉ, lễ và không tiếp bệnh nhân
          </p>
        </div>
        <button onClick={() => setAddOpen(true)} style={{ ...btn.base, ...btn.primary }}>
          <Plus size={15} /> Thêm ngày nghỉ
        </button>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <StatCard
          icon={<CalendarDays size={20} color="#2563eb" />}
          value={total} label="Tổng ngày nghỉ"
          color="#2563eb" bg="#dbeafe"
        />
        <StatCard
          icon={<CalendarDays size={20} color="#dc2626" />}
          value={national} label="Ngày lễ chính"
          color="#dc2626" bg="#fee2e2"
        />
        <StatCard
          icon={<CalendarCheck size={20} color="#9333ea" />}
          value={privateH} label="Ngày nghỉ riêng"
          color="#9333ea" bg="#ede9fe"
        />
        <StatCard
          icon={<Bell size={20} color="#d97706" />}
          value={needNotif} label="Cần gỡ thông báo"
          color="#d97706" bg="#fde68a"
        />
      </div>

      {/* ── Main layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', alignItems: 'start' }}>
        {/* Left: holiday list */}
        <div>
          {/* List header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0 }}>
              Danh sách ngày nghỉ năm {year}
            </h3>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              style={{
                padding: '6px 28px 6px 10px', border: '1.5px solid #e5e7eb', borderRadius: '8px',
                fontSize: '13px', outline: 'none', cursor: 'pointer', appearance: 'none',
                backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'10\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236b7280\' stroke-width=\'2\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E")',
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
                fontFamily: 'inherit', backgroundColor: 'white',
              }}
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px', color: '#9ca3af' }}>
              <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : holidays.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 24px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <CalendarDays size={32} color="#d1d5db" style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '4px' }}>Chưa có ngày nghỉ nào trong năm {year}</p>
              <p style={{ fontSize: '12px', color: '#d1d5db' }}>Nhấn "+ Thêm ngày nghỉ" để cấu hình</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {holidays.map(h => (
                <HolidayItem
                  key={h.id}
                  holiday={h}
                  onEdit={() => setEditTarget(h)}
                  onDelete={() => setDeleteTarget(h)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: mini calendar */}
        <MiniCalendar
          year={year}
          month={month}
          holidays={holidays}
          onMonthChange={setMonth}
        />
      </div>

      {/* ── Modals ── */}
      {addOpen && (
        <HolidayFormModal onSave={handleAdd} onClose={() => setAddOpen(false)} />
      )}
      {editTarget && (
        <HolidayFormModal
          holiday={editTarget}
          onSave={handleEdit}
          onClose={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          holiday={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
