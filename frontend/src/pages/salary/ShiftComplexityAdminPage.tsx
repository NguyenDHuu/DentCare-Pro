import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ChevronDown, ChevronRight, Save, CheckCircle2, AlertCircle, Info
} from 'lucide-react'
import {
  salaryApi,
  type ComplexityMatrix,
  type ComplexitySchedule,
  type ComplexityCase,
  type DoctorFilter,
} from '../../api/salary.api'

// ─── Constants ────────────────────────────────────────────────

const STATUS_META = {
  NORMAL:   { label: 'Thông thường', color: '#6b7280', bg: '#f3f4f6' },
  PENDING:  { label: 'Chờ duyệt',    color: '#d97706', bg: '#fffbeb' },
  APPROVED: { label: 'Đã duyệt',     color: '#16a34a', bg: '#f0fdf4' },
}

const DOW_VI = ['', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật']

// ─── Helpers ──────────────────────────────────────────────────

const fmtDate = (d: string) => {
  const dt  = new Date(d)
  const dow = DOW_VI[dt.getDay() === 0 ? 7 : dt.getDay()]
  return `${dow} ${d}`
}

// ─── Single case row ──────────────────────────────────────────

function CaseRow({
  c,
  onChange,
  onApprove,
  saving,
}: {
  c: ComplexityCase & { _coeff: number }
  onChange: (id: number, val: number) => void
  onApprove: (id: number) => void
  saving: boolean
}) {
  const sm = STATUS_META[c.complexStatus] ?? STATUS_META.NORMAL
  const isNormal = c.complexStatus === 'NORMAL' && c.proposedCoeff === 0

  return (
    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
      {/* Mã */}
      <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>
        {c.receptionCode}
      </td>
      {/* Bệnh nhân */}
      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#111827' }}>
        {c.patientName}
      </td>
      {/* Dịch vụ */}
      <td style={{ padding: '10px 14px', fontSize: 12, color: '#374151', maxWidth: 220 }}>
        {c.services || <span style={{ color: '#d1d5db' }}>—</span>}
      </td>
      {/* Hệ số đề xuất */}
      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
        {c.proposedCoeff > 0 ? (
          <span style={{ fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: '#fef9c3', color: '#854d0e' }}>
            {c.proposedCoeff.toFixed(1)}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: '#9ca3af' }}>0 (thường)</span>
        )}
      </td>
      {/* Lý do */}
      <td style={{ padding: '10px 14px', fontSize: 12, color: '#374151', maxWidth: 200 }}>
        {c.proposedReason
          ? <span title={c.proposedReason} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 190 }}>{c.proposedReason}</span>
          : <span style={{ color: '#d1d5db' }}>—</span>
        }
      </td>
      {/* Hệ số duyệt */}
      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
        <input
          type="number" min={0} max={0.5} step={0.1}
          value={c._coeff}
          onChange={e => onChange(c.receptionId, parseFloat(e.target.value) || 0)}
          style={{
            width: 68, padding: '5px 8px', borderRadius: 6, border: '1.5px solid #d1d5db',
            fontSize: 13, fontWeight: 700, textAlign: 'center', outline: 'none',
            borderColor: c._coeff > 0 ? '#f59e0b' : '#d1d5db',
            background: c._coeff > 0 ? '#fffbeb' : '#fff',
          }}
        />
      </td>
      {/* Trạng thái */}
      <td style={{ padding: '10px 14px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, color: sm.color, background: sm.bg }}>
          {sm.label}
        </span>
      </td>
      {/* Thao tác */}
      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
        {c.complexStatus === 'PENDING' && (
          <button
            disabled={saving}
            onClick={() => onApprove(c.receptionId)}
            style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            Duyệt
          </button>
        )}
      </td>
    </tr>
  )
}

// ─── Shift block ──────────────────────────────────────────────

