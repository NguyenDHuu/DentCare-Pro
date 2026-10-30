import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ChevronLeft, ChevronRight, RefreshCw,
  Calendar, Users, Clock, Activity,
} from 'lucide-react'
import { receptionistApi } from '../../api/receptionist.api'
import type { ScheduleOverviewData, ScheduleDoctorRow, CalendarDay } from '../../api/receptionist.api'

// ─── Helpers ─────────────────────────────────────────────────

const REFRESH_INTERVAL = 60

function getThisMonday(): string {
  const d   = new Date()
  const dow = d.getDay()
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  return d.toISOString().slice(0, 10)
}

function shiftWeek(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T00:00:00.000Z')
  d.setUTCDate(d.getUTCDate() + delta * 7)
  return d.toISOString().slice(0, 10)
}

function fmtUpdatedAt(iso: string): string {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

/** Hex color → semi-transparent background; falls back gracefully for non-hex values */
function hexAlpha(hex: string, alpha: number): string {
  if (hex && hex.startsWith('#') && hex.length >= 7) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    if (!isNaN(r) && !isNaN(g) && !isNaN(b))
      return `rgba(${r},${g},${b},${alpha})`
  }
  // Fallback: wrap CSS color name in opacity layer
  return alpha < 0.5 ? 'rgba(107,114,128,0.08)' : 'rgba(107,114,128,0.25)'
}

// ─── Sub-components ──────────────────────────────────────────

