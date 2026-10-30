import React, { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, Users, DollarSign, AlertCircle,
  BarChart3, Download, RefreshCw, ChevronDown,
} from 'lucide-react'
import { invoiceApi } from '../../api/invoice.api'
import type { StatsData, ChartPoint } from '../../api/invoice.api'
import { useAuthStore } from '../../stores/auth.store'

// ─── Helpers ─────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`
  return String(n)
}

function fmtFull(n: number) { return n.toLocaleString('vi-VN') + 'đ' }

type Period = 'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR'
const PERIODS: { key: Period; label: string }[] = [
  { key: 'TODAY',   label: 'Hôm nay' },
  { key: 'WEEK',    label: 'Tuần này' },
  { key: 'MONTH',   label: 'Tháng này' },
  { key: 'QUARTER', label: 'Quý này' },
  { key: 'YEAR',    label: 'Năm nay' },
]

// ─── SVG Bar Chart ────────────────────────────────────────────

function BarChart({ data }: { data: ChartPoint[] }) {
  const W = 580, H = 160, PAD = { t: 10, r: 10, b: 30, l: 52 }
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b
  const max    = Math.max(...data.map(d => d.revenue), 1)
  const barW   = innerW / data.length * 0.55
  const gap    = innerW / data.length

  // Y-axis labels
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    v:  Math.round(max * f),
    y:  PAD.t + innerH * (1 - f),
  }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {/* Grid lines */}
      {yTicks.map(t => (
        <g key={t.v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} stroke="#f3f4f6" strokeWidth={1} />
          <text x={PAD.l - 6} y={t.y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
            {fmt(t.v)}
          </text>
        </g>
      ))}

      {/* Bars */}
      {data.map((d, i) => {
        const bh  = innerH * (d.revenue / max)
        const bx  = PAD.l + gap * i + gap / 2 - barW / 2
        const by  = PAD.t + innerH - bh
        return (
          <g key={i}>
            <rect
              x={bx} y={by} width={barW} height={Math.max(bh, 2)}
              rx={3} fill="#3b82f6" opacity={0.85}
            />
            <text
              x={bx + barW / 2} y={H - PAD.b + 14}
              textAnchor="middle" fontSize={10} fill="#6b7280"
            >
              {d.label}
            </text>
            {d.revenue > 0 && (
              <text
                x={bx + barW / 2} y={by - 4}
                textAnchor="middle" fontSize={8} fill="#3b82f6" fontWeight="bold"
              >
                {fmt(d.revenue)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ─── SVG Line Chart ───────────────────────────────────────────

function LineChart({ data }: { data: ChartPoint[] }) {
  const W = 580, H = 160, PAD = { t: 10, r: 10, b: 30, l: 42 }
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b
  const max    = Math.max(...data.map(d => d.patients), 1)

  const points = data.map((d, i) => ({
    x: PAD.l + (innerW / (data.length - 1 || 1)) * i,
    y: PAD.t + innerH * (1 - d.patients / max),
    v: d.patients,
    label: d.label,
  }))

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaD = `${pathD} L${points[points.length-1].x},${PAD.t + innerH} L${points[0].x},${PAD.t + innerH} Z`

  // Y-axis ticks
  const yTicks = [0, 0.5, 1].map(f => ({
    v:  Math.round(max * f),
    y:  PAD.t + innerH * (1 - f),
  }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#10b981" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} stroke="#f3f4f6" strokeWidth={1} />
          <text x={PAD.l - 6} y={t.y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{t.v}</text>
        </g>
      ))}

      {/* Area */}
      <path d={areaD} fill="url(#lineGrad)" />

      {/* Line */}
      <path d={pathD} fill="none" stroke="#10b981" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

      {/* Dots + labels */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill="#fff" stroke="#10b981" strokeWidth={2.5} />
          <text x={p.x} y={H - PAD.b + 14} textAnchor="middle" fontSize={10} fill="#6b7280">{p.label}</text>
          {p.v > 0 && (
            <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize={8} fill="#10b981" fontWeight="bold">{p.v}</text>
          )}
        </g>
      ))}
    </svg>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, subColor, growth,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: React.ReactNode
  subColor?: string
  growth?: number
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
      padding: '18px 20px', flex: 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#1f2937' }}>{value}</div>
      {growth !== undefined && (
        <div style={{
          marginTop: 6, fontSize: 12, fontWeight: 600,
          color: growth >= 0 ? '#059669' : '#dc2626',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {growth >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {growth >= 0 ? '+' : ''}{growth}% so với kỳ trước
        </div>
      )}
      {sub && (
        <div style={{ marginTop: 6, fontSize: 12, color: subColor ?? '#6b7280' }}>{sub}</div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────

export default function StatsPage() {
  const { activeRole } = useAuthStore()
  const isAdmin        = activeRole === 'ADMIN'

  const [period,   setPeriod]   = useState<Period>('WEEK')
  const [stats,    setStats]    = useState<StatsData | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [showPicker, setShowPicker] = useState(false)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const data = await invoiceApi.getStats(period)
      setStats(data)
    } catch (e) {
      console.error(e)
    } finally { setLoading(false) }
  }, [period])

  useEffect(() => { fetchStats() }, [fetchStats])

  const handleExportCSV = () => {
    if (!stats) return
    const rows = [
      ['Ngày', 'Doanh thu (đ)', 'Lượt khách'],
      ...stats.chartData.map(d => [d.label, d.revenue, d.patients]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `thongke-${period.toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const periodLabel = PERIODS.find(p => p.key === period)?.label ?? period

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1f2937', margin: 0 }}>Thống kê Doanh thu</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Báo cáo doanh thu, công nợ và hiệu suất phòng khám.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Period picker */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowPicker(p => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 14px', borderRadius: 8, border: '1.5px solid #d1d5db',
                background: '#fff', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer',
              }}
            >
              {periodLabel} <ChevronDown size={14} style={{ transform: showPicker ? 'rotate(180deg)' : 'none' }} />
            </button>
            {showPicker && (
              <div style={{
                position: 'absolute', right: 0, top: '110%', background: '#fff',
                border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                zIndex: 100, minWidth: 140, padding: 4,
              }}>
                {PERIODS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => { setPeriod(p.key); setShowPicker(false) }}
                    style={{
                      width: '100%', padding: '8px 12px', textAlign: 'left',
                      background: period === p.key ? '#eff6ff' : 'none',
                      border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer',
                      color: period === p.key ? '#2563eb' : '#374151', fontWeight: period === p.key ? 700 : 400,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export */}
          <button
            onClick={handleExportCSV}
            disabled={!stats || loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 16px', borderRadius: 8, border: '1.5px solid #d1d5db',
              background: '#fff', fontSize: 13, fontWeight: 600, color: '#374151',
              cursor: !stats || loading ? 'not-allowed' : 'pointer', opacity: !stats ? 0.5 : 1,
            }}
          >
            <Download size={14} /> Xuất Excel
          </button>

          <button
            onClick={fetchStats}
            style={{
              padding: 9, borderRadius: 8, border: '1.5px solid #d1d5db',
              background: '#fff', cursor: 'pointer', color: '#6b7280',
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
          <BarChart3 size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div>Đang tải dữ liệu...</div>
        </div>
      ) : !stats ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Lỗi tải dữ liệu</div>
      ) : (
        <>
          {/* ── KPI Cards ── */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
            <KpiCard
              icon={<DollarSign size={20} color="#2563eb" />}
              label="Tổng Doanh thu"
              value={fmtFull(stats.summary.totalRevenue)}
              growth={stats.summary.revenueGrowth}
            />
            <KpiCard
              icon={<Users size={20} color="#10b981" />}
              label="Tổng Khách hàng"
              value={String(stats.summary.patientCount)}
              growth={stats.summary.patientGrowth}
            />
            <KpiCard
              icon={<BarChart3 size={20} color="#f59e0b" />}
              label="Doanh thu TB / Khách"
              value={fmtFull(stats.summary.avgRevenue)}
              sub="Mức chi tiêu trung bình"
            />
            <KpiCard
              icon={<AlertCircle size={20} color="#ef4444" />}
              label="Tổng Công nợ"
              value={fmtFull(stats.summary.totalDebt)}
              sub={
                stats.summary.overdueCount > 0
                  ? <span style={{ color: '#dc2626', fontWeight: 700 }}>{stats.summary.overdueCount} khách hàng nợ quá hạn</span>
                  : 'Không có nợ quá hạn'
              }
              subColor={stats.summary.overdueCount > 0 ? '#dc2626' : '#059669'}
            />
          </div>

          {/* ── Charts ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '18px 20px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', margin: '0 0 16px' }}>
                Biểu đồ Doanh thu ({periodLabel})
              </h3>
              {stats.chartData.every(d => d.revenue === 0) ? (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: 32, fontSize: 13 }}>
                  Chưa có dữ liệu doanh thu
                </div>
              ) : (
                <BarChart data={stats.chartData} />
              )}
            </div>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '18px 20px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', margin: '0 0 16px' }}>
                Lượt Khách hàng ({periodLabel})
              </h3>
              {stats.chartData.every(d => d.patients === 0) ? (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: 32, fontSize: 13 }}>
                  Chưa có dữ liệu
                </div>
              ) : (
                <LineChart data={stats.chartData} />
              )}
            </div>
          </div>

          {/* ── Top Services ── */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '18px 20px', marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', margin: '0 0 16px' }}>
              Dịch vụ đóng góp doanh thu cao nhất
            </h3>
            {stats.topServices.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#9ca3af', padding: 24, fontSize: 13 }}>
                Chưa có dữ liệu dịch vụ
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['TÊN DỊCH VỤ', 'SỐ LƯỢNG', 'DOANH THU', 'TỶ TRỌNG'].map(h => (
                      <th key={h} style={{
                        padding: '8px 12px',
                        textAlign: h === 'SỐ LƯỢNG' || h === 'DOANH THU' || h === 'TỶ TRỌNG' ? 'right' : 'left',
                        fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
                        borderBottom: '1px solid #e5e7eb',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.topServices.map((svc, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: '#1f2937' }}>
                        {svc.name}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, color: '#374151' }}>
                        {svc.count}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#1f2937' }}>
                        {fmtFull(svc.revenue)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          <div style={{
                            height: 6, borderRadius: 3, background: '#3b82f6', opacity: 0.7,
                            width: `${Math.max(svc.percentage * 1.5, 4)}px`,
                          }} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#2563eb', minWidth: 40, textAlign: 'right' }}>
                            {svc.percentage}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Revenue by Doctor (Admin only) ── */}
          {isAdmin && stats.revenueByDoctor.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '18px 20px', marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', margin: '0 0 16px' }}>
                Doanh thu theo Bác sĩ
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['BÁC SĨ', 'SỐ BỆNH NHÂN', 'TỔNG DOANH THU', 'TB/BỆNH NHÂN'].map(h => (
                      <th key={h} style={{
                        padding: '8px 12px',
                        textAlign: h === 'BÁC SĨ' ? 'left' : 'right',
                        fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
                        borderBottom: '1px solid #e5e7eb',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.revenueByDoctor.map((dr, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: '#1f2937' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%', background: '#3b82f6',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: 12, fontWeight: 800,
                          }}>
                            {dr.doctorName.charAt(0)}
                          </div>
                          {dr.doctorName}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, color: '#374151' }}>
                        {dr.patients}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#1f2937' }}>
                        {fmtFull(dr.revenue)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontSize: 13, color: '#6b7280' }}>
                        {dr.patients > 0 ? fmtFull(Math.round(dr.revenue / dr.patients)) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
