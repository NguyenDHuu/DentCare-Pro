import { useState, useEffect, useCallback, useMemo } from 'react'
import { Download, FileText, ChevronDown, Eye } from 'lucide-react'
import {
  salaryApi,
  type StaffForReport,
  type AnnualPersonalReport,
  type AnnualMonthRow,
} from '../../api/salary.api'

// ─── Constants ────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  DOCTOR:       { label: 'Bác sĩ',  color: '#2563eb', bg: '#eff6ff' },
  RECEPTIONIST: { label: 'Lễ tân',  color: '#0d9488', bg: '#f0fdfa' },
  ACCOUNTANT:   { label: 'Kế toán', color: '#7c3aed', bg: '#f5f3ff' },
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  FINALIZED: { label: 'Đã chốt',  color: '#16a34a', bg: '#f0fdf4', dot: '#16a34a' },
  APPROVED:  { label: 'Đã duyệt', color: '#2563eb', bg: '#eff6ff', dot: '#f59e0b' },
  DRAFT:     { label: 'Nháp',     color: '#d97706', bg: '#fffbeb', dot: '#f59e0b' },
  NONE:      { label: 'Chưa lập', color: '#9ca3af', bg: '#f9fafb', dot: '#d1d5db' },
}

// ─── Helpers ──────────────────────────────────────────────────

const fmtMoney = (n: number) => n.toLocaleString('vi-VN') + 'đ'
const fmtM     = (n: number) => {
  if (n === 0) return '0'
  return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'tr'
}
const monthLabel = (m: string) => {
  const [y, mo] = m.split('-')
  return `Tháng ${parseInt(mo)}/${y}`
}

// ─── SVG Line Chart ───────────────────────────────────────────

function SalaryLineChart({
  months,
  avgMonthly,
}: {
  months: AnnualMonthRow[]
  avgMonthly: number
}) {
  const W = 620, H = 170
  const PAD = { t: 18, r: 16, b: 36, l: 52 }
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b

  const values = months.map(m => m.netSalary ?? 0)
  const max    = Math.max(...values, avgMonthly, 1)

  const xOf = (i: number) => PAD.l + (innerW / 11) * i
  const yOf = (v: number) => PAD.t + innerH * (1 - v / max)

  // Y ticks
  const step   = Math.ceil(max / 4 / 1_000_000) * 1_000_000 || 1_000_000
  const yTicks = [0, 1, 2, 3, 4].map(n => step * n).filter(t => t <= max * 1.15)

  // Path for connected non-zero segments
  const hasData = months.some(m => m.status !== 'NONE')
  let pathD = ''
  if (hasData) {
    let started = false
    months.forEach((m, i) => {
      const v = m.netSalary ?? 0
      if (m.status === 'NONE') { started = false; return }
      pathD += `${started ? 'L' : 'M'}${xOf(i)},${yOf(v)} `
      started = true
    })
  }

  // Average line Y
  const avgY = yOf(avgMonthly)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id="salLineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#3b82f6" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"    />
        </linearGradient>
      </defs>

      {/* Grid lines + Y labels */}
      {yTicks.map(t => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={yOf(t)} y2={yOf(t)}
            stroke="#f0f0f0" strokeWidth={1} />
          <text x={PAD.l - 6} y={yOf(t) + 4} textAnchor="end"
            fontSize={9} fill="#9ca3af">{fmtM(t)}</text>
        </g>
      ))}

      {/* Average dashed line */}
      {avgMonthly > 0 && (
        <>
          <line x1={PAD.l} x2={W - PAD.r} y1={avgY} y2={avgY}
            stroke="#94a3b8" strokeWidth={1.2} strokeDasharray="5,4" />
          <text x={W - PAD.r + 2} y={avgY + 4} fontSize={9} fill="#94a3b8">TB</text>
        </>
      )}

      {/* Area fill */}
      {hasData && pathD && (
        <path
          d={`${pathD} L${xOf(11)},${PAD.t + innerH} L${PAD.l},${PAD.t + innerH} Z`}
          fill="url(#salLineGrad)"
        />
      )}

      {/* Line */}
      {hasData && pathD && (
        <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" />
      )}

      {/* Dots */}
      {months.map((m, i) => {
        const v    = m.netSalary ?? 0
        const sm   = STATUS_META[m.status] ?? STATUS_META.NONE
        const cx   = xOf(i)
        const cy   = m.status === 'NONE' ? PAD.t + innerH : yOf(v)
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={5} fill="white" stroke={sm.dot} strokeWidth={2} />
            {/* X label */}
            <text x={cx} y={H - PAD.b + 14} textAnchor="middle" fontSize={9} fill="#6b7280">
              T{i + 1}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Month detail modal ───────────────────────────────────────

function MonthModal({ row, onClose }: { row: AnnualMonthRow; onClose: () => void }) {
  const sm = STATUS_META[row.status] ?? STATUS_META.NONE
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '28px 32px', maxWidth: 440, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#111827', margin: 0 }}>{monthLabel(row.month)}</h3>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, color: sm.color, background: sm.bg, marginTop: 6, display: 'inline-block' }}>
              {sm.label}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4, fontSize: 16 }}>✕</button>
        </div>

        {row.status === 'NONE' ? (
          <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: '24px 0' }}>Chưa có phiếu lương tháng này</p>
        ) : (
          <div style={{ background: '#f9fafb', borderRadius: 10, padding: '16px 20px' }}>
            {row.sessionCount !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: '#6b7280' }}>Ca trực / Giờ quy đổi</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{row.sessionCount} ca / {row.hoursWorked}h</span>
              </div>
            )}
            {[
              { label: 'Lương ca / Cố định', value: fmtMoney(row.salaryAmount!), color: '#111827' },
              { label: 'Phụ cấp',  value: `+${fmtMoney(row.allowance!)}`,  color: (row.allowance! > 0) ? '#16a34a' : '#9ca3af' },
              { label: 'Khấu trừ', value: `-${fmtMoney(row.deduction!)}`,  color: (row.deduction! > 0) ? '#dc2626' : '#9ca3af' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: '#6b7280' }}>{item.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: item.color }}>{item.value}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Thực nhận</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>{fmtMoney(row.netSalary!)}</span>
            </div>
          </div>
        )}

        <button onClick={onClose}
          style={{ width: '100%', marginTop: 16, padding: '10px', borderRadius: 8, border: '1.5px solid #d1d5db', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
          Đóng
        </button>
      </div>
    </div>
  )
}

