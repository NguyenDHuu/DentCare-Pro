import { useState, useEffect } from 'react'
import {
  Search, Plus, Pencil, History, X, Loader2, AlertTriangle,
  ChevronDown, Clock, CalendarClock, ArrowRight, Tag, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { priceApi } from '../../api/prices.api'
import type { PriceEntry, PriceHistoryItem, CurrentPrice, UpcomingPrice } from '../../api/prices.api'
import { serviceApi } from '../../api/services.api'
import type { ServiceGroup, Service } from '../../api/services.api'

// ─── Constants ───────────────────────────────────────────────

const STATUS_MAP = {
  ACTIVE:        { label: 'Đang áp dụng', color: '#16a34a', bg: '#dcfce7' },
  EXPIRING_SOON: { label: 'Sắp hết hạn',  color: '#b45309', bg: '#fef3c7' },
} as const

const btn = {
  base:    { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none' } as React.CSSProperties,
  primary: { backgroundColor: '#2563eb', color: 'white' } as React.CSSProperties,
  ghost:   { backgroundColor: 'transparent', color: '#6b7280', border: '1px solid #e5e7eb' } as React.CSSProperties,
}

function fmtVND(n: number) { return n.toLocaleString('vi-VN') + 'đ' }

function fmtDate(d: string | Date | null | undefined, short = false) {
  if (!d) return null
  const opts: Intl.DateTimeFormatOptions = short
    ? { day: '2-digit', month: '2-digit' }
    : { day: '2-digit', month: '2-digit', year: 'numeric' }
  return new Date(d).toLocaleDateString('vi-VN', opts)
}

function toInputDate(d: string | null | undefined): string {
  if (!d) return ''
  return new Date(d).toISOString().slice(0, 10)
}

function previewEff(base: string, disc: string) {
  const b = parseFloat(base) || 0
  const d = parseFloat(disc) || 0
  return { base: b, disc: d, eff: Math.round(b * (1 - d / 100)) }
}

// ─── Primitives ──────────────────────────────────────────────

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '24px 16px', overflowY: 'auto' }}>
      {children}
    </div>
  )
}

function ModalCard({ children, maxWidth }: { children: React.ReactNode; maxWidth: number }) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '100%', maxWidth, maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', margin: 'auto' }}>
      {children}
    </div>
  )
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 14px', color: '#dc2626', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
      <AlertTriangle size={15} /> {msg}
    </div>
  )
}

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, backgroundColor: type === 'success' ? '#22c55e' : '#ef4444', color: 'white', padding: '12px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '10px' }}>
      {type === 'success' ? '✓' : '✕'} {msg}
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 0 }}><X size={14} /></button>
    </div>
  )
}

function SelectInput({ value, onChange, style, children }: { value: string | number; onChange: (v: string) => void; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', ...style }}>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '9px 32px 9px 12px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', appearance: 'none', backgroundColor: 'white', cursor: 'pointer', outline: 'none', color: '#374151', boxSizing: 'border-box' }}
        onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
        onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')}>
        {children}
      </select>
      <ChevronDown size={13} color="#9ca3af" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
    </div>
  )
}

function IconBtn({ icon, title, color = '#6b7280', bg, onClick, disabled }: { icon: React.ReactNode; title: string; color?: string; bg?: string; onClick: () => void; disabled?: boolean }) {
  const [hover, setHover] = useState(false)
  return (
    <button title={title} onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ width: '30px', height: '30px', border: '1px solid #e5e7eb', borderRadius: '7px', background: hover && !disabled ? (bg ?? '#f9fafb') : 'white', cursor: disabled ? 'not-allowed' : 'pointer', color: disabled ? '#d1d5db' : color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.12s' }}>
      {icon}
    </button>
  )
}

// ─── Inline price input group ────────────────────────────────

interface PriceFields {
  base: string; disc: string; start: string; end: string
}

