import { useEffect, useState, useCallback } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { CalendarDays, Clock, CheckCircle2, Users, RefreshCw, Loader2, TrendingUp, TrendingDown } from 'lucide-react'
import { receptionistApi, type DashboardData } from '../../api/receptionist.api'
import { useAuthStore } from '../../stores/auth.store'

// ─── Helpers ─────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  PENDING:     { label: 'Chờ xác nhận', bg: '#fff7ed', color: '#ea580c' },
  CONFIRMED:   { label: 'Đã xác nhận',  bg: '#eff6ff', color: '#2563eb' },
  IN_PROGRESS: { label: 'Đang khám',    bg: '#faf5ff', color: '#9333ea' },
  COMPLETED:   { label: 'Hoàn thành',   bg: '#f0fdf4', color: '#16a34a' },
  CANCELLED:   { label: 'Đã hủy',       bg: '#f9fafb', color: '#6b7280' },
  ABSENT:      { label: 'Vắng mặt',     bg: '#fef2f2', color: '#dc2626' },
}

// ─── Bar Chart ───────────────────────────────────────────────

function BarChart({ data }: { data: { day: string; total: number; completed: number; cancelled: number }[] }) {
  const maxVal = Math.max(...data.map(d => d.total), 5)
  const H = 140; const barW = 28; const gap = 18; const padL = 28; const padB = 24

  const ticks = [0, Math.round(maxVal * 0.25), Math.round(maxVal * 0.5), Math.round(maxVal * 0.75), maxVal]
  const svgW = padL + data.length * (barW + gap)

  return (
    <svg width="100%" viewBox={`0 0 ${svgW} ${H + padB}`} style={{ overflow: 'visible' }}>
      {/* Grid lines + Y labels */}
      {ticks.map((v, i) => {
        const y = H - (v / maxVal) * H
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={svgW} y2={y} stroke="#f3f4f6" strokeWidth="1" />
            <text x={padL - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#9ca3af">{v}</text>
          </g>
        )
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const x = padL + i * (barW + gap)
        const bH = maxVal > 0 ? (d.total / maxVal) * H : 0
        const y  = H - bH
        return (
          <g key={i}>
            {/* Total bar */}
            <rect x={x} y={y} width={barW} height={bH} fill="#3b82f6" rx="4" opacity="0.85" />
            {/* Completed overlay */}
            {d.completed > 0 && (
              <rect
                x={x} y={H - (d.completed / maxVal) * H}
                width={barW} height={(d.completed / maxVal) * H}
                fill="#22c55e" rx="4" opacity="0.7"
              />
            )}
            {/* Day label */}
            <text x={x + barW / 2} y={H + padB - 4} textAnchor="middle" fontSize="10" fill="#6b7280">
              {d.day}
            </text>
            {/* Count on top */}
            {d.total > 0 && (
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600">
                {d.total}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ─── Donut Chart ─────────────────────────────────────────────

function DonutChart({ data }: { data: { label: string; count: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  if (total === 0) return (
    <div style={{ textAlign: 'center', padding: '32px', color: '#9ca3af', fontSize: '13px' }}>
      Chưa có dữ liệu tháng này
    </div>
  )

  const r = 58; const cx = 72; const cy = 72; const sw = 20
  const circ = 2 * Math.PI * r

  let cumPct = 0
  const segments = data.map(d => {
    const pct    = d.count / total
    const dash   = pct * circ
    const offset = circ * (1 - cumPct)
    cumPct += pct
    return { ...d, dash, offset }
  })

  return (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
      <svg width="144" height="144" viewBox="0 0 144 144" style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth={sw} />
        {segments.map((seg, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.color} strokeWidth={sw}
            strokeDasharray={`${seg.dash} ${circ - seg.dash}`}
            strokeDashoffset={seg.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            strokeLinecap="round"
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="22" fontWeight="800" fill="#111827">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="#9ca3af">tổng cộng</text>
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', flex: 1 }}>
        {data.map(d => (
          <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <div style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: d.color, flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: '#374151' }}>{d.label}</span>
            </div>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Stat Card ───────────────────────────────────────────────

function StatCard({
  icon, label, value, sub, diff, iconBg, iconColor, onClick,
}: {
  icon:      React.ReactNode
  label:     string
  value:     string | number
  sub?:      string
  diff?:     number
  iconBg:    string
  iconColor: string
  onClick?:  () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'white', borderRadius: '14px', border: '1px solid #e5e7eb',
        padding: '20px 20px 16px', display: 'flex', gap: '14px', alignItems: 'flex-start',
        cursor: onClick ? 'pointer' : 'default', transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => onClick && ((e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)')}
      onMouseLeave={e => onClick && ((e.currentTarget as HTMLDivElement).style.boxShadow = 'none')}
    >
      <div style={{
        width: '46px', height: '46px', borderRadius: '12px', backgroundColor: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{label}</p>
        <p style={{ fontSize: '28px', fontWeight: 800, color: '#111827', margin: '2px 0 0', lineHeight: 1 }}>{value}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
          {diff !== undefined && diff !== 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px',
              fontSize: '11px', fontWeight: 600,
              color: diff > 0 ? '#16a34a' : '#dc2626',
            }}>
              {diff > 0
                ? <TrendingUp size={11} />
                : <TrendingDown size={11} />
              }
              {diff > 0 ? `+${diff}` : diff} so với hôm qua
            </span>
          )}
          {sub && <span style={{ fontSize: '11px', color: iconColor, fontWeight: 500 }}>{sub}</span>}
        </div>
      </div>
    </div>
  )
}

// ─── Status Badge ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, bg: '#f9fafb', color: '#6b7280' }
  return (
    <span style={{
      fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '99px',
      backgroundColor: m.bg, color: m.color,
    }}>
      {m.label}
    </span>
  )
}

// ════════════════════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════════════════════

export default function StaffDashboardPage() {
  const navigate       = useNavigate()
  const { activeRole } = useAuthStore()
  const [data,    setData]    = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await receptionistApi.getDashboard()
      setData(res.data)
    } catch {
      setError('Không thể tải dữ liệu. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Kế toán dùng trang Thống kê làm bảng điều khiển chính
  if (activeRole === 'ACCOUNTANT') {
    return <Navigate to="/staff/stats" replace />
  }

  // Format date header
  const dateStr = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
      <Loader2 size={32} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  )

  if (error) return (
    <div style={{ textAlign: 'center', padding: '60px', color: '#dc2626' }}>
      <p style={{ fontSize: '14px' }}>{error}</p>
      <button onClick={load} style={{ marginTop: '12px', padding: '8px 20px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <RefreshCw size={14} /> Thử lại
      </button>
    </div>
  )

  if (!data) return null
  const { stats, weeklyChart, statusBreakdown, todayAppointments, notifications } = data

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', margin: 0 }}>Bảng điều khiển</h2>
          <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '3px', textTransform: 'capitalize' }}>{dateStr}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={load}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#6b7280' }}>
            <RefreshCw size={14} /> Làm mới
          </button>
          <button onClick={() => navigate('/staff/appointments/new')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#2563eb', cursor: 'pointer', fontSize: '13px', color: 'white', fontWeight: 600 }}>
            + Đặt lịch hẹn
          </button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
        <StatCard
          icon={<CalendarDays size={22} color="#2563eb" />}
          label="Lịch hẹn hôm nay"
          value={stats.todayCount}
          diff={stats.todayDiff}
          iconBg="#dbeafe" iconColor="#2563eb"
          onClick={() => navigate('/staff/appointments')}
        />
        <StatCard
          icon={<Clock size={22} color="#ea580c" />}
          label="Đang chờ xác nhận"
          value={stats.pendingCount}
          sub={stats.pendingCount > 0 ? 'Cần xử lý ngay' : 'Không có'}
          iconBg="#ffedd5" iconColor="#ea580c"
          onClick={() => navigate('/staff/appointments')}
        />
        <StatCard
          icon={<CheckCircle2 size={22} color="#16a34a" />}
          label="Hoàn thành hôm nay"
          value={stats.completedCount}
          sub={stats.todayCount > 0 ? `Tỉ lệ ${stats.completionRate}%` : undefined}
          iconBg="#dcfce7" iconColor="#16a34a"
        />
        <StatCard
          icon={<Users size={22} color="#9333ea" />}
          label="Bệnh nhân mới"
          value={stats.newPatientsThisMonth}
          sub="Tháng này"
          iconBg="#f3e8ff" iconColor="#9333ea"
        />
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px', marginBottom: '16px' }}>
        {/* Bar chart */}
        <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid #e5e7eb', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>Lịch hẹn trong tuần</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              {[
                { color: '#3b82f6', label: 'Tổng lịch hẹn' },
                { color: '#22c55e', label: 'Hoàn thành' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: l.color }} />
                  <span style={{ fontSize: '11px', color: '#6b7280' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          <BarChart data={weeklyChart} />
        </div>

        {/* Donut chart */}
        <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid #e5e7eb', padding: '20px' }}>
          <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Trạng thái lịch hẹn</p>
          <DonutChart data={statusBreakdown} />
        </div>
      </div>

      {/* ── Today list + Notifications ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px' }}>
        {/* Today appointments */}
        <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>
              Lịch hẹn hôm nay
              {todayAppointments.length > 0 && (
                <span style={{ marginLeft: '8px', fontSize: '12px', fontWeight: 600, backgroundColor: '#dbeafe', color: '#2563eb', padding: '2px 8px', borderRadius: '99px' }}>
                  {todayAppointments.length}
                </span>
              )}
            </p>
            <button onClick={() => navigate('/staff/appointments')}
              style={{ fontSize: '12px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Xem tất cả →
            </button>
          </div>

          {todayAppointments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
              <CalendarDays size={28} style={{ marginBottom: '8px' }} />
              <p style={{ fontSize: '13px', margin: 0 }}>Không có lịch hẹn nào hôm nay</p>
            </div>
          ) : (
            <div>
              {todayAppointments.map((apt, i) => (
                <div key={apt.id} style={{
                  display: 'flex', alignItems: 'center', padding: '12px 20px', gap: '14px',
                  borderBottom: i < todayAppointments.length - 1 ? '1px solid #f9fafb' : 'none',
                  backgroundColor: i % 2 === 0 ? 'white' : '#fafafa',
                }}>
                  {/* Time */}
                  <div style={{ minWidth: '48px', textAlign: 'center' }}>
                    <p style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0 }}>{apt.time}</p>
                    <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>Giờ</p>
                  </div>

                  {/* Divider */}
                  <div style={{ width: '3px', height: '36px', borderRadius: '2px', backgroundColor: STATUS_META[apt.status]?.color ?? '#e5e7eb', flexShrink: 0 }} />

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {apt.patientName}
                    </p>
                    <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {apt.doctorName} • {apt.serviceName}
                    </p>
                  </div>

                  <StatusBadge status={apt.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div style={{ backgroundColor: 'white', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>
              Thông báo
              {notifications.length > 0 && (
                <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 700, backgroundColor: '#ef4444', color: 'white', padding: '2px 7px', borderRadius: '99px' }}>
                  {notifications.length}
                </span>
              )}
            </p>
          </div>

          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
              <p style={{ fontSize: '13px', margin: 0 }}>Không có thông báo mới</p>
            </div>
          ) : (
            <div style={{ padding: '8px 0' }}>
              {notifications.map((n, i) => (
                <div key={n.id} style={{
                  display: 'flex', gap: '12px', padding: '12px 20px', alignItems: 'flex-start',
                  borderBottom: i < notifications.length - 1 ? '1px solid #f9fafb' : 'none',
                }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: n.color, flexShrink: 0, marginTop: '5px' }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', color: '#374151', margin: 0, lineHeight: 1.5 }}>{n.message}</p>
                    {n.timeAgo && (
                      <p style={{ fontSize: '11px', color: '#9ca3af', margin: '3px 0 0' }}>{n.timeAgo}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
