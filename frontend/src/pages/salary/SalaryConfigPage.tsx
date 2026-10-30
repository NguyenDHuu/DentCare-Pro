import { useState, useEffect, useCallback } from 'react'
import {
  Plus, X, CheckCircle2, Clock, AlertTriangle, Info,
} from 'lucide-react'
import {
  salaryApi,
  type HourlyRate,
  type FixedSalary,
  type StaffOption,
  type Allowance,
  type CurrentRate,
} from '../../api/salary.api'

// ─── Helpers ─────────────────────────────────────────────────

function fmtMoney(n: number) { return n.toLocaleString('vi-VN') + 'đ' }
function fmtDate(s: string)  { return new Date(s).toLocaleDateString('vi-VN') }

const ROLE_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  RECEPTIONIST: { label: 'Lễ tân',  color: '#2563eb', bg: '#eff6ff' },
  ACCOUNTANT:   { label: 'Kế toán', color: '#7c3aed', bg: '#f5f3ff' },
}

const APPLIES_TO_OPTIONS = [
  { value: 'BOTH',         label: 'Lễ tân & Kế toán', color: '#0f766e', bg: '#f0fdfa' },
  { value: 'RECEPTIONIST', label: 'Lễ tân chỉ',        color: '#2563eb', bg: '#eff6ff' },
  { value: 'ACCOUNTANT',   label: 'Kế toán chỉ',       color: '#7c3aed', bg: '#f5f3ff' },
]

const APPLIES_TO_META: Record<string, { label: string; color: string; bg: string }> = {
  BOTH:         { label: 'Lễ tân & Kế toán', color: '#0f766e', bg: '#f0fdfa' },
  RECEPTIONIST: { label: 'Lễ tân',            color: '#2563eb', bg: '#eff6ff' },
  ACCOUNTANT:   { label: 'Kế toán',           color: '#7c3aed', bg: '#f5f3ff' },
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  ACTIVE:   { label: 'Đang áp dụng',    color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
  UPCOMING: { label: 'Sắp áp dụng',     color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
  EXPIRED:  { label: 'Đã hết hiệu lực', color: '#6b7280', bg: '#f9fafb', border: '#d1d5db' },
}

// ─── StatusBadge ──────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.EXPIRED
  return (
    <span style={{
      fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
      color: m.color, background: m.bg, border: `1px solid ${m.border}`,
    }}>
      {m.label}
    </span>
  )
}

// ─── Toast ────────────────────────────────────────────────────

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 16px', borderRadius: 10,
      background: type === 'success' ? '#f0fdf4' : '#fff1f2',
      border: `1px solid ${type === 'success' ? '#86efac' : '#fca5a5'}`,
      color: type === 'success' ? '#16a34a' : '#dc2626',
      fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
    }}>
      {type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
      {msg}
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'inherit' }}>
        <X size={13} />
      </button>
    </div>
  )
}

// ─── Shared form field styles ─────────────────────────────────
const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1.5px solid #d1d5db', fontSize: 13, boxSizing: 'border-box',
}

// ══════════════════════════════════════════════════════════════
// Tab A – Số tiền một giờ
// ══════════════════════════════════════════════════════════════