function PriceInputGroup({ value, onChange, accent, inputSt }: {
  value: PriceFields
  onChange: (f: Partial<PriceFields>) => void
  accent: string
  inputSt: React.CSSProperties
}) {
  const { base: b, disc: d, eff } = previewEff(value.base, value.disc)
  const lbl: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 600, color: '#6b7280', marginBottom: '4px' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* 4-column grid: base | discount | start | end */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 1fr 1fr', gap: '8px', alignItems: 'end' }}>
        <div>
          <label style={lbl}>Giá niêm yết (đ) <span style={{ color: '#ef4444' }}>*</span></label>
          <input type="number" min={0} value={value.base} placeholder="500000"
            onChange={e => onChange({ base: e.target.value })} style={inputSt}
            onFocus={e => (e.currentTarget.style.borderColor = accent)}
            onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
        </div>
        <div>
          <label style={lbl}>Giảm (%)</label>
          <input type="number" min={0} max={100} step={0.1} value={value.disc}
            onChange={e => onChange({ disc: e.target.value })} style={inputSt}
            onFocus={e => (e.currentTarget.style.borderColor = accent)}
            onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
        </div>
        <div>
          <label style={lbl}>Ngày bắt đầu <span style={{ color: '#ef4444' }}>*</span></label>
          <input type="date" value={value.start} onChange={e => onChange({ start: e.target.value })} style={inputSt}
            onFocus={e => (e.currentTarget.style.borderColor = accent)}
            onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
        </div>
        <div>
          <label style={lbl}>Ngày kết thúc <span style={{ color: '#9ca3af', fontWeight: 400 }}>(tùy chọn)</span></label>
          <input type="date" value={value.end} onChange={e => onChange({ end: e.target.value })} style={inputSt}
            onFocus={e => (e.currentTarget.style.borderColor = accent)}
            onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
        </div>
      </div>

      {/* Effective price — single compact line */}
      {b > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', backgroundColor: `${accent}10`, border: `1px solid ${accent}25`, borderRadius: '6px' }}>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>Giá áp dụng:</span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: accent }}>{fmtVND(eff)}</span>
          {d > 0 && <span style={{ fontSize: '11px', color: '#9ca3af' }}>({fmtVND(b)} − {d}%)</span>}
        </div>
      )}
    </div>
  )
}

// ─── Combined Edit Modal ──────────────────────────────────────
// Cho phép sửa giá hiện tại VÀ thiết lập / sửa giá tương lai trong cùng 1 form.