/** Shift badge inside doctor grid cell */
function ShiftBadge({ shiftName, startTime, endTime, colorCode, bookedCount, maxPatients }: {
  shiftName: string; startTime: string; endTime: string
  colorCode: string; bookedCount: number; maxPatients: number
}) {
  const pct  = maxPatients > 0 ? bookedCount / maxPatients : 0
  const barColor = pct >= 1 ? '#ef4444' : pct >= 0.5 ? '#eab308' : '#22c55e'
  return (
    <div style={{
      backgroundColor: hexAlpha(colorCode, 0.12),
      border:          `1px solid ${hexAlpha(colorCode, 0.35)}`,
      borderLeft:      `3px solid ${colorCode}`,
      borderRadius:    '6px',
      padding:         '4px 7px',
      marginBottom:    '4px',
      minWidth:        '100px',
    }}>
      <p style={{ fontSize: '11px', fontWeight: 600, color: colorCode, marginBottom: '2px' }}>
        {shiftName}
      </p>
      <p style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px' }}>
        {startTime}–{endTime}
      </p>
      {/* Progress bar */}
      <div style={{ height: '3px', backgroundColor: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct * 100, 100)}%`, height: '100%', backgroundColor: barColor, transition: 'width 0.3s' }} />
      </div>
      <p style={{ fontSize: '10px', color: '#6b7280', marginTop: '3px' }}>
        {bookedCount}/{maxPatients} lịch
      </p>
    </div>
  )
}

/** Calendar card for one day */
function DayCard({ day }: { day: CalendarDay }) {
  const borderColor = day.isToday ? '#3b82f6' : day.isPast ? '#e5e7eb' : '#e5e7eb'
  const headerBg    = day.isToday ? '#eff6ff' : day.isPast ? '#f9fafb' : 'white'

  return (
    <div style={{
      border:        `1.5px solid ${borderColor}`,
      borderRadius:  '10px',
      overflow:      'hidden',
      backgroundColor: 'white',
      boxShadow:     day.isToday ? '0 0 0 2px #bfdbfe' : '0 1px 3px rgba(0,0,0,0.06)',
      flex:          '1 1 0',
      minWidth:      '120px',
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: headerBg,
        padding:         '8px 12px',
        borderBottom:    `1px solid ${borderColor}`,
        display:         'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, color: day.isToday ? '#3b82f6' : '#374151', textTransform: 'uppercase' }}>
            {day.fullLabel}
          </p>
          <p style={{ fontSize: '13px', fontWeight: 600, color: day.isToday ? '#1d4ed8' : '#111827' }}>
            {day.displayDate}
          </p>
        </div>
        {day.isToday && (
          <span style={{
            fontSize: '9px', fontWeight: 700, padding: '2px 6px',
            borderRadius: '20px', backgroundColor: '#3b82f6', color: 'white',
            letterSpacing: '0.04em',
          }}>
            HÔM NAY
          </span>
        )}
        {day.isPast && !day.isToday && (
          <span style={{ fontSize: '9px', color: '#9ca3af' }}>Đã qua</span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '8px 10px', minHeight: '60px' }}>
        {day.shifts.length === 0 ? (
          <p style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', marginTop: '8px' }}>
            Không có lịch trực
          </p>
        ) : (
          day.shifts.map(sh => (
            <div key={sh.shiftId} style={{
              backgroundColor: hexAlpha(sh.colorCode, 0.08),
              border:          `1px solid ${hexAlpha(sh.colorCode, 0.25)}`,
              borderLeft:      `3px solid ${sh.colorCode}`,
              borderRadius:    '6px',
              padding:         '6px 8px',
              marginBottom:    '6px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: sh.colorCode }}>{sh.shiftName}</span>
                <span style={{
                  fontSize: '10px', fontWeight: 600,
                  padding: '1px 6px', borderRadius: '10px',
                  backgroundColor: hexAlpha(sh.colorCode, 0.15), color: sh.colorCode,
                }}>
                  {sh.doctorCount} BS
                </span>
              </div>
              <p style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px' }}>
                {sh.startTime} – {sh.endTime}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ flex: 1, height: '3px', backgroundColor: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${sh.totalSlots > 0 ? Math.min((sh.bookedCount / sh.totalSlots) * 100, 100) : 0}%`,
                    height: '100%',
                    backgroundColor: sh.totalSlots > 0 && sh.bookedCount / sh.totalSlots >= 0.8 ? '#ef4444' : sh.colorCode,
                  }} />
                </div>
                <span style={{ fontSize: '10px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                  {sh.bookedCount}/{sh.totalSlots}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────

export default function DoctorScheduleViewPage() {
  const [weekStart, setWeekStart] = useState(getThisMonday())
  const [data,      setData]      = useState<ScheduleOverviewData | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL)
  const countdownRef = useRef(REFRESH_INTERVAL)

  const load = useCallback(async (ws: string) => {
    setLoading(true); setError('')
    try {
      const res = await receptionistApi.getScheduleOverview(ws)
      setData(res.data)
      countdownRef.current = REFRESH_INTERVAL
      setCountdown(REFRESH_INTERVAL)
    } catch {
      setError('Không thể tải dữ liệu lịch trực. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(weekStart) }, [weekStart, load])

  // Auto-refresh every REFRESH_INTERVAL seconds
  useEffect(() => {
    const timer = setInterval(() => {
      countdownRef.current -= 1
      setCountdown(countdownRef.current)
      if (countdownRef.current <= 0) {
        load(weekStart)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [weekStart, load])

  const prevWeek = () => setWeekStart(ws => shiftWeek(ws, -1))
  const nextWeek = () => setWeekStart(ws => shiftWeek(ws, +1))
  const goToday  = () => setWeekStart(getThisMonday())

  // ── Derived stats
  const totalDoctors    = data?.doctors.length ?? 0
  const todayData       = data?.calendarDays.find(d => d.isToday)
  const todayShiftCount = todayData?.shifts.reduce((s, sh) => s + sh.doctorCount, 0) ?? 0
  const todayBooked     = todayData?.shifts.reduce((s, sh) => s + sh.bookedCount, 0) ?? 0
  const weekBooked      = data?.calendarDays.reduce((sum, d) =>
    sum + d.shifts.reduce((s, sh) => s + sh.bookedCount, 0), 0) ?? 0

  // ── Render
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Top bar: week navigation + refresh ── */}
      <div style={{
        backgroundColor: 'white', borderRadius: '12px', padding: '16px 20px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
      }}>
        {/* Left: navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={prevWeek} style={navBtnStyle}>
            <ChevronLeft size={18} />
          </button>

          <div style={{ textAlign: 'center', minWidth: '180px' }}>
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
              {data ? `Tuần ${data.weekNumber}, ${new Date(weekStart + 'T00:00:00').getFullYear()}` : 'Đang tải...'}
            </p>
            {data && (
              <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '1px' }}>
                {data.weekDays[0]?.displayDate} – {data.weekDays[6]?.displayDate}
                &nbsp;
                {(() => {
                  const m = new Date(weekStart + 'T00:00:00').getMonth() + 1
                  const y = new Date(weekStart + 'T00:00:00').getFullYear()
                  return `tháng ${m}/${y}`
                })()}
              </p>
            )}
          </div>

          <button onClick={nextWeek} style={navBtnStyle}>
            <ChevronRight size={18} />
          </button>

          <button onClick={goToday} style={{
            padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
            border: '1.5px solid #3b82f6', color: '#3b82f6', backgroundColor: 'white',
            cursor: 'pointer', marginLeft: '4px',
          }}>
            Tuần này
          </button>
        </div>

        {/* Right: refresh status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {data && (
            <p style={{ fontSize: '11px', color: '#9ca3af' }}>
              Cập nhật lúc {fmtUpdatedAt(data.updatedAt)}
              &nbsp;·&nbsp;
              Làm mới sau <span style={{ color: '#3b82f6', fontWeight: 600 }}>{countdown}s</span>
            </p>
          )}
          <button
            onClick={() => load(weekStart)}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
              border: '1px solid #e5e7eb', color: '#374151', backgroundColor: 'white',
              cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
            }}
          >
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Làm mới
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {[
          { icon: Users,    label: 'Bác sĩ có lịch tuần này', value: totalDoctors,    color: '#3b82f6', bg: '#eff6ff' },
          { icon: Calendar, label: 'Bác sĩ trực hôm nay',      value: todayShiftCount, color: '#8b5cf6', bg: '#f5f3ff' },
          { icon: Activity, label: 'Lịch hẹn hôm nay',         value: todayBooked,     color: '#f97316', bg: '#fff7ed' },
          { icon: Clock,    label: 'Tổng lịch hẹn tuần này',   value: weekBooked,      color: '#22c55e', bg: '#f0fdf4' },
        ].map(s => (
          <div key={s.label} style={{
            backgroundColor: 'white', borderRadius: '10px', padding: '16px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              backgroundColor: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <s.icon size={18} color={s.color} />
            </div>
            <div>
              <p style={{ fontSize: '22px', fontWeight: 700, color: '#111827' }}>
                {loading ? '–' : s.value}
              </p>
              <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '1px' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px 16px', color: '#dc2626', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* ── Doctor grid table ── */}
      <div style={{
        backgroundColor: 'white', borderRadius: '12px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={16} color="#374151" />
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>Lịch trực theo bác sĩ</h3>
          {data && (
            <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: '4px' }}>
              ({totalDoctors} bác sĩ có lịch tuần này)
            </span>
          )}
        </div>

        {loading && !data ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
            Đang tải dữ liệu...
          </div>
        ) : !data || data.doctors.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <Calendar size={40} color="#d1d5db" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>Tuần này chưa có lịch trực nào được phân công</p>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>Lịch trực được tạo từ trang Quản lý Lịch trực (Admin)</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
              {/* Header */}
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <th style={{
                    ...thStyle, width: '180px', position: 'sticky', left: 0,
                    backgroundColor: '#f9fafb', zIndex: 2, textAlign: 'left',
                  }}>
                    Bác sĩ
                  </th>
                  {data.weekDays.map(wd => (
                    <th key={wd.date} style={{
                      ...thStyle,
                      backgroundColor: wd.isToday ? '#eff6ff' : '#f9fafb',
                      color:           wd.isToday ? '#2563eb' : '#374151',
                      borderBottom:    wd.isToday ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                    }}>
                      <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>{wd.fullLabel}</p>
                      <p style={{ fontSize: '12px', fontWeight: 500, marginTop: '2px', opacity: 0.8 }}>{wd.displayDate}</p>
                      {wd.isToday && (
                        <span style={{
                          display: 'inline-block', marginTop: '2px',
                          fontSize: '9px', fontWeight: 700, padding: '1px 6px',
                          borderRadius: '10px', backgroundColor: '#3b82f6', color: 'white',
                        }}>
                          HÔM NAY
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.doctors.map((doc, idx) => (
                  <DoctorRow key={doc.id} doc={doc} weekDays={data.weekDays} isEven={idx % 2 === 1} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Calendar day cards ── */}
      {data && (
        <div style={{
          backgroundColor: 'white', borderRadius: '12px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden',
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} color="#374151" />
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>Lịch theo ngày</h3>
          </div>
          <div style={{ padding: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {data.calendarDays.map(day => (
              <DayCard key={day.date} day={day} />
            ))}
          </div>
        </div>
      )}

      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─── Doctor row in table ──────────────────────────────────────

function DoctorRow({ doc, weekDays, isEven }: {
  doc:      ScheduleDoctorRow
  weekDays: ScheduleOverviewData['weekDays']
  isEven:   boolean
}) {
  return (
    <tr style={{ backgroundColor: isEven ? '#fafafa' : 'white', verticalAlign: 'top' }}>
      {/* Doctor info */}
      <td style={{
        ...tdStyle, width: '180px', position: 'sticky', left: 0,
        backgroundColor: isEven ? '#fafafa' : 'white', zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
            backgroundColor: doc.avatarColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 700, color: 'white',
          }}>
            {doc.initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              BS. {doc.name}
            </p>
            <p style={{ fontSize: '10px', color: '#9ca3af', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {doc.specialty}
            </p>
          </div>
        </div>
      </td>

      {/* Day cells */}
      {weekDays.map(wd => {
        const shifts = doc.days[wd.date] ?? []
        return (
          <td key={wd.date} style={{
            ...tdStyle,
            backgroundColor: wd.isToday
              ? (isEven ? '#f0f7ff' : '#f5f9ff')
              : undefined,
            minWidth: '120px',
          }}>
            {shifts.length === 0 ? (
              <span style={{ fontSize: '11px', color: '#d1d5db' }}>—</span>
            ) : (
              shifts.map(sh => (
                <ShiftBadge
                  key={sh.scheduleId}
                  shiftName={sh.shiftName}
                  startTime={sh.startTime}
                  endTime={sh.endTime}
                  colorCode={sh.colorCode}
                  bookedCount={sh.bookedCount}
                  maxPatients={sh.maxPatients}
                />
              ))
            )}
          </td>
        )
      })}
    </tr>
  )
}

// ─── Style constants ─────────────────────────────────────────

const navBtnStyle: React.CSSProperties = {
  width: '32px', height: '32px', border: '1px solid #e5e7eb',
  borderRadius: '8px', backgroundColor: 'white', display: 'flex',
  alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  color: '#374151',
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'center', fontSize: '11px', fontWeight: 600,
  color: '#374151', border: '1px solid #e5e7eb', whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px', border: '1px solid #f3f4f6', verticalAlign: 'top',
}
