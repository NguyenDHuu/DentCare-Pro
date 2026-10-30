import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, Lock, Send, Info, CheckCircle2, AlertCircle } from 'lucide-react'
import { salaryApi, type ComplexityMatrix, type ComplexitySchedule, type ComplexityCase } from '../../api/salary.api'

// ─── Constants ────────────────────────────────────────────────

const STATUS_META = {
  NORMAL:   { label: 'Thông thường', color: '#6b7280', bg: '#f3f4f6' },
  PENDING:  { label: 'Chờ duyệt',    color: '#d97706', bg: '#fffbeb' },
  APPROVED: { label: 'Đã duyệt',     color: '#16a34a', bg: '#f0fdf4' },
}

const DOW_VI = ['', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật']

const fmtDate = (d: string) => {
  if (!d) return ''
  const dt  = new Date(d + 'T00:00:00')
  const dow = DOW_VI[dt.getDay() === 0 ? 7 : dt.getDay()]
  return `${dow} ${d}`
}

const fmtCurrency = (n: number) => n.toLocaleString('vi-VN') + ' đ'

// ─── Modal propose ────────────────────────────────────────────

function ProposeModal({
  c,
  onClose,
  onSaved,
}: {
  c: ComplexityCase
  onClose: () => void
  onSaved: () => void
}) {
  const [coeff,  setCoeff]  = useState(c.proposedCoeff > 0 ? c.proposedCoeff : 0)
  const [reason, setReason] = useState(c.proposedReason ?? '')
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  const handleSubmit = async () => {
    if (coeff < 0 || coeff > 0.5) { setErr('Hệ số phải trong khoảng 0.0 – 0.5 (E1)'); return }
    if (coeff > 0 && !reason.trim()) { setErr('Vui lòng nhập lý do đề xuất khi hệ số > 0 (E3)'); return }
    setSaving(true); setErr('')
    try {
      await salaryApi.proposeComplexity({ receptionId: c.receptionId, proposedCoeff: coeff, proposedReason: reason.trim() || undefined })
      onSaved()
      onClose()
    } catch (e: any) { setErr(e?.response?.data?.message || 'Lỗi gửi đề xuất') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 900, color: '#111827' }}>Đề xuất hệ số ca phức tạp</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280' }}>
          Ca: <strong>{c.receptionCode}</strong> – {c.patientName}
        </p>

        {c.services && (
          <div style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: 8, marginBottom: 18, fontSize: 12, color: '#374151' }}>
            <strong>Dịch vụ:</strong> {c.services}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            Hệ số mức độ khó (0.0 – 0.5)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="range" min={0} max={0.5} step={0.1}
              value={coeff}
              onChange={e => { setCoeff(parseFloat(e.target.value)); setErr('') }}
              style={{ flex: 1 }}
            />
            <span style={{ minWidth: 48, textAlign: 'center', fontSize: 20, fontWeight: 900, color: coeff > 0 ? '#d97706' : '#9ca3af', padding: '5px 10px', background: coeff > 0 ? '#fffbeb' : '#f9fafb', borderRadius: 8 }}>
              {coeff.toFixed(1)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 4, paddingRight: 60 }}>
            {[0, 0.1, 0.2, 0.3, 0.4, 0.5].map(v => (
              <span key={v} style={{ cursor: 'pointer', fontWeight: coeff === v ? 700 : 400, color: coeff === v ? '#d97706' : '#9ca3af' }}
                onClick={() => { setCoeff(v); setErr('') }}>
                {v.toFixed(1)}
              </span>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            Lý do đề xuất {coeff > 0 && <span style={{ color: '#dc2626' }}>*</span>}
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={e => { setReason(e.target.value); setErr('') }}
            placeholder={coeff > 0 ? 'Mô tả mức độ phức tạp của ca bệnh nhân...' : 'Không cần lý do khi hệ số = 0'}
            disabled={coeff === 0}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box', background: coeff === 0 ? '#f9fafb' : '#fff', color: coeff === 0 ? '#9ca3af' : '#111827' }}
          />
        </div>

        {err && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, marginBottom: 16 }}>
            <AlertCircle size={14} color="#dc2626" />
            <span style={{ fontSize: 13, color: '#dc2626' }}>{err}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '9px 20px', borderRadius: 8, border: '1.5px solid #d1d5db', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
            Hủy
          </button>
          <button
            disabled={saving}
            onClick={handleSubmit}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#2563eb', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            <Send size={14} /> {saving ? 'Đang gửi…' : 'Gửi đề xuất'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Case row for doctor ──────────────────────────────────────

function DoctorCaseRow({
  c,
  locked,
  onPropose,
}: {
  c: ComplexityCase
  locked: boolean
  onPropose: (c: ComplexityCase) => void
}) {
  const sm = STATUS_META[c.complexStatus] ?? STATUS_META.NORMAL
  const canPropose = !locked && c.complexStatus !== 'APPROVED'
  const displayCoeff = c.complexStatus === 'APPROVED'
    ? c.approvedCoeff ?? 0
    : c.proposedCoeff

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
      <td style={{ padding: '10px 14px', fontSize: 12, color: '#374151', maxWidth: 200 }}>
        {c.services || <span style={{ color: '#d1d5db' }}>—</span>}
      </td>
      {/* Hệ số */}
      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
        {displayCoeff > 0 ? (
          <span style={{ fontSize: 14, fontWeight: 900, padding: '4px 12px', borderRadius: 8, background: c.complexStatus === 'APPROVED' ? '#f0fdf4' : '#fffbeb', color: c.complexStatus === 'APPROVED' ? '#16a34a' : '#d97706' }}>
            {displayCoeff.toFixed(1)}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: '#9ca3af' }}>0</span>
        )}
      </td>
      {/* Lý do */}
      <td style={{ padding: '10px 14px', fontSize: 12, color: '#374151', maxWidth: 200 }}>
        {c.proposedReason
          ? <span title={c.proposedReason} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 190 }}>{c.proposedReason}</span>
          : <span style={{ color: '#d1d5db' }}>—</span>
        }
      </td>
      {/* Trạng thái */}
      <td style={{ padding: '10px 14px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, color: sm.color, background: sm.bg }}>
          {sm.label}
        </span>
      </td>
      {/* Thao tác */}
      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
        {locked ? (
          <span title="Phiếu lương đã chốt" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#9ca3af' }}>
            <Lock size={12} /> Đã khoá
          </span>
        ) : c.complexStatus === 'APPROVED' ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#16a34a' }}>
            <CheckCircle2 size={13} /> Đã duyệt
          </span>
        ) : (
          <button
            onClick={() => onPropose(c)}
            style={{ padding: '5px 14px', borderRadius: 6, border: '1.5px solid #2563eb', background: '#eff6ff', color: '#2563eb', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {c.complexStatus === 'PENDING' ? 'Sửa đề xuất' : '+ Đề xuất'}
          </button>
        )}
      </td>
    </tr>
  )
}

// ─── Shift block doctor ───────────────────────────────────────

function DoctorShiftBlock({
  sched,
  locked,
  onRefresh,
}: {
  sched: ComplexitySchedule
  locked: boolean
  onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [modal,    setModal]    = useState<ComplexityCase | null>(null)

  const approvedTotal  = sched.cases.reduce((s, c) => s + (c.complexStatus === 'APPROVED' ? (c.approvedCoeff ?? 0) : 0), 0)
  const proposedTotal  = sched.cases.reduce((s, c) => s + (c.complexStatus === 'PENDING'  ? c.proposedCoeff : 0), 0)
  const pendingCount   = sched.cases.filter(c => c.complexStatus === 'PENDING').length
  const approvedCount  = sched.cases.filter(c => c.complexStatus === 'APPROVED').length

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 14, overflow: 'hidden' }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', cursor: 'pointer', background: expanded ? '#f9fafb' : '#fff', borderBottom: expanded ? '1px solid #e5e7eb' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {expanded ? <ChevronDown size={16} color="#6b7280" /> : <ChevronRight size={16} color="#6b7280" />}
          <span style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>
            {sched.shiftName}
          </span>
          <span style={{ fontSize: 13, color: '#6b7280' }}>–</span>
          <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{fmtDate(sched.workDate)}</span>
          {locked && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#f3f4f6', color: '#6b7280' }}>
              <Lock size={10} /> Đã khoá
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {pendingCount > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: '#fffbeb', color: '#d97706' }}>
              {pendingCount} chờ duyệt
            </span>
          )}
          {approvedCount > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: '#f0fdf4', color: '#16a34a' }}>
              {approvedCount} đã duyệt
            </span>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>Hệ số được duyệt</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: approvedTotal > 0 ? '#16a34a' : '#9ca3af' }}>
              {approvedTotal.toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      {expanded && (
        <>
          {sched.cases.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Không có ca bệnh nhân nào trong ca trực này</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Mã tiếp đón', 'Bệnh nhân', 'Dịch vụ thực hiện', 'Hệ số', 'Lý do đề xuất', 'Trạng thái', 'Thao tác'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sched.cases.map(c => (
                  <DoctorCaseRow
                    key={c.receptionId}
                    c={c}
                    locked={locked}
                    onPropose={setModal}
                  />
                ))}
              </tbody>
            </table>
          )}

          {/* Footer summary */}
          {sched.cases.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '10px 20px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', gap: 16 }}>
              <div style={{ fontSize: 12, color: '#374151' }}>
                <span style={{ fontWeight: 700 }}>Tổng ca: </span>{sched.cases.length}
              </div>
              <div style={{ fontSize: 12, color: '#d97706' }}>
                <span style={{ fontWeight: 700 }}>Đề xuất (chờ duyệt): </span>{proposedTotal.toFixed(1)}
              </div>
              <div style={{ fontSize: 12, color: '#16a34a' }}>
                <span style={{ fontWeight: 700 }}>Đã được duyệt: </span>{approvedTotal.toFixed(1)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {modal && (
        <ProposeModal
          c={modal}
          onClose={() => setModal(null)}
          onSaved={onRefresh}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// Doctor Page
// ══════════════════════════════════════════════════════════════

export default function DoctorComplexityPage() {
  const defaultMonth = new Date().toISOString().slice(0, 7)
  const [month,   setMonth]   = useState(defaultMonth)
  const [data,    setData]    = useState<ComplexityMatrix | null>(null)
  const [loading, setLoading] = useState(true)
  const [rev,     setRev]     = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await salaryApi.getDoctorComplexityCases(month)) }
    catch  { setData(null) }
    finally { setLoading(false) }
  }, [month, rev])

  useEffect(() => { load() }, [load])

  const locked    = data?.isLocked ?? false
  const schedules = data?.schedules ?? []

  // Summary across all shifts
  const totalShifts    = schedules.length
  const totalCases     = schedules.reduce((s, sh) => s + sh.cases.length, 0)
  const pendingCount   = schedules.reduce((s, sh) => s + sh.pendingCount, 0)
  const approvedCount  = schedules.reduce((s, sh) => s + sh.approvedCount, 0)
  const approvedTotal  = schedules.reduce((s, sh) => s + sh.cases.filter(c => c.complexStatus === 'APPROVED').reduce((a, c) => a + (c.approvedCoeff ?? 0), 0), 0)

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: 0 }}>
          Hệ số ca phức tạp của tôi
        </h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          Đề xuất hệ số mức độ khó cho ca bệnh nhân phức tạp trong ca trực (0.0 – 0.5)
        </p>
      </div>

      {/* Month filter */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 22, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>🔽 Tháng:</span>
        <input
          type="month" value={month} onChange={e => setMonth(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, fontWeight: 600, outline: 'none' }}
        />
        {locked && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 8, background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' }}>
            <Lock size={13} /> Phiếu lương đã chốt – không thể thay đổi hệ số
          </span>
        )}
      </div>

      {/* KPI cards */}
      {!loading && data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
          {[
            { label: 'Ca trực của tôi',      value: totalShifts,   color: '#111827' },
            { label: 'Tổng ca bệnh nhân',     value: totalCases,    color: '#374151' },
            { label: 'Chờ duyệt',             value: pendingCount,  color: '#d97706' },
            { label: 'Đã được duyệt',         value: approvedCount, color: '#16a34a' },
          ].map(k => (
            <div key={k.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px 20px' }}>
              <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 6px', fontWeight: 500 }}>{k.label}</p>
              <p style={{ fontSize: 26, fontWeight: 900, color: k.color, margin: 0 }}>{k.value}</p>
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
            <DoctorShiftBlock
              key={s.schedId}
              sched={s}
              locked={locked}
              onRefresh={() => setRev(r => r + 1)}
            />
          ))}

          {/* Summary bar */}
          {approvedTotal > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, marginTop: 8 }}>
              <CheckCircle2 size={16} color="#16a34a" />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#15803d' }}>
                Tổng hệ số đã được duyệt trong tháng {month}: {approvedTotal.toFixed(1)}
              </span>
              <span style={{ fontSize: 12, color: '#16a34a' }}>
                (ảnh hưởng trực tiếp đến lương tháng này)
              </span>
            </div>
          )}
        </>
      )}

      {/* Rule note */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16, fontSize: 12, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px' }}>
        <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          <strong>Hướng dẫn:</strong> Đề xuất hệ số từ 0.1 đến 0.5 cho ca bệnh nhân phức tạp và nhập lý do.
          Hệ số = 0 có nghĩa là ca thông thường, không cần lý do.
          Sau khi admin duyệt, hệ số không thể thay đổi. Hệ số đã duyệt sẽ được cộng vào lương tháng khi chốt phiếu.
        </span>
      </div>
    </div>
  )
}
