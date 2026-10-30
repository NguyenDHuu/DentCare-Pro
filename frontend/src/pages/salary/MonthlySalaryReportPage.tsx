import { useState, useEffect, useCallback, useMemo } from 'react'
import { Download, FileText, Search, ChevronDown, Eye, AlertTriangle } from 'lucide-react'
import { salaryApi, type MonthlyReport, type PayslipRow } from '../../api/salary.api'

// ─── Constants ────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; color: string; bg: string; chartColor: string }> = {
  DOCTOR:       { label: 'Bác sĩ',  color: '#2563eb', bg: '#eff6ff', chartColor: '#6366f1' },
  RECEPTIONIST: { label: 'Lễ tân',  color: '#0d9488', bg: '#f0fdfa', chartColor: '#14b8a6' },
  ACCOUNTANT:   { label: 'Kế toán', color: '#7c3aed', bg: '#f5f3ff', chartColor: '#8b5cf6' },
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:     { label: 'Nháp',      color: '#d97706', bg: '#fffbeb' },
  APPROVED:  { label: 'Đã duyệt',  color: '#2563eb', bg: '#eff6ff' },
  FINALIZED: { label: 'Đã chốt',   color: '#16a34a', bg: '#f0fdf4' },
}

// ─── Helpers ──────────────────────────────────────────────────

const fmtMoney  = (n: number) => n.toLocaleString('vi-VN') + 'đ'
const fmtMillions = (n: number) => {
  if (n === 0) return '0'
  return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'tr'
}

// ─── Sub-components ───────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const m = ROLE_META[role]
  if (!m) return null
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, color: m.color, background: m.bg }}>
      {m.label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.DRAFT
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, color: m.color, background: m.bg }}>
      {m.label}
    </span>
  )
}

// ─── Detail modal ─────────────────────────────────────────────

function PayslipModal({ row, onClose }: { row: PayslipRow; onClose: () => void }) {
  const rm = ROLE_META[row.role]
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '28px 32px', maxWidth: 480, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#111827', margin: 0 }}>{row.fullName}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <RoleBadge role={row.role} />
              <StatusBadge status={row.status} />
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 }}>✕</button>
        </div>

        <div style={{ background: '#f9fafb', borderRadius: 10, padding: '16px 20px', marginBottom: 16 }}>
          {row.sessionCount !== null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>Ca trực / Giờ quy đổi</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{row.sessionCount} ca / {row.hoursWorked}h</span>
            </div>
          )}
          {[
            { label: row.role === 'DOCTOR' ? 'Lương theo ca' : 'Lương cố định', value: fmtMoney(row.salaryAmount), color: '#111827' },
            { label: 'Phụ cấp',  value: `+${fmtMoney(row.allowance)}`,  color: row.allowance > 0 ? '#16a34a' : '#9ca3af' },
            { label: 'Khấu trừ', value: `-${fmtMoney(row.deduction)}`,  color: row.deduction > 0 ? '#dc2626' : '#9ca3af' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: '#6b7280' }}>{item.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: item.color }}>{item.value}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Thực nhận</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: rm?.color ?? '#111827' }}>{fmtMoney(row.netSalary)}</span>
          </div>
        </div>

        <button onClick={onClose}
          style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1.5px solid #d1d5db', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
          Đóng
        </button>
      </div>
    </div>
  )
}

// ─── Horizontal bar chart (custom SVG) ───────────────────────

