import { useState, useEffect, useCallback } from 'react'
import { Save, Zap, Info, CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { salaryApi, type ShiftRow } from '../../api/salary.api'

// ─── Constants ────────────────────────────────────────────────

const DAYS = [
  { key: 1, label: 'Thứ Hai' },
  { key: 2, label: 'Thứ Ba' },
  { key: 3, label: 'Thứ Tư' },
  { key: 4, label: 'Thứ Năm' },
  { key: 5, label: 'Thứ Sáu' },
  { key: 6, label: 'Thứ Bảy' },
  { key: 7, label: 'Chủ nhật' },
]

const WEEKEND_DAYS = [6, 7]

// ─── Helpers ──────────────────────────────────────────────────

/** Returns bg/text/border colors based on coefficient value */
function cellColor(val: number): { bg: string; text: string; border: string } {
  if (val === 1.0)  return { bg: '#dcfce7', text: '#15803d', border: '#86efac' }
  if (val <= 1.2)   return { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' }
  if (val <= 1.5)   return { bg: '#fef9c3', text: '#854d0e', border: '#fde047' }
  return              { bg: '#fed7aa', text: '#c2410c', border: '#fb923c' }
}

/** Matrix state key */
const mk = (shiftId: number, day: number) => `${shiftId}_${day}`

// ─── Toast ────────────────────────────────────────────────────

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error' | 'warn'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t) }, [onClose])
  const colors = {
    success: { bg: '#f0fdf4', border: '#86efac', text: '#16a34a' },
    error:   { bg: '#fff1f2', border: '#fca5a5', text: '#dc2626' },
    warn:    { bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
  }[type]
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 16px', borderRadius: 10,
      background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text,
      fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
      maxWidth: 420,
    }}>
      {type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
      <span style={{ flex: 1 }}>{msg}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'inherit' }}>
        <X size={13} />
      </button>
    </div>
  )
}

// ─── Confirm dialog for > 1.5 values ──────────────────────────

function ConfirmDialog({ count, onConfirm, onCancel }: { count: number; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
    }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '28px 32px', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={20} color="#f97316" />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>Hệ số vượt mức khuyến nghị</h3>
        </div>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px', lineHeight: 1.6 }}>
          Có <strong style={{ color: '#c2410c' }}>{count} ô</strong> có hệ số &gt; 1.5 (vượt mức khuyến nghị).
          Bạn có chắc chắn muốn lưu không?
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel}
            style={{ padding: '9px 20px', borderRadius: 8, border: '1.5px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            Kiểm tra lại
          </button>
          <button onClick={onConfirm}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#f97316', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Vẫn lưu
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Quick-apply button ───────────────────────────────────────

function QuickBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: 20, border: '1px solid #d1d5db',
        background: '#fff', fontSize: 12, fontWeight: 600, color: '#374151',
        cursor: 'pointer', transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af' }}
      onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db' }}
    >
      {label}
    </button>
  )
}

// ══════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════

type Matrix = Record<string, number>   // "shiftId_day" → coefficient

