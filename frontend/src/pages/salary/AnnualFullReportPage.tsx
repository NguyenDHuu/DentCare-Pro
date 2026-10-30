import { useState, useEffect, useCallback, useMemo } from 'react'
import { Download, FileText, ChevronDown } from 'lucide-react'
import {
  salaryApi,
  type AnnualFullReport,
  type AnnualEmployee,
} from '../../api/salary.api'

// ─── Constants ────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; color: string; bg: string; chart: string }> = {
  DOCTOR:       { label: 'Bác sĩ',  color: '#4f46e5', bg: '#eef2ff', chart: '#6366f1' },
  RECEPTIONIST: { label: 'Lễ tân',  color: '#0d9488', bg: '#f0fdfa', chart: '#14b8a6' },
  ACCOUNTANT:   { label: 'Kế toán', color: '#7c3aed', bg: '#f5f3ff', chart: '#8b5cf6' },
}

// ─── Helpers ──────────────────────────────────────────────────

const fmtMoney = (n: number) => n.toLocaleString('vi-VN') + 'đ'
const fmtM     = (n: number) => {
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

// ─── Stacked bar chart (12 months) ───────────────────────────

function MonthlyStackedChart({ data }: { data: AnnualFullReport['monthlyChart'] }) {
  const W = 560, H = 170
  const PAD = { t: 14, r: 12, b: 36, l: 52 }
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b

  const totals = data.map(d => d.DOCTOR + d.RECEPTIONIST + d.ACCOUNTANT)
  const max    = Math.max(...totals, 1)
  const barW   = (innerW / 12) * 0.60
  const step   = Math.ceil(max / 4 / 1_000_000) * 1_000_000 || 1_000_000
  const yTicks = [0, 1, 2, 3, 4].map(n => step * n).filter(t => t <= max * 1.15)

  const xOf = (i: number) => PAD.l + (innerW / 12) * i + (innerW / 12) / 2 - barW / 2
  const hOf  = (v: number) => innerH * (v / max)
  const yOf  = (v: number) => PAD.t + innerH * (1 - v / max)

  const ROLES: Array<{ key: 'DOCTOR' | 'RECEPTIONIST' | 'ACCOUNTANT'; color: string }> = [
    { key: 'ACCOUNTANT',   color: ROLE_META.ACCOUNTANT.chart },
    { key: 'RECEPTIONIST', color: ROLE_META.RECEPTIONIST.chart },
    { key: 'DOCTOR',       color: ROLE_META.DOCTOR.chart },
  ]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {/* Grid */}
      {yTicks.map(t => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={yOf(t)} y2={yOf(t)} stroke="#f0f0f0" strokeWidth={1} />
          <text x={PAD.l - 6} y={yOf(t) + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{fmtM(t)}</text>
        </g>
      ))}

      {/* Stacked bars */}
      {data.map((d, i) => {
        const bx = xOf(i)
        let currentY = PAD.t + innerH

        return (
          <g key={d.month}>
            {ROLES.map(({ key, color }) => {
              const v  = d[key]
              const bh = hOf(v)
              if (bh < 0.5) return null
              currentY -= bh
              return (
                <rect key={key} x={bx} y={currentY} width={barW} height={bh}
                  fill={color} rx={key === 'DOCTOR' ? 3 : 0}
                  style={{ transition: 'height 0.5s ease' }} />
              )
            })}
            <text x={bx + barW / 2} y={H - PAD.b + 14} textAnchor="middle" fontSize={9} fill="#6b7280">
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Donut chart ──────────────────────────────────────────────

function DonutChart({ report }: { report: AnnualFullReport }) {
  const total = report.totalFund || 1
  const slices = [
    { key: 'DOCTOR',       value: report.byRole.DOCTOR.total },
    { key: 'RECEPTIONIST', value: report.byRole.RECEPTIONIST.total },
    { key: 'ACCOUNTANT',   value: report.byRole.ACCOUNTANT.total },
  ].filter(s => s.value > 0)

  const CX = 80, CY = 80, R = 60, INNER = 36
  let cumAngle = -Math.PI / 2

  const paths = slices.map(s => {
    const angle     = (s.value / total) * Math.PI * 2
    const startA    = cumAngle
    const endA      = cumAngle + angle
    cumAngle        = endA
    const x1 = CX + R * Math.cos(startA)
    const y1 = CY + R * Math.sin(startA)
    const x2 = CX + R * Math.cos(endA)
    const y2 = CY + R * Math.sin(endA)
    const ix1 = CX + INNER * Math.cos(startA)
    const iy1 = CY + INNER * Math.sin(startA)
    const ix2 = CX + INNER * Math.cos(endA)
    const iy2 = CY + INNER * Math.sin(endA)
    const lg  = angle > Math.PI ? 1 : 0
    return { ...s, d: `M${ix1},${iy1} L${x1},${y1} A${R},${R},0,${lg},1,${x2},${y2} L${ix2},${iy2} A${INNER},${INNER},0,${lg},0,${ix1},${iy1}Z` }
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <svg width={160} height={160} viewBox="0 0 160 160">
        {paths.map(p => (
          <path key={p.key} d={p.d} fill={ROLE_META[p.key].chart} />
        ))}
        {slices.length === 0 && (
          <circle cx={CX} cy={CY} r={R} fill="#f3f4f6" />
        )}
      </svg>
      <div style={{ flex: 1 }}>
        {(['DOCTOR', 'RECEPTIONIST', 'ACCOUNTANT'] as const).map(role => {
          const r   = report.byRole[role]
          const pct = total > 0 ? ((r.total / total) * 100).toFixed(1) : '0.0'
          const m   = ROLE_META[role]
          return (
            <div key={role} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: m.chart, display: 'inline-block' }} />
                {m.label}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── CSV export ───────────────────────────────────────────────

function exportCSV(report: AnnualFullReport, filtered: AnnualEmployee[]) {
  const BOM = '﻿'
  const headers = ['Nhân sự', 'Vai trò', 'Tháng có lương', 'Tổng lương cả năm', 'Lương TB/tháng']
  const lines = filtered.map(e => [
    e.fullName,
    ROLE_META[e.role]?.label ?? e.role,
    `${e.monthCount}/12`,
    e.totalAnnual,
    e.avgMonthly,
  ].join(','))
  const csv = BOM + [headers.join(','), ...lines].join('\n')
  const a   = Object.assign(document.createElement('a'), {
    href:     URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
    download: `quylương_${report.year}.csv`,
  })
  a.click()
  URL.revokeObjectURL(a.href)
}

// ══════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════

export default function AnnualFullReportPage() {
  const currentYear = new Date().getFullYear()
  const [year,       setYear]       = useState(currentYear)
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [tab,        setTab]        = useState<'chart' | 'table'>('chart')
  const [report,     setReport]     = useState<AnnualFullReport | null>(null)
  const [loading,    setLoading]    = useState(true)

  const load = useCallback(async (yr: number) => {
    setLoading(true)
    try { setReport(await salaryApi.getAnnualFullReport(yr)) }
    catch { setReport(null) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(year) }, [load, year])

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  const filteredEmployees = useMemo(() => {
    if (!report) return []
    return roleFilter === 'ALL'
      ? report.employees
      : report.employees.filter(e => e.role === roleFilter)
  }, [report, roleFilter])

  const filteredTotal = useMemo(
    () => filteredEmployees.reduce((s, e) => s + e.totalAnnual, 0),
    [filteredEmployees],
  )

  const kpiCards = useMemo(() => {
    if (!report) return []
    return [
      {
        label: `Tổng quỹ lương ${report.countActiveMonths} tháng`,
        value: fmtMoney(report.totalFund),
        sub:   `TB ${fmtMoney(report.avgMonthly)}/tháng`,
        color: '#111827', border: '#e5e7eb',
      },
      {
        label: `Bác sĩ (${report.byRole.DOCTOR.count} người)`,
        value: fmtMoney(report.byRole.DOCTOR.total),
        sub:   report.totalFund ? `${((report.byRole.DOCTOR.total / report.totalFund) * 100).toFixed(1)}% tổng quỹ` : null,
        color: ROLE_META.DOCTOR.color, border: '#c7d2fe',
      },
      {
        label: `Lễ tân (${report.byRole.RECEPTIONIST.count} người)`,
        value: fmtMoney(report.byRole.RECEPTIONIST.total),
        sub:   report.totalFund ? `${((report.byRole.RECEPTIONIST.total / report.totalFund) * 100).toFixed(1)}% tổng quỹ` : null,
        color: ROLE_META.RECEPTIONIST.color, border: '#99f6e4',
      },
      {
        label: `Kế toán (${report.byRole.ACCOUNTANT.count} người)`,
        value: fmtMoney(report.byRole.ACCOUNTANT.total),
        sub:   report.totalFund ? `${((report.byRole.ACCOUNTANT.total / report.totalFund) * 100).toFixed(1)}% tổng quỹ` : null,
        color: ROLE_META.ACCOUNTANT.color, border: '#ddd6fe',
      },
    ]
  }, [report])

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }} className="no-print">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: 0 }}>
            UC4.7 – Báo cáo quỹ lương năm (Toàn nhân sự)
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Tổng hợp và phân tích quỹ lương cả năm theo vai trò
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => report && exportCSV(report, filteredEmployees)}
            disabled={!report}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: '1.5px solid #d1d5db', background: '#fff', fontSize: 13, fontWeight: 600, color: '#374151', cursor: report ? 'pointer' : 'not-allowed', opacity: report ? 1 : 0.5 }}>
            <Download size={14} /> Excel
          </button>
          <button
            onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: 'none', background: '#111827', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <FileText size={14} /> PDF
          </button>
        </div>
      </div>

      {/* ── Filters + tab toggle ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 22, flexWrap: 'wrap' }} className="no-print">
        <div style={{ display: 'flex', gap: 12 }}>
          {/* Year */}
          <div style={{ position: 'relative' }}>
            <select
              value={year} onChange={e => setYear(Number(e.target.value))}
              style={{ padding: '9px 36px 9px 14px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, fontWeight: 600, color: '#111827', background: '#fff', cursor: 'pointer', outline: 'none', appearance: 'none' }}>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280' }} />
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
        </div>

        {/* Tab toggle */}
        <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 3 }}>
          {(['chart', 'table'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding: '7px 18px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: tab === t ? '#fff' : 'transparent',
                color:      tab === t ? '#111827' : '#6b7280',
                boxShadow:  tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}>
              {t === 'chart' ? 'Biểu đồ' : 'Bảng'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af', fontSize: 14 }}>Đang tải báo cáo…</div>
      ) : !report ? (
        <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af', fontSize: 14 }}>Không có dữ liệu</div>
      ) : (
        <>
          {/* ── KPI Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
            {kpiCards.map((k, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${k.border}`, padding: '18px 20px' }}>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 8px', fontWeight: 500 }}>{k.label}</p>
                <p style={{ fontSize: i === 0 ? 20 : 18, fontWeight: 800, color: k.color, margin: 0, lineHeight: 1.2 }}>
                  {k.value}
                </p>
                {k.sub && <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>{k.sub}</p>}
              </div>
            ))}
          </div>

          {/* ── Chart view ── */}
          {tab === 'chart' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 20 }}>
              {/* Bar chart */}
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', margin: 0 }}>
                    Quỹ lương theo tháng – {report.year}
                  </h3>
                  {/* Legend */}
                  <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#6b7280' }}>
                    {(['DOCTOR', 'RECEPTIONIST', 'ACCOUNTANT'] as const).map(r => (
                      <span key={r} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: ROLE_META[r].chart, display: 'inline-block' }} />
                        {ROLE_META[r].label}
                      </span>
                    ))}
                  </div>
                </div>
                {report.totalFund > 0
                  ? <MonthlyStackedChart data={report.monthlyChart} />
                  : <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', fontSize: 13 }}>Không có dữ liệu</div>
                }
              </div>

              {/* Donut chart */}
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px 24px' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', margin: '0 0 16px' }}>
                  Tỷ trọng theo vai trò
                </h3>
                <DonutChart report={report} />
              </div>
            </div>
          )}

          {/* ── Employee detail table ── */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>Chi tiết theo nhân sự</span>
              <span style={{ fontSize: 12, color: '#9ca3af', background: '#f3f4f6', borderRadius: 99, padding: '2px 8px' }}>
                {filteredEmployees.length} người
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  {[
                    { label: 'Nhân sự',           w: '30%' },
                    { label: 'Vai trò',            w: '12%' },
                    { label: 'Tháng có lương',     w: '14%' },
                    { label: 'Tổng lương cả năm',  w: '22%' },
                    { label: 'Lương TB/tháng',     w: '22%' },
                  ].map(h => (
                    <th key={h.label} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', width: h.w }}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '48px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                    Không có dữ liệu nhân sự cho năm {report.year}
                  </td></tr>
                ) : filteredEmployees.map(e => {
                  const rm = ROLE_META[e.role]
                  return (
                    <tr key={e.id} style={{ borderBottom: '1px solid #f3f4f6' }}
                      onMouseEnter={ev => (ev.currentTarget.style.background = '#fafafa')}
                      onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '13px 16px', fontSize: 14, fontWeight: 700, color: '#111827' }}>{e.fullName}</td>
                      <td style={{ padding: '13px 16px' }}><RoleBadge role={e.role} /></td>
                      <td style={{ padding: '13px 16px', fontSize: 13, color: '#374151' }}>
                        <span style={{ fontWeight: 600, color: '#111827' }}>{e.monthCount}</span>
                        <span style={{ color: '#9ca3af' }}>/12</span>
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 14, fontWeight: 800, color: '#111827' }}>
                        {fmtMoney(e.totalAnnual)}
                      </td>
                      <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 700, color: rm?.color ?? '#111827' }}>
                        {fmtMoney(e.avgMonthly)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {filteredEmployees.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                    <td colSpan={3} style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#374151' }}>
                      Tổng quỹ lương{roleFilter !== 'ALL' ? ` (${ROLE_META[roleFilter]?.label ?? roleFilter})` : ''} cả năm:
                    </td>
                    <td colSpan={2} style={{ padding: '12px 16px', fontSize: 15, fontWeight: 800, color: '#111827' }}>
                      {fmtMoney(filteredTotal)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}

      <style>{`
        @media print { .no-print { display: none !important; } body { background: white; } }
      `}</style>
    </div>
  )
}