function RoleBarChart({ data }: { data: { name: string; amount: number; color: string }[] }) {
  const max    = Math.max(...data.map(d => d.amount), 1)
  const BAR_H  = 36
  const GAP    = 18
  const LABEL_W = 70  // px left label area
  const AMOUNT_W = 90 // px right amount label

  // Tick values: 0, max/4, max/2, 3*max/4, max (rounded to nearest million)
  const step   = Math.ceil(max / 4 / 1_000_000) * 1_000_000 || 1_000_000
  const ticks  = [0, step, step * 2, step * 3, step * 4].filter(t => t <= max * 1.1)
  if (!ticks.includes(0)) ticks.unshift(0)

  return (
    <div style={{ padding: '8px 0' }}>
      {data.map((d, i) => {
        const pct = max > 0 ? (d.amount / max) * 100 : 0
        return (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: i < data.length - 1 ? GAP : 0 }}>
            {/* Y-axis label */}
            <div style={{ width: LABEL_W, flexShrink: 0, textAlign: 'right', paddingRight: 12, fontSize: 13, fontWeight: 600, color: '#374151' }}>
              {d.name}
            </div>
            {/* Bar track */}
            <div style={{ flex: 1, height: BAR_H, background: '#f3f4f6', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
              <div style={{
                width: `${pct}%`, height: '100%',
                background: d.color, borderRadius: 6,
                transition: 'width 0.6s ease',
                minWidth: d.amount > 0 ? 8 : 0,
              }} />
            </div>
            {/* Amount label */}
            <div style={{ width: AMOUNT_W, flexShrink: 0, paddingLeft: 12, fontSize: 13, fontWeight: 700, color: '#111827' }}>
              {fmtMillions(d.amount)}
            </div>
          </div>
        )
      })}
      {/* X-axis ticks */}
      <div style={{ display: 'flex', marginLeft: LABEL_W, marginRight: AMOUNT_W, marginTop: 8 }}>
        {ticks.map(t => (
          <div key={t} style={{
            flex: t === 0 ? 0 : 1,
            fontSize: 11, color: '#9ca3af',
            textAlign: t === 0 ? 'left' : 'center',
            minWidth: t === 0 ? 0 : undefined,
          }}>
            {fmtMillions(t)}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Export helpers ───────────────────────────────────────────

function exportCSV(rows: PayslipRow[], month: string) {
  const BOM = '﻿'
  const headers = ['Nhân sự', 'Vai trò', 'Ca', 'Giờ QĐ', 'Lương ca/Cố định', 'Phụ cấp', 'Khấu trừ', 'Thực nhận', 'Trạng thái']
  const lines = rows.map(r => [
    r.fullName,
    ROLE_META[r.role]?.label ?? r.role,
    r.sessionCount ?? '',
    r.hoursWorked  ?? '',
    r.salaryAmount,
    r.allowance,
    r.deduction,
    r.netSalary,
    STATUS_META[r.status]?.label ?? r.status,
  ].join(','))
  const csv = BOM + [headers.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `luong_${month}.csv`; a.click()
  URL.revokeObjectURL(url)
}

function exportPDF() {
  window.print()
}

// ══════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════

export default function MonthlySalaryReportPage() {
  const [month,     setMonth]     = useState(() => new Date().toISOString().slice(0, 7))
  const [roleFilter,setRoleFilter]= useState('ALL')
  const [search,    setSearch]    = useState('')
  const [report,    setReport]    = useState<MonthlyReport | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [detail,    setDetail]    = useState<PayslipRow | null>(null)

  const load = useCallback(async (m: string) => {
    setLoading(true)
    try { setReport(await salaryApi.getMonthlySalaryReport(m)) }
    catch { setReport(null) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(month) }, [load, month])

  // ── Filtered rows (client-side) ───────────────────────────
  const filteredRows = useMemo(() => {
    if (!report) return []
    return report.rows.filter(r => {
      if (roleFilter !== 'ALL' && r.role !== roleFilter) return false
      if (search.trim() && !r.fullName.toLowerCase().includes(search.trim().toLowerCase())) return false
      return true
    })
  }, [report, roleFilter, search])

  // ── Summary for filtered rows ─────────────────────────────
  const filteredTotal = useMemo(() => filteredRows.reduce((s, r) => s + r.netSalary, 0), [filteredRows])

  // ── Chart data ────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!report) return []
    return [
      { name: 'Bác sĩ',  amount: report.byRole.DOCTOR.total,       color: ROLE_META.DOCTOR.chartColor },
      { name: 'Lễ tân',  amount: report.byRole.RECEPTIONIST.total,  color: ROLE_META.RECEPTIONIST.chartColor },
      { name: 'Kế toán', amount: report.byRole.ACCOUNTANT.total,    color: ROLE_META.ACCOUNTANT.chartColor },
    ]
  }, [report])

  // ── KPI cards data ────────────────────────────────────────
  const kpiCards = useMemo(() => {
    if (!report) return []
    return [
      { label: 'Tổng quỹ lương tháng', value: report.totalFund, sub: null, color: '#111827', border: '#e5e7eb' },
      {
        label: `Bác sĩ (${report.byRole.DOCTOR.count} người)`,
        value: report.byRole.DOCTOR.total,
        sub: report.totalFund ? `${((report.byRole.DOCTOR.total / report.totalFund) * 100).toFixed(1)}% quỹ lương` : null,
        color: '#2563eb', border: '#bfdbfe',
      },
      {
        label: `Lễ tân (${report.byRole.RECEPTIONIST.count} người)`,
        value: report.byRole.RECEPTIONIST.total,
        sub: report.totalFund ? `${((report.byRole.RECEPTIONIST.total / report.totalFund) * 100).toFixed(1)}% quỹ lương` : null,
        color: '#0d9488', border: '#99f6e4',
      },
      {
        label: `Kế toán (${report.byRole.ACCOUNTANT.count} người)`,
        value: report.byRole.ACCOUNTANT.total,
        sub: report.totalFund ? `${((report.byRole.ACCOUNTANT.total / report.totalFund) * 100).toFixed(1)}% quỹ lương` : null,
        color: '#7c3aed', border: '#ddd6fe',
      },
    ]
  }, [report])

  return (
    <div id="salary-report-print">
      {detail && <PayslipModal row={detail} onClose={() => setDetail(null)} />}

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }} className="no-print">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: 0 }}>
            UC4.5 – Báo cáo tiền lương (Toàn nhân sự)
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Tổng hợp quỹ lương tất cả nhân sự trong tháng
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => report && exportCSV(filteredRows, month)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: '1.5px solid #d1d5db', background: '#fff', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
            <Download size={14} /> Excel
          </button>
          <button
            onClick={exportPDF}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <FileText size={14} /> PDF
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 22, flexWrap: 'wrap' }} className="no-print">
        {/* Month picker */}
        <div style={{ position: 'relative' }}>
          <input
            type="month" value={month} onChange={e => setMonth(e.target.value)}
            style={{ padding: '9px 14px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, fontWeight: 600, color: '#111827', background: '#fff', cursor: 'pointer', outline: 'none' }}
          />
        </div>

        {/* Role filter */}
        <div style={{ position: 'relative' }}>
          <select
            value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
            style={{ padding: '9px 36px 9px 14px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, fontWeight: 600, color: '#111827', background: '#fff', cursor: 'pointer', outline: 'none', appearance: 'none' }}>
            <option value="ALL">Tất cả vai trò</option>
            <option value="DOCTOR">Bác sĩ</option>
            <option value="RECEPTIONIST">Lễ tân</option>
            <option value="ACCOUNTANT">Kế toán</option>
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280' }} />
        </div>

        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="text" placeholder="Tìm nhân sự…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, color: '#111827', background: '#fff', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af', fontSize: 14 }}>Đang tải báo cáo…</div>
      ) : (
        <>
          {/* ── KPI Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
            {kpiCards.map((k, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${k.border}`, padding: '18px 20px' }}>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 8px', fontWeight: 500 }}>{k.label}</p>
                <p style={{ fontSize: i === 0 ? 22 : 19, fontWeight: 800, color: k.color, margin: 0, lineHeight: 1.2 }}>
                  {fmtMoney(k.value)}
                </p>
                {k.sub && <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>{k.sub}</p>}
              </div>
            ))}
          </div>

          {/* ── Bar chart ── */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px 24px', marginBottom: 22 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', margin: '0 0 16px' }}>
              Phân bố quỹ lương theo vai trò
            </h3>
            {report && report.totalFund > 0
              ? <RoleBarChart data={chartData} />
              : <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13 }}>Không có dữ liệu</div>
            }
          </div>

          {/* ── Detail table ── */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  {[
                    { label: 'Nhân sự',            w: '20%' },
                    { label: 'Vai trò',             w: '9%'  },
                    { label: 'Ca / Giờ QĐ',        w: '10%' },
                    { label: 'Lương ca / Cố định', w: '14%' },
                    { label: 'Phụ cấp',            w: '10%' },
                    { label: 'Khấu trừ',           w: '10%' },
                    { label: 'Thực nhận',          w: '13%' },
                    { label: 'Trạng thái',         w: '10%' },
                    { label: '',                   w: '4%'  },
                  ].map(h => (
                    <th key={h.label} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', width: h.w }}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: '48px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                    Không có dữ liệu phiếu lương cho tháng này
                  </td></tr>
                ) : filteredRows.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '13px 14px', fontSize: 14, fontWeight: 700, color: '#111827' }}>{r.fullName}</td>
                    <td style={{ padding: '13px 14px' }}><RoleBadge role={r.role} /></td>
                    <td style={{ padding: '13px 14px', fontSize: 13, color: '#374151' }}>
                      {r.sessionCount !== null
                        ? <>{r.sessionCount} ca / {r.hoursWorked}h</>
                        : <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>
                    <td style={{ padding: '13px 14px', fontSize: 13, fontWeight: 600, color: '#111827' }}>
                      {fmtMoney(r.salaryAmount)}
                    </td>
                    <td style={{ padding: '13px 14px', fontSize: 13, fontWeight: 600, color: r.allowance > 0 ? '#16a34a' : '#9ca3af' }}>
                      {r.allowance > 0 ? `+${fmtMoney(r.allowance)}` : '+0đ'}
                    </td>
                    <td style={{ padding: '13px 14px', fontSize: 13, fontWeight: 600, color: r.deduction > 0 ? '#dc2626' : '#9ca3af' }}>
                      {r.deduction > 0 ? `-${fmtMoney(r.deduction)}` : '-0đ'}
                    </td>
                    <td style={{ padding: '13px 14px', fontSize: 14, fontWeight: 800, color: '#111827' }}>
                      {fmtMoney(r.netSalary)}
                    </td>
                    <td style={{ padding: '13px 14px' }}><StatusBadge status={r.status} /></td>
                    <td style={{ padding: '13px 8px', textAlign: 'center' }}>
                      <button onClick={() => setDetail(r)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4 }}
                        title="Xem chi tiết"
                        onMouseEnter={e => (e.currentTarget.style.color = '#374151')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}>
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {filteredRows.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                    <td colSpan={6} style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#374151' }}>
                      Tổng lương thực nhận ({filteredRows.length} nhân sự):
                    </td>
                    <td colSpan={3} style={{ padding: '12px 14px', fontSize: 15, fontWeight: 800, color: '#111827' }}>
                      {fmtMoney(filteredTotal)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* ── Footer note ── */}
          {report?.hasDraft && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px' }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              Một số phiếu lương vẫn đang ở trạng thái <strong>Nháp</strong> hoặc <strong>Đã duyệt</strong>. Số liệu chưa chính thức cho các phiếu này.
            </div>
          )}
        </>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  )
}