// ─── CSV export ───────────────────────────────────────────────

function exportCSV(report: AnnualPersonalReport) {
  const BOM = '﻿'
  const headers = ['Tháng', 'Số ca', 'Giờ QĐ', 'Lương ca/CĐ', 'Phụ cấp', 'Khấu trừ', 'Thực nhận', 'Trạng thái']
  const lines = report.months.map(m => [
    monthLabel(m.month),
    m.sessionCount ?? '',
    m.hoursWorked  ?? '',
    m.salaryAmount ?? '',
    m.allowance    ?? '',
    m.deduction    ?? '',
    m.netSalary    ?? '',
    STATUS_META[m.status]?.label ?? m.status,
  ].join(','))
  const csv = BOM + [headers.join(','), ...lines].join('\n')
  const a   = Object.assign(document.createElement('a'), {
    href:     URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
    download: `luong_nam_${report.user.fullName}_${report.year}.csv`,
  })
  a.click()
  URL.revokeObjectURL(a.href)
}

// ══════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════

export default function AnnualPersonalReportPage() {
  const currentYear = new Date().getFullYear()
  const [staffList,  setStaffList]  = useState<StaffForReport[]>([])
  const [userId,     setUserId]     = useState<number | null>(null)
  const [year,       setYear]       = useState(currentYear)
  const [report,     setReport]     = useState<AnnualPersonalReport | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [staffLoad,  setStaffLoad]  = useState(true)
  const [detail,     setDetail]     = useState<AnnualMonthRow | null>(null)

  // Load staff dropdown
  useEffect(() => {
    salaryApi.getAllStaffForReport()
      .then(list => { setStaffList(list); if (list.length > 0) setUserId(list[0].id) })
      .catch(() => {})
      .finally(() => setStaffLoad(false))
  }, [])

  // Load report
  const load = useCallback(async (uid: number, yr: number) => {
    setLoading(true)
    try { setReport(await salaryApi.getAnnualPersonalReport(uid, yr)) }
    catch { setReport(null) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (userId !== null) load(userId, year)
  }, [load, userId, year])

  const selectedStaff = useMemo(() => staffList.find(s => s.id === userId) ?? null, [staffList, userId])
  const rm = selectedStaff ? ROLE_META[selectedStaff.role] : null

  // Year options: current year ± 2
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  const kpiCards = useMemo(() => {
    if (!report) return []
    return [
      { label: 'Tổng lương cả năm',  value: fmtMoney(report.totalAnnual),  color: '#111827', sub: null },
      { label: 'Lương TB/tháng',      value: fmtMoney(report.avgMonthly),   color: rm?.color ?? '#2563eb', sub: null },
      { label: 'Tổng ca trực',        value: `${report.totalSessions} ca`,  color: '#111827', sub: null },
      { label: 'Tổng giờ quy đổi',   value: `${report.totalHours} giờ`,    color: '#111827', sub: null },
    ]
  }, [report, rm])

  return (
    <div>
      {detail && <MonthModal row={detail} onClose={() => setDetail(null)} />}

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }} className="no-print">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: 0 }}>
            UC4.6 – Báo cáo lương năm (Theo nhân sự)
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Diễn biến lương 12 tháng của một nhân sự</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => report && exportCSV(report)}
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

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 22, flexWrap: 'wrap' }} className="no-print">
        {/* Staff picker */}
        <div style={{ position: 'relative', minWidth: 280 }}>
          <select
            value={userId ?? ''}
            onChange={e => setUserId(Number(e.target.value))}
            disabled={staffLoad}
            style={{ width: '100%', padding: '9px 36px 9px 14px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, fontWeight: 600, color: '#111827', background: '#fff', cursor: 'pointer', outline: 'none', appearance: 'none' }}>
            {staffList.map(s => (
              <option key={s.id} value={s.id}>
                {s.fullName} ({ROLE_META[s.role]?.label ?? s.role})
              </option>
            ))}
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280' }} />
        </div>

        {/* Year picker */}
        <div style={{ position: 'relative' }}>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{ padding: '9px 36px 9px 14px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: 13, fontWeight: 600, color: '#111827', background: '#fff', cursor: 'pointer', outline: 'none', appearance: 'none' }}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6b7280' }} />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af', fontSize: 14 }}>Đang tải báo cáo…</div>
      ) : !report ? (
        <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af', fontSize: 14 }}>Không có dữ liệu</div>
      ) : (
        <>
          {/* ── Employee card ── */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px 24px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: rm?.bg ?? '#f3f4f6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 800, color: rm?.color ?? '#374151', flexShrink: 0,
            }}>
              {report.user.fullName.charAt(0)}
            </div>
            <div>
              <p style={{ fontSize: 17, fontWeight: 800, color: '#111827', margin: 0 }}>{report.user.fullName}</p>
              <p style={{ fontSize: 13, color: '#6b7280', marginTop: 3 }}>
                <span style={{ fontWeight: 600, color: rm?.color }}>{rm?.label ?? report.user.role}</span>
                {report.user.degree && <> • {report.user.degree}</>}
                {report.user.specialization && <> • {report.user.specialization}</>}
              </p>
            </div>
          </div>

          {/* ── KPI Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
            {kpiCards.map((k, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '18px 20px' }}>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 8px', fontWeight: 500 }}>{k.label}</p>
                <p style={{ fontSize: 19, fontWeight: 800, color: k.color, margin: 0 }}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* ── Line Chart ── */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', margin: 0 }}>
                Diễn biến lương theo tháng – {report.year}
              </h3>
              {/* Legend */}
              <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#6b7280' }}>
                {['FINALIZED', 'APPROVED', 'NONE'].map(s => {
                  const sm = STATUS_META[s]
                  return (
                    <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: sm.dot, display: 'inline-block' }} />
                      {sm.label}
                    </span>
                  )
                })}
              </div>
            </div>
            <SalaryLineChart months={report.months} avgMonthly={report.avgMonthly} />
          </div>

          {/* ── Month table ── */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  {['Tháng', 'Số ca', 'Giờ QĐ', 'Lương ca/CĐ', 'Phụ cấp', 'Khấu trừ', 'Thực nhận', 'Trạng thái', ''].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.months.map(m => {
                  const sm = STATUS_META[m.status] ?? STATUS_META.NONE
                  const isNone = m.status === 'NONE'
                  return (
                    <tr key={m.month}
                      style={{ borderBottom: '1px solid #f3f4f6', opacity: isNone ? 0.55 : 1 }}
                      onMouseEnter={e => { if (!isNone) e.currentTarget.style.background = '#fafafa' }}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: isNone ? 400 : 700, color: '#111827' }}>
                        {monthLabel(m.month)}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151' }}>
                        {isNone ? <span style={{ color: '#d1d5db' }}>0</span> : m.sessionCount ?? <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151' }}>
                        {isNone ? <span style={{ color: '#d1d5db' }}>0.0</span> : m.hoursWorked ?? <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#111827' }}>
                        {isNone ? <span style={{ color: '#d1d5db' }}>—</span> : fmtMoney(m.salaryAmount!)}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: !isNone && m.allowance! > 0 ? '#16a34a' : '#9ca3af' }}>
                        {isNone ? '—' : m.allowance! > 0 ? `+${fmtMoney(m.allowance!)}` : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: !isNone && m.deduction! > 0 ? '#dc2626' : '#9ca3af' }}>
                        {isNone ? '—' : m.deduction! > 0 ? `-${fmtMoney(m.deduction!)}` : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 800, color: '#111827' }}>
                        {isNone ? <span style={{ color: '#d1d5db' }}>—</span> : fmtMoney(m.netSalary!)}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, color: sm.color, background: sm.bg }}>
                          {sm.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        {!isNone && (
                          <button onClick={() => setDetail(m)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4 }}
                            title="Xem chi tiết"
                            onMouseEnter={e => (e.currentTarget.style.color = '#374151')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}>
                            <Eye size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                  <td colSpan={6} style={{ padding: '12px 14px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#374151' }}>
                    Tổng cả năm:
                  </td>
                  <td colSpan={3} style={{ padding: '12px 14px', fontSize: 15, fontWeight: 800, color: '#111827' }}>
                    {fmtMoney(report.totalAnnual)}
                  </td>
                </tr>
              </tfoot>
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