function HourlyRateTab({ onRateChange }: { onRateChange: () => void }) {
  const [rates,    setRates]    = useState<HourlyRate[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [toast,    setToast]    = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const [amount,    setAmount]    = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate,   setEndDate]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setRates(await salaryApi.getHourlyRates()) }
    catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSubmit = async () => {
    setError(null)
    if (!amount || !startDate) { setError('Vui lòng nhập đủ số tiền và ngày bắt đầu'); return }
    if (Number(amount) <= 0)   { setError('Số tiền một giờ phải lớn hơn 0'); return }
    setSaving(true)
    try {
      await salaryApi.createHourlyRate({ amount: Number(amount), startDate, ...(endDate ? { endDate } : {}) })
      setToast({ msg: 'Đã lưu mức tiền một giờ mới', type: 'success' })
      setShowForm(false); setAmount(''); setStartDate(''); setEndDate('')
      load(); onRateChange()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Lỗi lưu cấu hình')
    } finally { setSaving(false) }
  }

  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', margin: 0 }}>Danh sách mức tiền một giờ</h3>
        <button onClick={() => { setShowForm(f => !f); setError(null) }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={14} /> Thêm mức mới
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '20px 24px', marginBottom: 20 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', margin: '0 0 16px' }}>Thiết lập mức tiền một giờ mới</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Số tiền một giờ (đ) *</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="VD: 200000" style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Ngày bắt đầu *</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Ngày kết thúc (nếu có)</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={fieldStyle} />
            </div>
          </div>
          {error && <ErrorBar msg={error} />}
          <FormActions saving={saving} onSave={handleSubmit} onCancel={() => { setShowForm(false); setError(null) }} />
        </div>
      )}

      <RateTable
        loading={loading}
        empty={rates.length === 0}
        headers={['Số tiền một giờ', 'Ngày bắt đầu', 'Ngày kết thúc', 'Trạng thái', 'Ngày tạo']}
        rows={rates}
        renderRow={r => (
          <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 700, color: '#111827' }}>{fmtMoney(r.amount)}</td>
            <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#374151' }}>{fmtDate(r.startDate)}</td>
            <td style={{ padding: '12px 14px', fontSize: 13, color: r.endDate ? '#374151' : '#9ca3af' }}>{r.endDate ? fmtDate(r.endDate) : 'Không giới hạn'}</td>
            <td style={{ padding: '12px 14px' }}><StatusBadge status={r.status} /></td>
            <td style={{ padding: '12px 14px', fontSize: 13, color: '#6b7280' }}>{fmtDate(r.createdAt)}</td>
          </tr>
        )}
      />
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// Tab B – Lương cố định tháng (per user)
// ══════════════════════════════════════════════════════════════

function FixedSalaryTab() {
  const [salaries, setSalaries] = useState<FixedSalary[]>([])
  const [staff,    setStaff]    = useState<StaffOption[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [toast,    setToast]    = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const [userId,    setUserId]    = useState('')
  const [amount,    setAmount]    = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate,   setEndDate]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, st] = await Promise.all([salaryApi.getFixedSalaries(), salaryApi.getEligibleStaff()])
      setSalaries(s); setStaff(st)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSubmit = async () => {
    setError(null)
    if (!userId)            { setError('Vui lòng chọn nhân sự'); return }
    if (!amount)            { setError('Vui lòng nhập mức lương'); return }
    if (Number(amount) < 0) { setError('Mức lương phải ≥ 0'); return }
    if (!startDate)         { setError('Vui lòng nhập ngày bắt đầu'); return }
    setSaving(true)
    try {
      await salaryApi.createFixedSalary({ userId: Number(userId), amount: Number(amount), startDate, ...(endDate ? { endDate } : {}) })
      setToast({ msg: 'Đã lưu mức lương cố định', type: 'success' })
      setShowForm(false); setUserId(''); setAmount(''); setStartDate(''); setEndDate('')
      load()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Lỗi lưu cấu hình')
    } finally { setSaving(false) }
  }

  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', margin: 0 }}>Lương cố định theo tháng – Lễ tân &amp; Kế toán</h3>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>Cấu hình lương tháng riêng cho từng nhân viên</p>
        </div>
        <button onClick={() => { setShowForm(f => !f); setError(null) }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={14} /> Thêm cấu hình
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '20px 24px', marginBottom: 20 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', margin: '0 0 16px' }}>Thiết lập lương cố định theo tháng</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Nhân sự (Lễ tân / Kế toán) *</label>
              <select value={userId} onChange={e => setUserId(e.target.value)}
                style={{ ...fieldStyle, background: '#fff' }}>
                <option value="">-- Chọn nhân sự --</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({s.role === 'RECEPTIONIST' ? 'Lễ tân' : 'Kế toán'})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Mức lương cố định/tháng (đ) *</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="VD: 8000000" style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Ngày bắt đầu *</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Ngày kết thúc (nếu có)</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={fieldStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '9px 12px', marginBottom: 14, fontSize: 12, color: '#92400e' }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            Lưu ý: Lương cố định chỉ áp dụng cho Lễ tân và Kế toán. Lương bác sĩ được tính theo ca làm việc (UC4.4).
          </div>
          {error && <ErrorBar msg={error} />}
          <FormActions saving={saving} onSave={handleSubmit} onCancel={() => { setShowForm(false); setError(null) }} />
        </div>
      )}

      <RateTable
        loading={loading}
        empty={salaries.length === 0}
        headers={['Nhân sự', 'Vai trò', 'Lương cố định/tháng', 'Từ ngày', 'Đến ngày', 'Trạng thái']}
        rows={salaries}
        renderRow={s => {
          const rm = s.role ? ROLE_LABEL[s.role] : null
          return (
            <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 700, color: '#111827' }}>{s.fullName}</td>
              <td style={{ padding: '12px 14px' }}>
                {rm && <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99, color: rm.color, background: rm.bg }}>{rm.label}</span>}
              </td>
              <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 700, color: '#111827' }}>{fmtMoney(s.amount)}</td>
              <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#374151' }}>{fmtDate(s.startDate)}</td>
              <td style={{ padding: '12px 14px', fontSize: 13, color: s.endDate ? '#374151' : '#9ca3af' }}>{s.endDate ? fmtDate(s.endDate) : 'Không giới hạn'}</td>
              <td style={{ padding: '12px 14px' }}><StatusBadge status={s.status} /></td>
            </tr>
          )
        }}
      />
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// Tab C – Phụ cấp chung
// ══════════════════════════════════════════════════════════════

