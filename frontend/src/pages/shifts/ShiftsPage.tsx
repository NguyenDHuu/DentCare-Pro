import { useState, useEffect } from 'react'
import {
  Plus, Pencil, Trash2, Clock, Users, CalendarDays,
  X, Loader2, AlertTriangle, Power,
} from 'lucide-react'
import { shiftApi, type WorkShift, type ShiftInput } from '../../api/shifts.api'

// ─── Constants ───────────────────────────────────────────────

const ALL_DAYS = [2, 3, 4, 5, 6, 7, 0] as const
const DAY_LABELS: Record<number, string> = {
  2: 'T2', 3: 'T3', 4: 'T4', 5: 'T5', 6: 'T6', 7: 'T7', 0: 'CN',
}
const SLOT_OPTIONS   = [10, 15, 20, 30, 45, 60]
const BUFFER_OPTIONS = [0, 5, 10, 15]

const COLOR_DEFS: Record<string, {
  label: string
  text: string
  iconBg: string
  dayBg: string
  border: string
  statusBg: string
  statusText: string
}> = {
  blue:   { label: 'Xanh dương', text: '#2563eb', iconBg: '#dbeafe', dayBg: '#2563eb', border: '#bfdbfe', statusBg: '#eff6ff', statusText: '#2563eb' },
  green:  { label: 'Xanh lá',   text: '#16a34a', iconBg: '#dcfce7', dayBg: '#16a34a', border: '#bbf7d0', statusBg: '#f0fdf4', statusText: '#16a34a' },
  purple: { label: 'Tím',       text: '#9333ea', iconBg: '#f3e8ff', dayBg: '#9333ea', border: '#e9d5ff', statusBg: '#faf5ff', statusText: '#9333ea' },
  orange: { label: 'Cam',       text: '#ea580c', iconBg: '#ffedd5', dayBg: '#ea580c', border: '#fed7aa', statusBg: '#fff7ed', statusText: '#ea580c' },
  red:    { label: 'Đỏ',        text: '#e11d48', iconBg: '#ffe4e6', dayBg: '#e11d48', border: '#fecdd3', statusBg: '#fff1f2', statusText: '#e11d48' },
  teal:   { label: 'Ngọc',      text: '#0d9488', iconBg: '#ccfbf1', dayBg: '#0d9488', border: '#99f6e4', statusBg: '#f0fdfa', statusText: '#0d9488' },
  pink:   { label: 'Hồng',      text: '#c026d3', iconBg: '#fae8ff', dayBg: '#c026d3', border: '#f0abfc', statusBg: '#fdf4ff', statusText: '#c026d3' },
}

const btn = {
  base:    { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none' } as React.CSSProperties,
  primary: { backgroundColor: '#2563eb', color: 'white' } as React.CSSProperties,
  ghost:   { backgroundColor: 'transparent', color: '#6b7280', border: '1px solid #e5e7eb' } as React.CSSProperties,
  danger:  { backgroundColor: '#dc2626', color: 'white' } as React.CSSProperties,
}

// ─── Toast ───────────────────────────────────────────────────

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])
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

// ─── Shared UI ────────────────────────────────────────────────

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '16px',
    }}>
      {children}
    </div>
  )
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div style={{
      backgroundColor: '#fef2f2', border: '1px solid #fca5a5',
      borderRadius: '8px', padding: '10px 14px', color: '#dc2626',
      fontSize: '13px', display: 'flex', alignItems: 'flex-start', gap: '8px',
    }}>
      <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '1px' }} /> {msg}
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {children}
    </div>
  )
}

// ─── Color Picker ─────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {Object.entries(COLOR_DEFS).map(([key, c]) => (
        <button
          key={key}
          type="button"
          title={c.label}
          onClick={() => onChange(key)}
          style={{
            width: '28px', height: '28px', borderRadius: '50%',
            backgroundColor: c.dayBg, border: value === key ? '3px solid #111827' : '3px solid transparent',
            cursor: 'pointer', flexShrink: 0, outline: value === key ? '2px solid white' : 'none',
            outlineOffset: '-4px',
          }}
        />
      ))}
    </div>
  )
}