function EditPriceModal({ entry, onClose, onSaved }: {
  entry: PriceEntry
  onClose: () => void
  onSaved: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const cp = entry.currentPrice
  const up = entry.upcomingPrice

  // ── Section 1: current price ──
  const [cur, setCur] = useState<PriceFields>({
    base:  cp?.basePrice.toString()  ?? '',
    disc:  cp?.discountPct.toString() ?? '0',
    start: toInputDate(cp?.startDate),
    end:   toInputDate(cp?.endDate),
  })

  // ── Section 2: upcoming price ──
  const [showUpcoming, setShowUpcoming] = useState(!!up)
  const [fut, setFut] = useState<PriceFields>({
    base:  up?.basePrice.toString()  ?? '',
    disc:  up?.discountPct.toString() ?? '0',
    start: toInputDate(up?.startDate) || today,
    end:   toInputDate(up?.endDate),
  })

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const inputSt: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1.5px solid #e5e7eb', borderRadius: '7px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)

    try {
      // 1. Update current price (if exists)
      if (cp) {
        if (!cur.base || parseFloat(cur.base) < 0) throw new Error('Giá niêm yết hiện tại phải ≥ 0')
        if (!cur.start) throw new Error('Ngày bắt đầu giá hiện tại không được để trống')
        await priceApi.updatePrice(cp.id, {
          basePrice:   Math.round(parseFloat(cur.base)),
          discountPct: parseFloat(cur.disc) || 0,
          startDate:   cur.start,
          endDate:     cur.end || null,
        })
      }

      // 2. Handle upcoming price
      if (showUpcoming) {
        if (!fut.base || parseFloat(fut.base) < 0) throw new Error('Giá niêm yết sắp tới phải ≥ 0')
        if (!fut.start) throw new Error('Ngày bắt đầu giá sắp tới không được để trống')
        const futData = {
          basePrice:   Math.round(parseFloat(fut.base)),
          discountPct: parseFloat(fut.disc) || 0,
          startDate:   fut.start,
          endDate:     fut.end || undefined,
        }
        if (up) {
          await priceApi.updatePrice(up.id, futData)
        } else {
          await priceApi.createPrice({ serviceId: entry.serviceId, ...futData })
        }
      }

      onSaved()
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Lỗi hệ thống')
      setLoading(false)
    }
  }

  return (
    <Overlay>
      <ModalCard maxWidth={640}>
        {/* Header */}
        <div style={{ padding: '14px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0 }}>Cập nhật giá dịch vụ</h3>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>Giá hiện hành tại thời điểm phát sinh dịch vụ (UC10).</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px', flexShrink: 0 }}><X size={16} /></button>
        </div>

        {/* Service name */}
        <div style={{ padding: '8px 20px', backgroundColor: '#f9fafb', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', fontFamily: 'monospace', backgroundColor: '#e5e7eb', color: '#6b7280', padding: '1px 6px', borderRadius: '4px' }}>{entry.serviceCode}</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{entry.serviceName}</span>
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>· {entry.groupName}</span>
        </div>

        <form onSubmit={handleSave} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {error && <ErrorBanner msg={error} />}

            {/* ── Section 1: Giá hiện tại ── */}
            <div style={{ border: '1.5px solid #dbeafe', borderRadius: '8px' }}>
              <div style={{ backgroundColor: '#eff6ff', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #dbeafe', borderRadius: '7px 7px 0 0' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#2563eb', flexShrink: 0 }} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1d4ed8' }}>Giá hiện tại</span>
                {cp?.status && (
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '1px 7px', borderRadius: '99px', backgroundColor: STATUS_MAP[cp.status as keyof typeof STATUS_MAP]?.bg, color: STATUS_MAP[cp.status as keyof typeof STATUS_MAP]?.color }}>
                    {STATUS_MAP[cp.status as keyof typeof STATUS_MAP]?.label}
                  </span>
                )}
                {!cp && <span style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>Chưa có giá hiện hành</span>}
              </div>
              <div style={{ padding: '12px 14px' }}>
                {cp ? (
                  <PriceInputGroup value={cur} onChange={f => setCur(prev => ({ ...prev, ...f }))} accent="#2563eb" inputSt={inputSt} />
                ) : (
                  <p style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '8px 0', margin: 0 }}>
                    Dịch vụ chưa có giá nào đang hiệu lực. Hãy thiết lập giá sắp tới bên dưới.
                  </p>
                )}
              </div>
            </div>

            {/* ── Section 2: Giá sắp tới ── */}
            <div style={{ border: `1.5px solid ${showUpcoming ? '#fde68a' : '#e5e7eb'}`, borderRadius: '8px', transition: 'border-color 0.2s' }}>
              {/* Toggle header */}
              <button
                type="button"
                onClick={() => setShowUpcoming(v => !v)}
                style={{ width: '100%', backgroundColor: showUpcoming ? '#fffbeb' : '#f9fafb', padding: '7px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: 'none', cursor: 'pointer', borderBottom: showUpcoming ? '1px solid #fde68a' : 'none', borderRadius: showUpcoming ? '7px 7px 0 0' : '7px', transition: 'background 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: showUpcoming ? '#d97706' : '#d1d5db', flexShrink: 0, transition: 'background 0.2s' }} />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: showUpcoming ? '#b45309' : '#6b7280' }}>
                    {up ? 'Giá sắp tới (đã thiết lập)' : 'Thiết lập giá sắp tới'}
                  </span>
                  {up && !showUpcoming && (
                    <span style={{ fontSize: '11px', color: '#d97706', backgroundColor: '#fef3c7', padding: '1px 7px', borderRadius: '99px', fontWeight: 600 }}>
                      Từ {fmtDate(up.startDate)}: {fmtVND(up.effectivePrice)}
                    </span>
                  )}
                </div>
                <div style={{ color: showUpcoming ? '#d97706' : '#9ca3af' }}>
                  {showUpcoming ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                </div>
              </button>

              {/* Upcoming fields */}
              {showUpcoming && (
                <div style={{ padding: '10px 14px', backgroundColor: '#fffbeb' }}>
                  <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', padding: '6px 10px', marginBottom: '10px', fontSize: '12px', color: '#92400e', display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
                    <CalendarClock size={12} color="#d97706" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span>Sẽ <strong>tự động thay thế</strong> giá hiện tại khi đến ngày bắt đầu. Cho đến lúc đó, <strong>giá hiện tại vẫn áp dụng</strong> cho mọi hóa đơn.</span>
                  </div>
                  <PriceInputGroup value={fut} onChange={f => setFut(prev => ({ ...prev, ...f }))} accent="#d97706" inputSt={{ ...inputSt, borderColor: '#fde68a' }} />
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '10px 20px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0 }}>
            <button type="button" onClick={onClose} style={{ ...btn.base, ...btn.ghost }}>Hủy</button>
            <button type="submit" disabled={loading} style={{ ...btn.base, backgroundColor: '#2563eb', color: 'white', opacity: loading ? 0.7 : 1 }}>
              {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              Lưu thay đổi
            </button>
          </div>
        </form>
      </ModalCard>
    </Overlay>
  )
}

// ─── Add Modal (single price creation) ───────────────────────

function AddPriceModal({ services, onClose, onSaved }: { services: Service[]; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [serviceId, setServiceId] = useState<number>(0)
  const [fields, setFields] = useState<PriceFields>({ base: '', disc: '0', start: today, end: '' })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const inputSt: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!serviceId) { setError('Vui lòng chọn dịch vụ'); return }
    if (!fields.base || parseFloat(fields.base) < 0) { setError('Giá niêm yết phải ≥ 0'); return }
    if (!fields.start) { setError('Vui lòng chọn ngày bắt đầu'); return }
    setLoading(true); setError('')
    try {
      await priceApi.createPrice({
        serviceId,
        basePrice:   Math.round(parseFloat(fields.base)),
        discountPct: parseFloat(fields.disc) || 0,
        startDate:   fields.start,
        ...(fields.end ? { endDate: fields.end } : {}),
      })
      onSaved()
    } catch (err: any) { setError(err.response?.data?.message || 'Lỗi hệ thống'); setLoading(false) }
  }

  return (
    <Overlay>
      <ModalCard maxWidth={520}>
        <div style={{ padding: '22px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#111827', margin: 0 }}>Thiết lập giá mới</h3>
            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Giá dùng cho hóa đơn là giá hiện hành tại thời điểm phát sinh dịch vụ (UC10).</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px' }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {error && <ErrorBanner msg={error} />}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                Dịch vụ <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <SelectInput value={serviceId} onChange={v => setServiceId(Number(v))} style={{ width: '100%' }}>
                <option value={0} disabled>-- Chọn dịch vụ --</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </SelectInput>
            </div>
            <PriceInputGroup value={fields} onChange={f => setFields(prev => ({ ...prev, ...f }))} accent="#2563eb" inputSt={inputSt} />
          </div>
          <div style={{ padding: '14px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={onClose} style={{ ...btn.base, ...btn.ghost }}>Hủy</button>
            <button type="submit" disabled={loading} style={{ ...btn.base, backgroundColor: '#2563eb', color: 'white', opacity: loading ? 0.7 : 1 }}>
              {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              Thiết lập giá
            </button>
          </div>
        </form>
      </ModalCard>
    </Overlay>
  )
}

// ─── Price cells ──────────────────────────────────────────────

function CurrentPriceCell({ cp }: { cp: CurrentPrice | null }) {
  if (!cp) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 12px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px dashed #e5e7eb' }}>
        <span style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>Chưa có giá hiện hành</span>
      </div>
    )
  }
  const st = STATUS_MAP[cp.status as keyof typeof STATUS_MAP]
  return (
    <div style={{ backgroundColor: '#f8faff', border: '1px solid #dbeafe', borderRadius: '8px', padding: '10px 12px' }}>
      <p style={{ fontSize: '15px', fontWeight: 700, color: '#1d4ed8', margin: 0 }}>{fmtVND(cp.effectivePrice)}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
        {cp.discountPct > 0 ? (
          <>
            <span style={{ fontSize: '11px', color: '#9ca3af', textDecoration: 'line-through' }}>{fmtVND(cp.basePrice)}</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', backgroundColor: '#dcfce7', padding: '1px 5px', borderRadius: '4px' }}>-{cp.discountPct}%</span>
          </>
        ) : (
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Giá niêm yết</span>
        )}
      </div>
      <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
        {fmtDate(cp.startDate, true)} <ArrowRight size={9} /> {cp.endDate ? fmtDate(cp.endDate, true) : 'Không giới hạn'}
      </p>
      <div style={{ marginTop: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '99px', backgroundColor: st.bg, color: st.color }}>
          {st.label}
        </span>
        {cp.status === 'EXPIRING_SOON' && cp.daysLeft != null && (
          <span style={{ fontSize: '10px', color: '#d97706', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
            <Clock size={9} /> Còn {cp.daysLeft} ngày
          </span>
        )}
      </div>
    </div>
  )
}

function UpcomingPriceCell({ up }: { up: UpcomingPrice | null }) {
  if (!up) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <span style={{ fontSize: '20px', color: '#e5e7eb' }}>—</span>
      </div>
    )
  }
  return (
    <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 12px' }}>
      <p style={{ fontSize: '15px', fontWeight: 700, color: '#b45309', margin: 0 }}>{fmtVND(up.effectivePrice)}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
        {up.discountPct > 0 ? (
          <>
            <span style={{ fontSize: '11px', color: '#9ca3af', textDecoration: 'line-through' }}>{fmtVND(up.basePrice)}</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', backgroundColor: '#dcfce7', padding: '1px 5px', borderRadius: '4px' }}>-{up.discountPct}%</span>
          </>
        ) : (
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Giá niêm yết</span>
        )}
      </div>
      <p style={{ fontSize: '11px', color: '#b45309', marginTop: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
        <CalendarClock size={9} /> Từ {fmtDate(up.startDate)}
      </p>
      <div style={{ marginTop: '5px' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '99px', backgroundColor: '#fef3c7', color: '#b45309' }}>
          Sắp áp dụng
        </span>
      </div>
    </div>
  )
}

// ─── History Modal ────────────────────────────────────────────

function HistoryModal({ serviceId, serviceName, onClose }: { serviceId: number; serviceName: string; onClose: () => void }) {
  const [history, setHistory] = useState<PriceHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const STATUS_ALL: Record<string, { label: string; color: string; bg: string }> = {
    ACTIVE:        { label: 'Đang áp dụng', color: '#16a34a', bg: '#dcfce7' },
    EXPIRING_SOON: { label: 'Sắp hết hạn',  color: '#b45309', bg: '#fef3c7' },
    UPCOMING:      { label: 'Sắp áp dụng',  color: '#7c3aed', bg: '#ede9fe' },
    EXPIRED:       { label: 'Hết hạn',       color: '#6b7280', bg: '#f3f4f6' },
  }
  useEffect(() => {
    priceApi.getHistory(serviceId).then(r => setHistory(r.data.history)).catch(() => setHistory([])).finally(() => setLoading(false))
  }, [serviceId])

  return (
    <Overlay>
      <ModalCard maxWidth={700}>
        <div style={{ padding: '22px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f3f4f6' }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#111827', margin: 0 }}>Lịch sử giá</h3>
            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>Dịch vụ: <strong style={{ color: '#111827' }}>{serviceName}</strong></p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px' }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.7fr 2fr 1.1fr', padding: '10px 20px', backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {['Niêm yết', 'Giá áp dụng', 'Giảm', 'Thời gian', 'Trạng thái'].map(h => <span key={h}>{h}</span>)}
          </div>
          {loading
            ? <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>
            : history.length === 0
              ? <p style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontSize: '14px' }}>Chưa có lịch sử giá.</p>
              : history.map((h, i) => {
                  const s = STATUS_ALL[h.status] ?? STATUS_ALL.EXPIRED
                  return (
                    <div key={h.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.7fr 2fr 1.1fr', padding: '12px 20px', alignItems: 'center', borderBottom: i < history.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                      <span style={{ fontSize: '13px', color: '#374151' }}>{fmtVND(h.basePrice)}</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#2563eb' }}>{fmtVND(h.effectivePrice)}</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: h.discountPct > 0 ? '#16a34a' : '#9ca3af' }}>{h.discountPct > 0 ? `-${h.discountPct}%` : '—'}</span>
                      <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.7 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>{fmtDate(h.startDate)} <ArrowRight size={10} /> {h.endDate ? fmtDate(h.endDate) : 'Không giới hạn'}</span>
                        {h.status === 'EXPIRING_SOON' && h.daysLeft != null && <span style={{ color: '#d97706', fontSize: '11px' }}>(Còn {h.daysLeft} ngày)</span>}
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '99px', backgroundColor: s.bg, color: s.color, display: 'inline-block', whiteSpace: 'nowrap' }}>{s.label}</span>
                    </div>
                  )
                })
          }
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...btn.base, ...btn.ghost }}>Đóng</button>
        </div>
      </ModalCard>
    </Overlay>
  )
}

// ─── Main Page ────────────────────────────────────────────────

export default function PricePage() {
  const [prices,         setPrices]         = useState<PriceEntry[]>([])
  const [groups,         setGroups]         = useState<ServiceGroup[]>([])
  const [activeServices, setActiveServices] = useState<Service[]>([])
  const [loading,        setLoading]        = useState(true)
  const [searchInput,    setSearchInput]    = useState('')
  const [filterGroup,    setFilterGroup]    = useState<number>(0)
  const [filterStatus,   setFilterStatus]   = useState('')
  const [addOpen,        setAddOpen]        = useState(false)
  const [editTarget,     setEditTarget]     = useState<PriceEntry | null>(null)
  const [historyTarget,  setHistoryTarget]  = useState<PriceEntry | null>(null)
  const [toast,          setToast]          = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type })

  const loadPrices = async (q = searchInput, gId = filterGroup, st = filterStatus) => {
    setLoading(true)
    try {
      const res = await priceApi.getPrices({ search: q || undefined, groupId: gId || undefined, status: st || undefined })
      setPrices(res.data)
    } catch { showToast('Không thể tải bảng giá', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    loadPrices()
    serviceApi.getGroups().then(r => setGroups(r.data)).catch(() => {})
    serviceApi.getServices({ status: 'ACTIVE' }).then(r => setActiveServices(r.data)).catch(() => {})
  }, [])

  const doSearch = (q: string) => { setSearchInput(q); loadPrices(q, filterGroup, filterStatus) }

  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') doSearch(searchInput)
  }

  const handleClearSearch = () => doSearch('')

  return (
    <div>
      {/* Info banner */}
      <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <AlertTriangle size={15} color="#d97706" style={{ flexShrink: 0, marginTop: '1px' }} />
        <div style={{ fontSize: '13px', color: '#92400e', lineHeight: 1.6 }}>
          <strong>Quy tắc áp dụng giá:</strong> Cột <strong>"Giá hiện tại"</strong> là giá đang được áp dụng.
          Cột <strong>"Giá sắp tới"</strong> hiển thị giá sẽ có hiệu lực trong tương lai —
          giá hiện tại <strong>vẫn tiếp tục áp dụng</strong> cho đến khi giá mới bắt đầu.
          Nhấn <strong>✏ Cập nhật</strong> để sửa giá hiện tại và / hoặc thiết lập giá sắp tới cùng lúc.
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: '280px', display: 'flex', alignItems: 'center' }}>
          <Search size={15} color="#9ca3af" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }} />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKey}
            placeholder="Tìm tên / mã dịch vụ... (Enter)"
            style={{ width: '100%', padding: '9px 32px 9px 36px', border: '1.5px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
            onBlur={e => (e.currentTarget.style.borderColor = '#e5e7eb')} />
          {searchInput && (
            <button onClick={handleClearSearch} style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', padding: '2px' }}>
              <X size={13} />
            </button>
          )}
        </div>

        <button onClick={() => doSearch(searchInput)} style={{ ...btn.base, ...btn.ghost, padding: '9px 14px' }}>
          <Search size={14} /> Tìm
        </button>

        <SelectInput value={filterGroup} onChange={v => { const g = Number(v); setFilterGroup(g); loadPrices(searchInput, g, filterStatus) }} style={{ width: '175px' }}>
          <option value={0}>Mọi nhóm</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </SelectInput>

        <SelectInput value={filterStatus} onChange={v => { setFilterStatus(v); loadPrices(searchInput, filterGroup, v) }} style={{ width: '185px' }}>
          <option value="">Mọi trạng thái</option>
          <option value="ACTIVE">Đang áp dụng</option>
          <option value="EXPIRING_SOON">Sắp hết hạn</option>
          <option value="UPCOMING">Có giá sắp tới</option>
        </SelectInput>

        <div style={{ flex: 1 }} />

        <button onClick={() => setAddOpen(true)} style={{ ...btn.base, ...btn.primary }}>
          <Plus size={15} /> Thiết lập giá mới
        </button>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflowX: 'auto' }}>
        <div style={{ minWidth: '860px' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 2fr 2fr 80px', padding: '12px 20px', backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb', borderRadius: '12px 12px 0 0' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Dịch vụ</span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nhóm</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#2563eb' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Giá hiện tại</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#d97706' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Giá sắp tới</span>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Thao tác</span>
          </div>

          {/* Body */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}><Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} /></div>
          ) : prices.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '60px', fontSize: '14px', color: '#9ca3af' }}>Không có cấu hình giá nào phù hợp.</p>
          ) : prices.map((p, i) => (
            <div key={p.serviceId} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 2fr 2fr 80px', padding: '12px 20px', alignItems: 'center', borderBottom: i < prices.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
              <div style={{ paddingRight: '12px' }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>{p.serviceName}</p>
                <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace', backgroundColor: '#f3f4f6', padding: '1px 6px', borderRadius: '4px', marginTop: '3px', display: 'inline-block' }}>{p.serviceCode}</span>
              </div>

              <div style={{ paddingRight: '12px' }}>
                <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: 500 }}>{p.groupName}</span>
              </div>

              <div style={{ paddingRight: '12px' }}>
                <CurrentPriceCell cp={p.currentPrice} />
              </div>

              <div style={{ paddingRight: '12px' }}>
                <UpcomingPriceCell up={p.upcomingPrice} />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                <IconBtn
                  icon={<Pencil size={14} />}
                  title="Cập nhật giá (hiện tại + sắp tới)"
                  color="#2563eb" bg="#eff6ff"
                  onClick={() => setEditTarget(p)}
                />
                <IconBtn
                  icon={<History size={14} />}
                  title="Xem lịch sử giá"
                  onClick={() => setHistoryTarget(p)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      {!loading && prices.length > 0 && (
        <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: '13px', color: '#9ca3af' }}>
            {prices.length} dịch vụ trong bảng giá
            {prices.filter(p => p.upcomingPrice).length > 0 && (
              <span style={{ marginLeft: '10px', color: '#d97706', fontWeight: 500 }}>
                · {prices.filter(p => p.upcomingPrice).length} dịch vụ có giá sắp thay đổi
              </span>
            )}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#6b7280' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Tag size={11} color="#2563eb" /> Giá hiện tại</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><CalendarClock size={11} color="#d97706" /> Giá sắp tới</span>
          </div>
        </div>
      )}

      {/* Modals */}
      {addOpen && (
        <AddPriceModal services={activeServices} onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); showToast('Thiết lập giá thành công'); loadPrices() }} />
      )}

      {editTarget && (
        <EditPriceModal entry={editTarget} onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); showToast('Cập nhật giá thành công'); loadPrices() }} />
      )}

      {historyTarget && (
        <HistoryModal serviceId={historyTarget.serviceId} serviceName={historyTarget.serviceName} onClose={() => setHistoryTarget(null)} />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