function AllowanceTab() {
  const [allowances, setAllowances] = useState<Allowance[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [toast,      setToast]      = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const [name,      setName]      = useState('')
  const [amount,    setAmount]    = useState('')
  const [appliesTo, setAppliesTo] = useState('BOTH')
  const [startDate, setStartDate] = useState('')
  const [endDate,   setEndDate]   = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { setAllowances(await salaryApi.getAllowances()) }
    catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSubmit = async () => {
    setError(null)
    if (!name.trim())        { setError('Vui lòng nhập tên phụ cấp'); return }
    if (!amount)             { setError('Vui lòng nhập số tiền phụ cấp'); return }
    if (Number(amount) < 0)  { setError('Số tiền phải ≥ 0'); return }
    if (!startDate)          { setError('Vui lòng nhập ngày bắt đầu'); return }
    setSaving(true)
    try {
      await salaryApi.createAllowance({ name, amount: Number(amount), appliesTo, startDate, ...(endDate ? { endDate } : {}) })
      setToast({ msg: `Đã thêm phụ cấp "${name}"`, type: 'success' })
      setShowForm(false); setName(''); setAmount(''); setAppliesTo('BOTH'); setStartDate(''); setEndDate('')
      load()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Lỗi lưu phụ cấp')
    } finally { setSaving(false) }
  }

  return (
    <>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', margin: 0 }}>Cấu hình phụ cấp chung</h3>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>Phụ cấp hàng tháng áp dụng chung cho Lễ tân và / hoặc Kế toán</p>
        </div>
        <button onClick={() => { setShowForm(f => !f); setError(null) }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={14} /> Thêm phụ cấp
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '20px 24px', marginBottom: 20 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', margin: '0 0 16px' }}>Thêm khoản phụ cấp mới</h4>

          {/* Applies-to selector */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Đối tượng áp dụng *</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {APPLIES_TO_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setAppliesTo(opt.value)}
                  style={{
                    padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: appliesTo === opt.value ? `2px solid ${opt.color}` : '2px solid #e5e7eb',
                    background: appliesTo === opt.value ? opt.bg : '#fff',
                    color: appliesTo === opt.value ? opt.color : '#6b7280',
                    transition: 'all 0.15s',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Tên phụ cấp *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="VD: Phụ cấp ăn trưa" style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Số tiền/tháng (đ) *</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="VD: 500000" style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Ngày bắt đầu *</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Ngày kết thúc (nếu có)</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={fieldStyle} />
            </div>
          </div>

          {error && <ErrorBar msg={error} />}
          <FormActions saving={saving} onSave={handleSubmit} onCancel={() => { setShowForm(false); setError(null) }} />
        </div>
      )}

      <RateTable
        loading={loading}
        empty={allowances.length === 0}
        headers={['Tên phụ cấp', 'Đối tượng', 'Số tiền/tháng', 'Từ ngày', 'Đến ngày', 'Trạng thái', 'Ngày tạo']}
        rows={allowances}
        renderRow={a => {
          const atm = APPLIES_TO_META[a.appliesTo] ?? { label: a.appliesTo, color: '#374151', bg: '#f3f4f6' }
          return (
            <tr key={a.id} style={{ borderBottom: '1px solid #f3f4f6' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 700, color: '#111827' }}>{a.name}</td>
              <td style={{ padding: '12px 14px' }}>
                <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99, color: atm.color, background: atm.bg }}>{atm.label}</span>
              </td>
              <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 700, color: '#111827' }}>{fmtMoney(a.amount)}</td>
              <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#374151' }}>{fmtDate(a.startDate)}</td>
              <td style={{ padding: '12px 14px', fontSize: 13, color: a.endDate ? '#374151' : '#9ca3af' }}>{a.endDate ? fmtDate(a.endDate) : 'Không giới hạn'}</td>
              <td style={{ padding: '12px 14px' }}><StatusBadge status={a.status} /></td>
              <td style={{ padding: '12px 14px', fontSize: 13, color: '#6b7280' }}>{fmtDate(a.createdAt)}</td>
            </tr>
          )
        }}
      />
    </>
  )
}