// ─── Day Picker ───────────────────────────────────────────────

function DayPicker({ value, onChange, color }: { value: number[]; onChange: (d: number[]) => void; color: string }) {
  const c = COLOR_DEFS[color] ?? COLOR_DEFS.blue
  const toggle = (d: number) =>
    onChange(value.includes(d) ? value.filter(x => x !== d) : [...value, d])

  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      {ALL_DAYS.map(d => {
        const active = value.includes(d)
        return (
          <button
            key={d}
            type="button"
            onClick={() => toggle(d)}
            style={{
              width: '36px', height: '36px', borderRadius: '50%', border: 'none',
              fontSize: '11px', fontWeight: 700, cursor: 'pointer',
              backgroundColor: active ? c.dayBg : '#f3f4f6',
              color: active ? 'white' : '#9ca3af',
              transition: 'all 0.15s',
            }}
          >
            {DAY_LABELS[d]}
          </button>
        )
      })}
    </div>
  )
}

// ─── Shift Form Modal ─────────────────────────────────────────

function ShiftFormModal({
  mode,
  initial,
  onSave,
  onClose,
}: {
  mode: 'add' | 'edit'
  initial?: WorkShift
  onSave: (data: ShiftInput) => Promise<void>
  onClose: () => void
}) {
  const [name,         setName]         = useState(initial?.name         ?? '')
  const [startTime,    setStartTime]    = useState(initial?.startTime    ?? '08:00')
  const [endTime,      setEndTime]      = useState(initial?.endTime      ?? '12:00')
  const [slotDuration, setSlotDuration] = useState(initial?.slotDuration ?? 15)
  const [bufferTime,   setBufferTime]   = useState(initial?.bufferTime   ?? 0)
  const [maxPatients,  setMaxPatients]  = useState(initial?.maxPatients  ?? 6)
  const [reserveSlots, setReserveSlots] = useState(initial?.reserveSlots ?? 1)
  const [applyDays,    setApplyDays]    = useState<number[]>(initial?.applyDays ?? [2, 3, 4, 5, 6])
  const [colorCode,    setColorCode]    = useState(initial?.colorCode    ?? 'blue')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb',
    borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', backgroundColor: 'white',
  }
  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) =>
    (e.currentTarget.style.borderColor = '#3b82f6')
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) =>
    (e.currentTarget.style.borderColor = '#e5e7eb')

  // Preview: tính số slot theo logic đúng
  const preview = (() => {
    const toMin = (t: string) => t.split(':').reduce((acc, v, i) => acc + (i === 0 ? +v * 60 : +v), 0)
    const shiftMin = toMin(endTime) - toMin(startTime)
    if (shiftMin <= 0 || slotDuration <= 0) return null
    const cycleTime  = slotDuration + bufferTime  // thời gian 1 chu kỳ (slot + đệm)
    const totalSlots = Math.floor(shiftMin / cycleTime)
    const available  = Math.max(0, totalSlots - reserveSlots)
    return { shiftMin, totalSlots, available, cycleTime }
  })()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim())         { setError('Tên ca không được để trống'); return }
    if (applyDays.length === 0){ setError('Phải chọn ít nhất một ngày trong tuần'); return }
    setLoading(true); setError('')
    try {
      await onSave({ name, startTime, endTime, slotDuration, bufferTime, maxPatients, reserveSlots, applyDays, colorCode })
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi hệ thống')
      setLoading(false)
    }
  }

  return (
    <Overlay>
      <div style={{
        backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '520px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#111827', margin: 0 }}>
              {mode === 'add' ? 'Thêm ca làm việc mới' : 'Chỉnh sửa ca làm việc'}
            </h3>
            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
              Thay đổi chỉ có hiệu lực từ ngày hôm sau trở đi.
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ overflow: 'auto', flex: 1 }}>
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && <ErrorBanner msg={error} />}

            {/* Tên ca */}
            <Field label="Tên ca" required>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Ví dụ: Ca sáng, Ca chiều, Ca tối..."
                autoFocus style={inputStyle} onFocus={onFocus} onBlur={onBlur}
              />
            </Field>

            {/* Giờ bắt đầu / Kết thúc */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Giờ bắt đầu" required>
                <input
                  type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur}
                />
              </Field>
              <Field label="Giờ kết thúc" required>
                <input
                  type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur}
                />
              </Field>
            </div>

            {/* Slot cơ bản + Thời gian đệm */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Độ dài slot cơ bản" required>
                <div style={{ position: 'relative' }}>
                  <select
                    value={slotDuration}
                    onChange={e => setSlotDuration(Number(e.target.value))}
                    style={{ ...inputStyle, appearance: 'none', paddingRight: '36px', cursor: 'pointer' }}
                    onFocus={onFocus} onBlur={onBlur}
                  >
                    {SLOT_OPTIONS.map(o => (
                      <option key={o} value={o}>{o} phút</option>
                    ))}
                  </select>
                  <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9ca3af', fontSize: '12px' }}>▾</span>
                </div>
              </Field>
              <Field label="Thời gian đệm giữa lịch hẹn">
                <div style={{ position: 'relative' }}>
                  <select
                    value={bufferTime}
                    onChange={e => setBufferTime(Number(e.target.value))}
                    style={{ ...inputStyle, appearance: 'none', paddingRight: '36px', cursor: 'pointer' }}
                    onFocus={onFocus} onBlur={onBlur}
                  >
                    {BUFFER_OPTIONS.map(o => (
                      <option key={o} value={o}>{o === 0 ? 'Không có đệm' : `${o} phút`}</option>
                    ))}
                  </select>
                  <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9ca3af', fontSize: '12px' }}>▾</span>
                </div>
              </Field>
            </div>

            {/* Số BN tối đa + Slot dự phòng */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Số BN tối đa / bác sĩ / ca" required>
                <input
                  type="number" min={1} max={50}
                  value={maxPatients} onChange={e => setMaxPatients(Number(e.target.value))}
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur}
                />
              </Field>
              <Field label="Slot dự phòng cấp cứu / bác sĩ">
                <input
                  type="number" min={0} max={10}
                  value={reserveSlots} onChange={e => setReserveSlots(Number(e.target.value))}
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur}
                />
              </Field>
            </div>

            {/* Preview đúng logic */}
            {preview && (
              <div style={{
                backgroundColor: '#eff6ff', border: '1px solid #bfdbfe',
                borderRadius: '10px', padding: '14px 16px',
                fontSize: '13px', color: '#1e40af',
                display: 'flex', flexDirection: 'column', gap: '6px',
              }}>
                <p style={{ fontWeight: 700, margin: 0, marginBottom: '4px', color: '#1e3a8a' }}>
                  📊 Dự kiến ca ({startTime}–{endTime} = {preview.shiftMin} phút)
                </p>
                <p style={{ margin: 0 }}>
                  • <strong>{preview.totalSlots} slot</strong> × {slotDuration} phút
                  {bufferTime > 0 && ` + ${bufferTime} phút đệm`}
                  {' = chu kỳ '}<strong>{preview.cycleTime} phút</strong>
                </p>
                <p style={{ margin: 0 }}>
                  • Giữ lại <strong>{reserveSlots} slot</strong> cấp cứu →{' '}
                  còn <strong>{preview.available} slot</strong> khả dụng / bác sĩ
                </p>
                <p style={{ margin: 0 }}>
                  • Tối đa <strong>{maxPatients} bệnh nhân</strong> / bác sĩ / ca
                </p>
                <div style={{ borderTop: '1px dashed #bfdbfe', paddingTop: '8px', marginTop: '2px' }}>
                  <p style={{ margin: 0, color: '#2563eb', fontWeight: 600 }}>
                    Ví dụ: {' '}
                    2 bác sĩ × {maxPatients} BN = <strong>{2 * maxPatients} lịch</strong>{' '}
                    &nbsp;|&nbsp;{' '}
                    3 bác sĩ × {maxPatients} BN = <strong>{3 * maxPatients} lịch</strong> tối đa / ca
                  </p>
                </div>
              </div>
            )}

            {/* Ngày áp dụng */}
            <Field label="Ngày áp dụng" required>
              <DayPicker value={applyDays} onChange={setApplyDays} color={colorCode} />
              {applyDays.length > 0 && (
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                  Đã chọn: {applyDays.sort().map(d => DAY_LABELS[d]).join(', ')}
                </p>
              )}
            </Field>

            {/* Màu sắc */}
            <Field label="Màu hiển thị">
              <ColorPicker value={colorCode} onChange={setColorCode} />
              <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px' }}>
                Màu đang chọn: <strong style={{ color: COLOR_DEFS[colorCode]?.text }}>{COLOR_DEFS[colorCode]?.label}</strong>
              </p>
            </Field>
          </div>

          {/* Footer */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={onClose} style={{ ...btn.base, ...btn.ghost }}>Hủy</button>
            <button type="submit" disabled={loading} style={{ ...btn.base, ...btn.primary, opacity: loading ? 0.7 : 1 }}>
              {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              {mode === 'add' ? 'Thêm ca' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </Overlay>
  )
}

// ─── Delete Confirm Modal ─────────────────────────────────────

function DeleteModal({
  shift,
  onConfirm,
  onClose,
}: {
  shift: WorkShift
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleConfirm = async () => {
    setLoading(true); setError('')
    try { await onConfirm() }
    catch (e: any) { setError(e.response?.data?.message || 'Không thể xóa ca'); setLoading(false) }
  }

  return (
    <Overlay>
      <div style={{
        backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth: '400px',
        padding: '28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={18} color="#dc2626" />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>Xác nhận xóa ca</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6, marginBottom: '6px' }}>
          Bạn sắp xóa ca <strong style={{ color: '#111827' }}>"{shift.name}"</strong>.
          Hành động này <strong style={{ color: '#dc2626' }}>không thể hoàn tác</strong>.
        </p>
        <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '20px' }}>
          Lưu ý: Chỉ được xóa khi không còn lịch trực hoặc lịch hẹn nào phụ thuộc.
        </p>

        {error && <div style={{ marginBottom: '16px' }}><ErrorBanner msg={error} /></div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} style={{ ...btn.base, ...btn.ghost }}>Hủy</button>
          <button onClick={handleConfirm} disabled={loading} style={{ ...btn.base, ...btn.danger, opacity: loading ? 0.7 : 1 }}>
            {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            Xác nhận xóa
          </button>
        </div>
      </div>
    </Overlay>
  )
}

// ─── Shift Card ───────────────────────────────────────────────

function ShiftCard({
  shift,
  onEdit,
  onDelete,
  onToggle,
}: {
  shift: WorkShift
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  const c    = COLOR_DEFS[shift.colorCode] ?? COLOR_DEFS.blue
  const days = Array.isArray(shift.applyDays) ? shift.applyDays : []

  return (
    <div style={{
      backgroundColor: 'white', borderRadius: '16px',
      border: `1px solid ${shift.isActive ? c.border : '#e5e7eb'}`,
      padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      display: 'flex', flexDirection: 'column', gap: '16px',
      opacity: shift.isActive ? 1 : 0.75,
    }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {/* Icon */}
        <div style={{
          width: '42px', height: '42px', borderRadius: '10px',
          backgroundColor: c.iconBg, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0,
        }}>
          <Clock size={20} color={c.text} />
        </div>

        {/* Name + status */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {shift.name}
          </p>
          <span style={{
            display: 'inline-block', marginTop: '4px',
            fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '99px',
            backgroundColor: shift.isActive ? '#dcfce7' : '#f3f4f6',
            color: shift.isActive ? '#16a34a' : '#9ca3af',
          }}>
            {shift.isActive ? 'Đang hoạt động' : 'Tắt'}
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <IconBtn icon={<Power size={14} />} title={shift.isActive ? 'Tắt ca' : 'Bật ca'} color={shift.isActive ? '#9ca3af' : '#16a34a'} onClick={onToggle} />
          <IconBtn icon={<Pencil size={14} />} title="Chỉnh sửa" color="#2563eb" onClick={onEdit} />
          <IconBtn icon={<Trash2 size={14} />} title="Xóa ca" color="#dc2626" onClick={onDelete} />
        </div>
      </div>

      {/* ── Info rows ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <InfoRow
          icon={<Clock size={14} />}
          label="Giờ hoạt động"
          value={`${shift.startTime} – ${shift.endTime}`}
          color={c.text}
        />
        <InfoRow
          icon={<Users size={14} />}
          label="Tối đa / bác sĩ / ca"
          value={`${shift.maxPatients} bệnh nhân · ${shift.reserveSlots ?? 1} slot dự phòng`}
          color={c.text}
        />
        <InfoRow
          icon={<CalendarDays size={14} />}
          label="Slot cơ bản + đệm"
          value={
            (shift.bufferTime ?? 0) > 0
              ? `${shift.slotDuration} phút + ${shift.bufferTime} phút đệm`
              : `${shift.slotDuration} phút / slot`
          }
          color={c.text}
        />
      </div>

      {/* ── Days ── */}
      <div>
        <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px', fontWeight: 500 }}>
          Ngày áp dụng
        </p>
        <div style={{ display: 'flex', gap: '6px' }}>
          {ALL_DAYS.map(d => {
            const active = days.includes(d)
            return (
              <span key={d} style={{
                width: '28px', height: '28px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700,
                backgroundColor: active ? c.dayBg : '#f3f4f6',
                color: active ? 'white' : '#d1d5db',
              }}>
                {DAY_LABELS[d]}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
      <div style={{ width: '28px', height: '28px', borderRadius: '7px', backgroundColor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: color }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0, fontWeight: 500 }}>{label}</p>
        <p style={{ fontSize: '13px', color: '#111827', margin: 0, fontWeight: 600, marginTop: '1px' }}>{value}</p>
      </div>
    </div>
  )
}

function IconBtn({ icon, title, color, onClick }: { icon: React.ReactNode; title: string; color?: string; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      title={title} onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: '30px', height: '30px', border: '1px solid #e5e7eb', borderRadius: '7px',
        background: hover ? '#f9fafb' : 'white', cursor: 'pointer',
        color: color || '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}
    >
      {icon}
    </button>
  )
}

// ─── Weekly Schedule Table ───────────────────────────────────

const WEEK_COLS: { day: number; label: string }[] = [
  { day: 2, label: 'Thứ 2' },
  { day: 3, label: 'Thứ 3' },
  { day: 4, label: 'Thứ 4' },
  { day: 5, label: 'Thứ 5' },
  { day: 6, label: 'Thứ 6' },
  { day: 7, label: 'Thứ 7' },
  { day: 0, label: 'Chủ nhật' },
]

function WeeklyScheduleTable({ shifts }: { shifts: WorkShift[] }) {
  // Sắp xếp theo giờ bắt đầu
  const sorted = [...shifts].sort((a, b) => {
    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number)
      return h * 60 + m
    }
    return toMin(a.startTime) - toMin(b.startTime)
  })

  return (
    <div style={{
      backgroundColor: 'white', borderRadius: '16px',
      border: '1px solid #e5e7eb', overflow: 'hidden',
      marginTop: '24px',
    }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0 }}>
          Lịch hoạt động tuần
        </h3>
        <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '3px' }}>
          Số BN tối đa / bác sĩ / ca — nhân với số bác sĩ để ra tổng lịch khả dụng
        </p>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
          {/* Table head */}
          <thead>
            <tr style={{ backgroundColor: '#f9fafb' }}>
              <th style={{
                padding: '12px 20px', textAlign: 'left',
                fontSize: '12px', fontWeight: 700, color: '#6b7280',
                textTransform: 'uppercase', letterSpacing: '0.04em',
                borderBottom: '1px solid #e5e7eb', width: '220px',
              }}>
                Ca làm việc
              </th>
              {WEEK_COLS.map(col => (
                <th key={col.day} style={{
                  padding: '12px 8px', textAlign: 'center',
                  fontSize: '12px', fontWeight: 700, color: '#6b7280',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  borderBottom: '1px solid #e5e7eb',
                }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          {/* Table body */}
          <tbody>
            {sorted.map((shift, idx) => {
              const c = COLOR_DEFS[shift.colorCode] ?? COLOR_DEFS.blue
              const days = Array.isArray(shift.applyDays) ? (shift.applyDays as number[]) : []
              const isLast = idx === sorted.length - 1

              return (
                <tr
                  key={shift.id}
                  style={{
                    borderBottom: isLast ? 'none' : '1px solid #f3f4f6',
                    backgroundColor: shift.isActive ? 'white' : '#fafafa',
                    opacity: shift.isActive ? 1 : 0.6,
                  }}
                >
                  {/* Shift name column */}
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {/* Color dot */}
                      <span style={{
                        width: '10px', height: '10px', borderRadius: '50%',
                        backgroundColor: shift.isActive ? c.dayBg : '#d1d5db',
                        flexShrink: 0,
                      }} />
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0 }}>
                          {shift.name}
                          {!shift.isActive && (
                            <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 400, marginLeft: '6px' }}>(tắt)</span>
                          )}
                        </p>
                        <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>
                          {shift.startTime} – {shift.endTime}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Day cells */}
                  {WEEK_COLS.map(col => {
                    const applies = days.includes(col.day)
                    return (
                      <td key={col.day} style={{ padding: '14px 8px', textAlign: 'center' }}>
                        {applies ? (
                          <span style={{
                            display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                            padding: '4px 10px', borderRadius: '8px',
                            fontSize: '12px', fontWeight: 700,
                            backgroundColor: shift.isActive ? c.iconBg : '#f3f4f6',
                            color: shift.isActive ? c.text : '#9ca3af',
                            whiteSpace: 'nowrap', lineHeight: 1.3,
                          }}>
                            <span>{shift.maxPatients} BN</span>
                            <span style={{ fontSize: '10px', fontWeight: 500, opacity: 0.7 }}>
                              {shift.slotDuration}{(shift.bufferTime ?? 0) > 0 ? `+${shift.bufferTime}` : ''}p
                            </span>
                          </span>
                        ) : (
                          <span style={{ fontSize: '13px', color: '#d1d5db', fontWeight: 400 }}>–</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{
        padding: '12px 20px', borderTop: '1px solid #f3f4f6',
        display: 'flex', alignItems: 'center', gap: '20px',
        backgroundColor: '#fafafa',
      }}>
        <span style={{ fontSize: '12px', color: '#9ca3af' }}>Chú thích:</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6b7280' }}>
          <span style={{ display: 'inline-block', width: '28px', height: '18px', borderRadius: '99px', backgroundColor: '#dbeafe' }} />
          Badge màu = BN tối đa / bác sĩ · slot (phút). Tổng lịch = badge × số bác sĩ được phân công
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#9ca3af' }}>
          <span style={{ fontWeight: 700 }}>–</span>
          Ca không hoạt động ngày đó
        </span>
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '64px 24px' }}>
      <div style={{
        width: '64px', height: '64px', borderRadius: '16px',
        backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px',
      }}>
        <Clock size={28} color="#2563eb" />
      </div>
      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
        Chưa có ca làm việc nào
      </h3>
      <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '24px' }}>
        Thiết lập ca làm việc để hệ thống tính toán khung giờ đặt lịch hẹn.
      </p>
      <button onClick={onAdd} style={{ ...btn.base, ...btn.primary }}>
        <Plus size={15} /> Thêm ca đầu tiên
      </button>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════════════════════

export default function ShiftsPage() {
  const [shifts,       setShifts]       = useState<WorkShift[]>([])
  const [loading,      setLoading]      = useState(true)
  const [addOpen,      setAddOpen]      = useState(false)
  const [editTarget,   setEditTarget]   = useState<WorkShift | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WorkShift | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') =>
    setToast({ msg, type })

  const load = async () => {
    setLoading(true)
    try {
      const res = await shiftApi.getAll()
      setShifts(res.data)
    } catch {
      showToast('Không thể tải danh sách ca làm việc', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleAdd = async (data: ShiftInput) => {
    await shiftApi.create(data)
    setAddOpen(false)
    showToast('Thêm ca làm việc thành công')
    load()
  }

  const handleEdit = async (data: ShiftInput) => {
    if (!editTarget) return
    await shiftApi.update(editTarget.id, data)
    setEditTarget(null)
    showToast('Cập nhật ca làm việc thành công')
    load()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await shiftApi.delete(deleteTarget.id)
    setDeleteTarget(null)
    showToast('Đã xóa ca làm việc')
    load()
  }

  const handleToggle = async (shift: WorkShift) => {
    try {
      await shiftApi.toggle(shift.id)
      showToast(`${shift.isActive ? 'Tắt' : 'Bật'} ca "${shift.name}" thành công`)
      load()
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Không thể thay đổi trạng thái', 'error')
    }
  }

  const activeCount   = shifts.filter(s => s.isActive).length
  const inactiveCount = shifts.length - activeCount

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: '24px',
      }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>
            Cấu hình Ca làm việc <span style={{ fontSize: '14px', color: '#9ca3af', fontWeight: 400 }}>(UC06)</span>
          </h2>
          <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
            Thiết lập các ca khám và khung giờ hoạt động của phòng khám
          </p>
        </div>
        <button onClick={() => setAddOpen(true)} style={{ ...btn.base, ...btn.primary }}>
          <Plus size={15} /> Thêm ca làm việc
        </button>
      </div>

      {/* ── Stats bar ── */}
      {shifts.length > 0 && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Tổng số ca', value: shifts.length, bg: '#f9fafb', color: '#374151' },
            { label: 'Đang hoạt động', value: activeCount, bg: '#f0fdf4', color: '#16a34a' },
            { label: 'Đã tắt', value: inactiveCount, bg: '#fef2f2', color: '#dc2626' },
          ].map(s => (
            <div key={s.label} style={{
              backgroundColor: s.bg, borderRadius: '10px', padding: '12px 20px',
              display: 'flex', alignItems: 'center', gap: '10px',
              border: '1px solid #e5e7eb',
            }}>
              <span style={{ fontSize: '22px', fontWeight: 800, color: s.color }}>{s.value}</span>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px', color: '#9ca3af' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : shifts.length === 0 ? (
        <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
          <EmptyState onAdd={() => setAddOpen(true)} />
        </div>
      ) : (
        <>
          {/* ── Cards grid ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '16px',
          }}>
            {shifts.map(shift => (
              <ShiftCard
                key={shift.id}
                shift={shift}
                onEdit={() => setEditTarget(shift)}
                onDelete={() => setDeleteTarget(shift)}
                onToggle={() => handleToggle(shift)}
              />
            ))}
          </div>

          {/* ── Weekly table ── */}
          <WeeklyScheduleTable shifts={shifts} />
        </>
      )}

      {/* ── Modals ── */}
      {addOpen && (
        <ShiftFormModal mode="add" onSave={handleAdd} onClose={() => setAddOpen(false)} />
      )}
      {editTarget && (
        <ShiftFormModal
          mode="edit"
          initial={editTarget}
          onSave={handleEdit}
          onClose={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          shift={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
      {toast && (
        <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