export default function ShiftCoefficientPage() {
  const [shifts,   setShifts]   = useState<ShiftRow[]>([])
  const [matrix,   setMatrix]   = useState<Matrix>({})
  const [disabled, setDisabled] = useState<Set<string>>(new Set())
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState<{ msg: string; type: 'success' | 'error' | 'warn' } | null>(null)
  const [confirm,  setConfirm]  = useState(false)
  const [overCount, setOverCount] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await salaryApi.getShiftMatrix()
      setShifts(rows)

      const m: Matrix = {}
      const dis = new Set<string>()
      for (const s of rows) {
        for (let d = 1; d <= 7; d++) {
          const k = mk(s.id, d)
          if (s.days[d] === null) {
            dis.add(k)
          } else {
            m[k] = s.days[d] as number
          }
        }
      }
      setMatrix(m)
      setDisabled(dis)
    } catch {
      setToast({ msg: 'Không thể tải danh sách ca làm việc', type: 'error' })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Cell edit ──────────────────────────────────────────────

  const updateCell = (shiftId: number, day: number, raw: string) => {
    const val = parseFloat(raw)
    if (isNaN(val)) return
    setMatrix(m => ({ ...m, [mk(shiftId, day)]: val }))
  }

  // ── Quick apply ───────────────────────────────────────────

  const applyQuick = (
    filter: (shiftId: number, day: number, type: string) => boolean,
    value: number,
  ) => {
    setMatrix(prev => {
      const next = { ...prev }
      for (const s of shifts) {
        for (let d = 1; d <= 7; d++) {
          const k = mk(s.id, d)
          if (!disabled.has(k) && filter(s.id, d, s.type)) {
            next[k] = value
          }
        }
      }
      return next
    })
  }

  const quickButtons = [
    { label: 'Cuối tuần = 1.3',     fn: () => applyQuick((_, d) => WEEKEND_DAYS.includes(d), 1.3) },
    { label: 'Cuối tuần = 1.5',     fn: () => applyQuick((_, d) => WEEKEND_DAYS.includes(d), 1.5) },
    { label: 'Ca ngoài giờ = 1.2',  fn: () => applyQuick((_, __, t) => t === 'OVERTIME', 1.2) },
    { label: 'Ca ngoài giờ = 1.4',  fn: () => applyQuick((_, __, t) => t === 'OVERTIME', 1.4) },
  ]

  // ── Save ──────────────────────────────────────────────────

  const doSave = async () => {
    setSaving(true)
    setConfirm(false)
    try {
      const items = Object.entries(matrix)
        .filter(([k]) => !disabled.has(k))
        .map(([k, coefficient]) => {
          const [shiftId, dayOfWeek] = k.split('_').map(Number)
          return { shiftId, dayOfWeek, coefficient }
        })

      await salaryApi.saveShiftMatrix(items)
      setToast({ msg: `Đã lưu ma trận hệ số (${items.length} ô)`, type: 'success' })
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.message ?? 'Lỗi lưu ma trận', type: 'error' })
    } finally { setSaving(false) }
  }

  const handleSave = () => {
    // Validate ≥ 1.0
    const belowOne = Object.entries(matrix).filter(([k, v]) => !disabled.has(k) && v < 1.0)
    if (belowOne.length > 0) {
      setToast({ msg: 'Hệ số ca làm việc phải lớn hơn hoặc bằng 1.0', type: 'error' })
      return
    }
    // Warn if > 1.5
    const over = Object.entries(matrix).filter(([k, v]) => !disabled.has(k) && v > 1.5)
    if (over.length > 0) {
      setOverCount(over.length)
      setConfirm(true)
      return
    }
    doSave()
  }

  // ── Render ────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#9ca3af', fontSize: 14 }}>
        Đang tải ma trận hệ số…
      </div>
    )
  }

  return (
    <div>
      {toast    && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {confirm  && <ConfirmDialog count={overCount} onConfirm={doSave} onCancel={() => setConfirm(false)} />}

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: 0 }}>
            UC4.2 – Hệ số ca làm việc theo ngày trong tuần
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Ma trận hệ số cho từng ca làm việc × thứ trong tuần (≥ 1.0)
          </p>
        </div>
        <button
          onClick={handleSave} disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 8, border: 'none',
            background: saving ? '#6b7280' : '#111827', color: '#fff',
            fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <Save size={15} />
          {saving ? 'Đang lưu…' : 'Lưu hệ số'}
        </button>
      </div>

      {/* ── Color legend ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Chú thích màu:</span>
        {[
          { bg: '#dcfce7', border: '#86efac', text: '#15803d', label: '= 1.0 (hành chính)' },
          { bg: '#dbeafe', border: '#93c5fd', text: '#1d4ed8', label: '1.0 – 1.2' },
          { bg: '#fef9c3', border: '#fde047', text: '#854d0e', label: '1.2 – 1.5' },
          { bg: '#fed7aa', border: '#fb923c', text: '#c2410c', label: '> 1.5 (vượt KN)' },
        ].map(c => (
          <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: c.bg, border: `1.5px solid ${c.border}` }} />
            <span style={{ fontSize: 12, color: '#374151' }}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* ── Quick apply ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Zap size={13} color="#f59e0b" />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Áp dụng nhanh:</span>
        </div>
        {quickButtons.map(b => <QuickBtn key={b.label} label={b.label} onClick={b.fn} />)}
      </div>

      {/* ── Matrix table ── */}
      {shifts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', fontSize: 13, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
          Chưa có ca làm việc nào. Vui lòng tạo ca ở mục Quản lý Ca làm việc (UC06).
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', minWidth: 160 }}>
                  Ca làm việc
                </th>
                <th style={{ padding: '12px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', minWidth: 110 }}>
                  Giờ
                </th>
                <th style={{ padding: '12px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', minWidth: 95 }}>
                  Loại
                </th>
                {DAYS.map(d => (
                  <th key={d.key} style={{
                    padding: '12px 8px', textAlign: 'center',
                    fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                    color: d.key >= 6 ? '#ef4444' : '#6b7280',
                    minWidth: 80,
                  }}>
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shifts.map((s, si) => (
                <tr key={s.id} style={{ borderBottom: si < shifts.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                  {/* Name */}
                  <td style={{ padding: '14px 16px', fontSize: 14, fontWeight: 700, color: '#111827' }}>
                    {s.name}
                  </td>
                  {/* Time */}
                  <td style={{ padding: '14px 12px', fontSize: 13, color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
                    {s.startTime}–{s.endTime}
                  </td>
                  {/* Type badge */}
                  <td style={{ padding: '14px 12px' }}>
                    {s.type === 'OVERTIME' ? (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}>
                        Ngoài giờ
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac' }}>
                        Hành chính
                      </span>
                    )}
                  </td>
                  {/* Coefficient cells */}
                  {DAYS.map(d => {
                    const k = mk(s.id, d.key)
                    const isDisabled = disabled.has(k)
                    const val = matrix[k] ?? 1.0
                    const { bg, text, border } = isDisabled ? { bg: '#f9fafb', text: '#d1d5db', border: '#e5e7eb' } : cellColor(val)

                    return (
                      <td key={d.key} style={{ padding: '8px 6px', textAlign: 'center' }}>
                        {isDisabled ? (
                          <div style={{
                            height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: 8, background: bg, border: `1.5px solid ${border}`,
                            fontSize: 14, color: text, userSelect: 'none',
                          }}>–</div>
                        ) : (
                          <input
                            type="number"
                            value={val}
                            min={1}
                            step={0.1}
                            onChange={e => updateCell(s.id, d.key, e.target.value)}
                            style={{
                              width: '100%', height: 40, textAlign: 'center',
                              borderRadius: 8, border: `1.5px solid ${border}`,
                              background: bg, color: text,
                              fontSize: 14, fontWeight: 700,
                              outline: 'none', cursor: 'pointer',
                              boxSizing: 'border-box',
                              // Hide spinners
                              MozAppearance: 'textfield',
                            } as React.CSSProperties}
                            onFocus={e => { e.target.style.outline = `2px solid ${border}`; e.target.style.outlineOffset = '1px' }}
                            onBlur={e => { e.target.style.outline = 'none' }}
                          />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Footer note ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        marginTop: 16, fontSize: 12, color: '#6b7280',
      }}>
        <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Danh sách ca làm việc được đồng bộ từ cấu hình ca ở Nhóm 2 (UC06).
          Để thêm ca mới, vui lòng truy cập mục <strong>Quản lý ca làm việc</strong>.
        </span>
      </div>

      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
    </div>
  )
}