// ─── Shared sub-components ────────────────────────────────────

function ErrorBar({ msg }: { msg: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff1f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '9px 12px', marginBottom: 12, fontSize: 13, color: '#dc2626' }}>
      <AlertTriangle size={14} /> {msg}
    </div>
  )
}

function FormActions({ saving, onSave, onCancel }: { saving: boolean; onSave: () => void; onCancel: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <button onClick={onSave} disabled={saving}
        style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: saving ? '#6b7280' : '#111827', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
        {saving ? 'Đang lưu…' : 'Lưu cấu hình'}
      </button>
      <button onClick={onCancel}
        style={{ padding: '9px 20px', borderRadius: 8, border: '1.5px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer' }}>
        Hủy
      </button>
    </div>
  )
}

function RateTable<T>({ loading, empty, headers, rows, renderRow }: {
  loading: boolean; empty: boolean; headers: string[]; rows: T[]; renderRow: (r: T) => React.ReactNode
}) {
  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13 }}>Đang tải…</div>
  if (empty)   return <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13 }}>Chưa có cấu hình nào</div>
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          {headers.map(h => (
            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{rows.map(r => renderRow(r))}</tbody>
    </table>
  )
}

// ══════════════════════════════════════════════════════════════
// Main Page – UC4.1
// ══════════════════════════════════════════════════════════════

const TABS = [
  { key: 'hourly',    label: 'Số tiền một giờ' },
  { key: 'fixed',     label: 'Lương cố định tháng' },
  { key: 'allowance', label: 'Phụ cấp chung' },
] as const

type TabKey = typeof TABS[number]['key']

export default function SalaryConfigPage() {
  const [tab,         setTab]         = useState<TabKey>('hourly')
  const [currentRate, setCurrentRate] = useState<CurrentRate | null>(null)

  const refreshCurrentRate = useCallback(() => {
    salaryApi.getCurrentRate().then(r => setCurrentRate(r)).catch(() => {})
  }, [])

  useEffect(() => { refreshCurrentRate() }, [refreshCurrentRate])

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: 0 }}>
            UC4.1 – Thiết lập mức tiền cơ bản
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Cấu hình đơn giá giờ công, lương cố định hàng tháng và phụ cấp chung
          </p>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: '1.5px solid #d1d5db', background: '#fff', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
          <Clock size={14} /> Lịch sử cấu hình
        </button>
      </div>

      {/* Active rate banner */}
      {currentRate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 16px', marginBottom: 22, fontSize: 13 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
          <span style={{ color: '#1e40af' }}>
            Đơn giá hiện tại:{' '}
            <strong style={{ color: '#1d4ed8' }}>{fmtMoney(currentRate.amount)}/giờ</strong>
            {' '}
            <span style={{ color: '#60a5fa' }}>(áp dụng từ {fmtDate(currentRate.startDate)})</span>
          </span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 24, gap: 2 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? '#111827' : '#6b7280',
              borderBottom: tab === t.key ? '2px solid #111827' : '2px solid transparent',
              marginBottom: -1,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'hourly'    && <HourlyRateTab onRateChange={refreshCurrentRate} />}
      {tab === 'fixed'     && <FixedSalaryTab />}
      {tab === 'allowance' && <AllowanceTab />}
    </div>
  )
}