function ShiftBlock({
  sched,
  onSaved,
}: {
  sched: ComplexitySchedule
  onSaved: () => void
}) {
  const [expanded, setExpanded] = useState(sched.pendingCount > 0 || sched.totalCoeff > 0)
  const [coeffs,   setCoeffs]   = useState<Record<number, number>>(
    Object.fromEntries(sched.cases.map(c => [c.receptionId, c.approvedCoeff ?? 0]))
  )
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  const handleChange = (id: number, val: number) => {
    setCoeffs(prev => ({ ...prev, [id]: val }))
    setErr('')
  }

  const handleApprove = async (receptionId: number) => {
    setSaving(true); setErr('')
    try {
      await salaryApi.saveComplexityCases([{ receptionId, approvedCoeff: coeffs[receptionId] ?? 0 }])
      onSaved()
    } catch (e: any) { setErr(e?.response?.data?.message || 'Lỗi lưu') }
    finally { setSaving(false) }
  }

  const handleSaveAll = async () => {
    const items = sched.cases.map(c => ({ receptionId: c.receptionId, approvedCoeff: coeffs[c.receptionId] ?? 0 }))
    const invalid = items.filter(i => i.approvedCoeff < 0 || i.approvedCoeff > 0.5)
    if (invalid.length > 0) { setErr('Hệ số phải trong khoảng 0 – 0.5'); return }
    setSaving(true); setErr('')
    try {
      await salaryApi.saveComplexityCases(items)
      onSaved()
    } catch (e: any) { setErr(e?.response?.data?.message || 'Lỗi lưu') }
    finally { setSaving(false) }
  }

  const localTotal = sched.cases.reduce((s, c) => s + (coeffs[c.receptionId] ?? 0), 0)
  const pendingCnt = sched.cases.filter(c => c.complexStatus === 'PENDING').length

  const casesWithCoeff = sched.cases.map(c => ({ ...c, _coeff: coeffs[c.receptionId] ?? 0 }))

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 14, overflow: 'hidden' }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', cursor: 'pointer',
          background: expanded ? '#f9fafb' : '#fff',
          borderBottom: expanded ? '1px solid #e5e7eb' : 'none',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {expanded
            ? <ChevronDown size={16} color="#6b7280" />
            : <ChevronRight size={16} color="#6b7280" />
          }
          <span style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>
            {sched.doctorName}
          </span>
          {sched.degree && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: '#dbeafe', color: '#1d4ed8' }}>
              {sched.degree}
            </span>
          )}
          <span style={{ fontSize: 13, color: '#6b7280' }}>•</span>
          <span style={{ fontSize: 13, color: '#374151' }}>
            {sched.shiftName} – {fmtDate(sched.workDate)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {pendingCnt > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: '#fffbeb', color: '#d97706' }}>
              {pendingCnt} chờ duyệt
            </span>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>Tổng hệ số bệnh nhân</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: localTotal > 0 ? '#d97706' : '#9ca3af' }}>
              {localTotal.toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      {expanded && (
        <>
          {sched.cases.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
              Không có ca bệnh nhân nào trong ca trực này
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Mã tiếp đón', 'Bệnh nhân', 'Dịch vụ thực hiện', 'Hệ số đề xuất', 'Lý do', 'Hệ số duyệt', 'Trạng thái', 'Thao tác'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {casesWithCoeff.map(c => (
                  <CaseRow
                    key={c.receptionId}
                    c={c}
                    onChange={handleChange}
                    onApprove={handleApprove}
                    saving={saving}
                  />
                ))}
              </tbody>
            </table>
          )}

          {/* Footer */}
          {sched.cases.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: '#f9fafb', borderTop: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
                Tổng hệ số bệnh nhân ca này:{' '}
                <span style={{ color: localTotal > 0 ? '#d97706' : '#374151' }}>
                  {localTotal.toFixed(1)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {err && <span style={{ fontSize: 12, color: '#dc2626' }}>{err}</span>}
                <button
                  disabled={saving}
                  onClick={handleSaveAll}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  <Save size={14} /> Lưu tất cả ca này
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// Admin Page
// ══════════════════════════════════════════════════════════════

export default function ShiftComplexityAdminPage() {
  const defaultMonth = new Date().toISOString().slice(0, 7)
  const [month,      setMonth]      = useState(defaultMonth)
  const [doctorId,   setDoctorId]   = useState<number | undefined>(undefined)
  const [doctors,    setDoctors]    = useState<DoctorFilter[]>([])
  const [data,       setData]       = useState<ComplexityMatrix | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [rev,        setRev]        = useState(0)   // bump to reload

  useEffect(() => {
    salaryApi.getDoctorsForFilter().then(setDoctors).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await salaryApi.getComplexityMatrix(month, doctorId)) }
    catch { setData(null) }
    finally { setLoading(false) }
  }, [month, doctorId, rev])

  useEffect(() => { load() }, [load])

  const kpi = data?.kpi
  const schedules = data?.schedules ?? []

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: 0 }}>
          UC4.3 – Hệ số ca phức tạp trong tháng
        </h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          Xét duyệt hệ số mức độ khó cho các ca bệnh nhân phức tạp (0 – 0.5)
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 22, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>🔽 Lọc:</span>
          <input
            type="month" value={month} onChange={e => setMonth(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, fontWeight: 600, outline: 'none' }}
          />
        </div>
        <div style={{ position: 'relative' }}>
          <select
            value={doctorId ?? ''}
            onChange={e => setDoctorId(e.target.value ? Number(e.target.value) : undefined)}
            style={{ padding: '8px 36px 8px 12px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, fontWeight: 600, color: '#111827', background: '#fff', outline: 'none', appearance: 'none' }}>
            <option value="">Tất cả bác sĩ</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>{d.fullName}{d.degree ? ` (${d.degree})` : ''}</option>
            ))}
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280' }} />
        </div>
      </div>

      {/* KPI cards */}
      {kpi && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 22 }}>
          {[
            { label: 'Ca trực trong tháng', value: kpi.schedTotal,  color: '#111827' },
            { label: 'Ca có hệ số phức tạp', value: kpi.complexTotal, color: '#d97706' },
            { label: 'Ca chờ duyệt',          value: kpi.pendingTotal, color: '#2563eb' },
          ].map(k => (
            <div key={k.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '18px 24px' }}>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 8px', fontWeight: 500 }}>{k.label}</p>
              <p style={{ fontSize: 28, fontWeight: 900, color: k.color, margin: 0 }}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af' }}>Đang tải…</div>
      ) : schedules.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af', fontSize: 14 }}>
          Không có ca trực nào trong tháng {month}
        </div>
      ) : (
        <>
          {schedules.map(s => (
            <ShiftBlock key={s.schedId} sched={s} onSaved={() => setRev(r => r + 1)} />
          ))}
        </>
      )}

      {/* Rule note */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16, fontSize: 12, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px' }}>
        <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          <strong>Quy tắc:</strong> Ca bệnh nhân thông thường có hệ số = 0 (không cần nhập).
          Ca phức tạp có hệ số 0.1 – 0.5 và phải có lý do. Hệ số đã chốt lương không được thay đổi.
        </span>
      </div>
    </div>
  )
}
