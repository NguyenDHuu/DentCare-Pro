import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ChevronLeft, ChevronRight, RefreshCw,
  Calendar, Users, Clock, CheckCircle2,
  Star, AlertCircle,
} from 'lucide-react'
import { doctorApi } from '../../api/doctor.api'
import type {
  MyScheduleData, MyScheduleDay, MyShift,
  GroupScheduleData, GroupDoctorRow, GroupDoctorShift,
} from '../../api/doctor.api'

// ─── Constants ───────────────────────────────────────────────

const REFRESH_INTERVAL = 60

// ─── Helpers ─────────────────────────────────────────────────

function toLocalDateStr(d: Date): string {
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function getThisMonday(): string {
  const d   = new Date()
  const dow = d.getDay()
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  return toLocalDateStr(d)
}

function shiftWeek(dateStr: string, delta: number): string {
  // Parse as local noon to avoid DST / timezone-shift issues
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + delta * 7)
  return toLocalDateStr(d)
}

function fmtTime(iso: string): string {
  const d  = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function hexAlpha(hex: string, alpha: number): string {
  if (hex && hex.startsWith('#') && hex.length >= 7) {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    if (!isNaN(r) && !isNaN(g) && !isNaN(b))
      return `rgba(${r},${g},${b},${alpha})`
  }
  return `rgba(107,114,128,${alpha < 0.5 ? 0.08 : 0.25})`
}

// ─── Shared sub-components ───────────────────────────────────

const navBtnStyle: React.CSSProperties = {
  width: '32px', height: '32px', border: '1px solid #e5e7eb',
  borderRadius: '8px', backgroundColor: 'white',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: '#374151',
}

// Status pill for a shift
function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    FREE:    { label: 'Còn chỗ',   bg: '#f0fdf4', color: '#16a34a' },
    BUSY:    { label: 'Đang đặt',  bg: '#fffbeb', color: '#d97706' },
    FULL:    { label: 'Đầy',       bg: '#fef2f2', color: '#dc2626' },
    VISITED: { label: 'Đã khám',   bg: '#f0fdf4', color: '#059669' },
  }
  const s = map[status] ?? { label: status, bg: '#f3f4f6', color: '#6b7280' }
  return (
    <span style={{
      fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '20px',
      backgroundColor: s.bg, color: s.color, letterSpacing: '0.03em',
    }}>
      {s.label}
    </span>
  )
}

// Progress bar for booking fill
function FillBar({ booked, max, color }: { booked: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(booked / max, 1) : 0
  const barColor = pct >= 1 ? '#ef4444' : pct >= 0.6 ? '#eab308' : color
  return (
    <div style={{ marginTop: '5px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
        <span style={{ fontSize: '10px', color: '#6b7280' }}>{booked}/{max} lịch hẹn</span>
        <span style={{ fontSize: '10px', color: barColor, fontWeight: 600 }}>
          {Math.round(pct * 100)}%
        </span>
      </div>
      <div style={{ height: '4px', backgroundColor: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{
          width: `${pct * 100}%`, height: '100%',
          backgroundColor: barColor, transition: 'width 0.3s',
        }} />
      </div>
    </div>
  )
}

// ─── Week Navigation Bar ─────────────────────────────────────

interface WeekNavProps {
  weekStart: string
  updatedAt: string | null
  loading:   boolean
  countdown: number
  weekNumber: number | null
  weekDayRange: string | null
  onPrev:    () => void
  onNext:    () => void
  onToday:   () => void
  onRefresh: () => void
}

function WeekNav({
  weekStart, updatedAt, loading, countdown, weekNumber, weekDayRange,
  onPrev, onNext, onToday, onRefresh,
}: WeekNavProps) {
  const year = new Date(weekStart + 'T00:00:00').getFullYear()
  const month = new Date(weekStart + 'T00:00:00').getMonth() + 1
  return (
    <div style={{
      backgroundColor: 'white', borderRadius: '12px', padding: '16px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button onClick={onPrev} style={navBtnStyle}><ChevronLeft size={18} /></button>
        <div style={{ textAlign: 'center', minWidth: '180px' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
            {weekNumber != null ? `Tuần ${weekNumber}, ${year}` : 'Đang tải...'}
          </p>
          {weekDayRange && (
            <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '1px' }}>
              {weekDayRange} · tháng {month}/{year}
            </p>
          )}
        </div>
        <button onClick={onNext} style={navBtnStyle}><ChevronRight size={18} /></button>
        <button onClick={onToday} style={{
          padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
          border: '1.5px solid #3b82f6', color: '#3b82f6', backgroundColor: 'white',
          cursor: 'pointer', marginLeft: '4px',
        }}>
          Tuần này
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {updatedAt && (
          <p style={{ fontSize: '11px', color: '#9ca3af' }}>
            Cập nhật lúc {fmtTime(updatedAt)} · Làm mới sau{' '}
            <span style={{ color: '#3b82f6', fontWeight: 600 }}>{countdown}s</span>
          </p>
        )}
        <button
          onClick={onRefresh} disabled={loading}
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
  )
}

// ═══════════════════════════════════════════════════════════
// TAB 1 – Lịch của tôi
// ═══════════════════════════════════════════════════════════

function MyShiftCard({ shift }: { shift: MyShift }) {
  return (
    <div style={{
      backgroundColor: hexAlpha(shift.colorCode, 0.07),
      border:          `1px solid ${hexAlpha(shift.colorCode, 0.3)}`,
      borderLeft:      `3px solid ${shift.colorCode}`,
      borderRadius:    '8px',
      padding:         '9px 10px',
      marginBottom:    '8px',
    }}>
      {/* Shift name + status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: shift.colorCode }}>
          {shift.shiftName}
        </span>
        <StatusPill status={shift.status} />
      </div>

      {/* Time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
        <Clock size={10} color="#9ca3af" />
        <span style={{ fontSize: '11px', color: '#6b7280' }}>
          {shift.startTime} – {shift.endTime}
        </span>
      </div>

      {/* Service group */}
      {shift.serviceGroupName && (
        <div style={{
          display: 'inline-block', fontSize: '10px', fontWeight: 500,
          padding: '2px 7px', borderRadius: '10px',
          backgroundColor: hexAlpha(shift.colorCode, 0.12), color: shift.colorCode,
          marginBottom: '5px',
        }}>
          {shift.serviceGroupName}
        </div>
      )}

      {/* Fill bar */}
      <FillBar booked={shift.bookedCount} max={shift.maxPatients} color={shift.colorCode} />

      {/* Bệnh nhân đã đến thực tế */}
      {shift.visitedCount > 0 && (
        <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Users size={10} color="#059669" />
          <span style={{ fontSize: '10px', color: '#059669', fontWeight: 600 }}>
            {shift.visitedCount} bệnh nhân đã đến
          </span>
        </div>
      )}

      {/* Free slots */}
      <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <CheckCircle2 size={10} color="#16a34a" />
        <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600 }}>
          Còn {shift.freeCount} slot trống
        </span>
        {shift.note && (
          <span style={{ fontSize: '10px', color: '#9ca3af', marginLeft: '4px' }}>
            · {shift.note}
          </span>
        )}
      </div>
    </div>
  )
}

function MyDayCard({ day }: { day: MyScheduleDay }) {
  const borderColor = day.isToday ? '#3b82f6' : '#e5e7eb'
  const headerBg    = day.isToday ? '#eff6ff' : day.isPast ? '#f9fafb' : 'white'

  return (
    <div style={{
      border:          `1.5px solid ${borderColor}`,
      borderRadius:    '10px',
      overflow:        'hidden',
      backgroundColor: 'white',
      boxShadow:       day.isToday ? '0 0 0 2px #bfdbfe' : '0 1px 3px rgba(0,0,0,0.06)',
      flex:            '1 1 0',
      minWidth:        '130px',
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: headerBg,
        padding:         '8px 12px',
        borderBottom:    `1px solid ${borderColor}`,
        display:         'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <p style={{
            fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
            color: day.isToday ? '#3b82f6' : '#6b7280',
          }}>
            {day.fullLabel}
          </p>
          <p style={{ fontSize: '15px', fontWeight: 700, color: day.isToday ? '#1d4ed8' : '#111827', marginTop: '1px' }}>
            {day.displayDate}
          </p>
        </div>
        {day.isToday && (
          <span style={{
            fontSize: '9px', fontWeight: 700, padding: '2px 7px',
            borderRadius: '20px', backgroundColor: '#3b82f6', color: 'white',
          }}>
            HÔM NAY
          </span>
        )}
        {day.isPast && !day.isToday && (
          <span style={{ fontSize: '9px', color: '#d1d5db' }}>Đã qua</span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '10px' }}>
        {day.shifts.length === 0 ? (
          <p style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', marginTop: '8px', marginBottom: '8px' }}>
            Không có ca trực
          </p>
        ) : (
          <>
            {day.shifts.map(sh => <MyShiftCard key={sh.scheduleId} shift={sh} />)}
            {/* Day summary */}
            <div style={{
              display: 'flex', gap: '6px', paddingTop: '4px',
              borderTop: '1px dashed #f3f4f6',
            }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>{day.totalBooked}</p>
                <p style={{ fontSize: '9px', color: '#9ca3af' }}>Lịch hẹn</p>
              </div>
              <div style={{ width: '1px', backgroundColor: '#f3f4f6' }} />
              <div style={{ flex: 1, textAlign: 'center' }}>
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#059669' }}>{day.totalVisited}</p>
                <p style={{ fontSize: '9px', color: '#9ca3af' }}>Đã đến</p>
              </div>
              <div style={{ width: '1px', backgroundColor: '#f3f4f6' }} />
              <div style={{ flex: 1, textAlign: 'center' }}>
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#16a34a' }}>{day.totalFree}</p>
                <p style={{ fontSize: '9px', color: '#9ca3af' }}>Slot trống</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function MyScheduleTab({ data, loading }: { data: MyScheduleData | null; loading: boolean }) {
  if (loading && !data)
    return <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>Đang tải...</div>
  if (!data)
    return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {[
          { icon: Calendar,    label: 'Ca trực trong tuần',      value: data.weekStats.totalShifts,   color: '#3b82f6', bg: '#eff6ff' },
          { icon: Users,       label: 'Bệnh nhân đã đến',        value: data.weekStats.totalVisited,  color: '#059669', bg: '#ecfdf5' },
          { icon: CheckCircle2,label: 'Lịch hẹn đặt trước',     value: data.weekStats.totalBooked,   color: '#f97316', bg: '#fff7ed' },
          { icon: Star,        label: 'Slot trống còn lại',      value: data.weekStats.totalFree,     color: '#22c55e', bg: '#f0fdf4' },
        ].map(s => (
          <div key={s.label} style={{
            backgroundColor: 'white', borderRadius: '10px', padding: '14px 16px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              backgroundColor: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <s.icon size={18} color={s.color} />
            </div>
            <div>
              <p style={{ fontSize: '22px', fontWeight: 700, color: '#111827', lineHeight: 1.1 }}>{s.value}</p>
              <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Service groups chips */}
      {data.serviceGroups.length > 0 && (
        <div style={{
          backgroundColor: 'white', borderRadius: '10px', padding: '12px 16px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>Nhóm dịch vụ:</span>
          {data.serviceGroups.map(g => (
            <span key={g.id} style={{
              fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px',
              backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe',
            }}>
              {g.name}
            </span>
          ))}
        </div>
      )}

      {/* 7-day calendar grid */}
      <div style={{
        backgroundColor: 'white', borderRadius: '12px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={15} color="#374151" />
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>Lịch trực của tôi trong tuần</h3>
        </div>
        <div style={{ padding: '16px', display: 'flex', gap: '10px', overflowX: 'auto' }}>
          {data.mySchedule.map(day => <MyDayCard key={day.date} day={day} />)}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// TAB 2 – Lịch nhóm dịch vụ
// ═══════════════════════════════════════════════════════════

// Card for a doctor-in-group inside the table cell
function GroupDoctorCard({ doc, shift, isMe }: {
  doc:   GroupDoctorRow
  shift: GroupDoctorShift
  isMe:  boolean
}) {
  const pct       = shift.maxPatients > 0 ? shift.bookedCount / shift.maxPatients : 0
  const barColor  = pct >= 1 ? '#ef4444' : pct >= 0.6 ? '#eab308' : shift.colorCode
  const borderCol = isMe ? '#3b82f6' : shift.colorCode
  const bgCol     = isMe ? 'rgba(59,130,246,0.07)' : hexAlpha(shift.colorCode, 0.07)

  return (
    <div style={{
      backgroundColor: bgCol,
      border:          `1px solid ${isMe ? '#93c5fd' : hexAlpha(borderCol, 0.3)}`,
      borderLeft:      `3px solid ${borderCol}`,
      borderRadius:    '8px',
      padding:         '7px 9px',
      marginBottom:    '6px',
      position:        'relative',
    }}>
      {/* "Tôi" badge */}
      {isMe && (
        <div style={{
          position: 'absolute', top: '5px', right: '6px',
          fontSize: '8px', fontWeight: 700, padding: '1px 5px',
          borderRadius: '8px', backgroundColor: '#3b82f6', color: 'white',
        }}>
          Tôi
        </div>
      )}

      {/* Doctor name */}
      <p style={{
        fontSize: '11px', fontWeight: 700,
        color: isMe ? '#1d4ed8' : '#111827',
        marginBottom: '2px',
        paddingRight: isMe ? '28px' : '0',
      }}>
        BS. {doc.name}
      </p>

      {/* Specialty / group */}
      <p style={{ fontSize: '9px', color: '#9ca3af', marginBottom: '4px' }}>
        {shift.serviceGroupName ?? doc.specialty}
      </p>

      {/* Time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '4px' }}>
        <Clock size={9} color="#9ca3af" />
        <span style={{ fontSize: '10px', color: '#6b7280' }}>
          {shift.startTime}–{shift.endTime}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ flex: 1, height: '3px', backgroundColor: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(pct * 100, 100)}%`, height: '100%', backgroundColor: barColor }} />
        </div>
        <span style={{ fontSize: '10px', color: '#6b7280', whiteSpace: 'nowrap' }}>
          {shift.bookedCount}/{shift.maxPatients}
        </span>
      </div>
    </div>
  )
}

// Extract all unique shifts from group data, sorted by startTime
function extractShifts(doctors: GroupDoctorRow[]) {
  const map = new Map<number, { shiftId: number; shiftName: string; startTime: string; endTime: string; colorCode: string }>()
  for (const doc of doctors)
    for (const shifts of Object.values(doc.days))
      for (const sh of shifts)
        if (!map.has(sh.shiftId))
          map.set(sh.shiftId, {
            shiftId: sh.shiftId, shiftName: sh.shiftName,
            startTime: sh.startTime, endTime: sh.endTime, colorCode: sh.colorCode,
          })
  return [...map.values()].sort((a, b) => a.startTime.localeCompare(b.startTime))
}

function GroupScheduleTab({ data, loading, myId }: {
  data:    GroupScheduleData | null
  loading: boolean
  myId:    number
}) {
  const [filterGroup, setFilterGroup] = useState<number | null>(null)

  if (loading && !data)
    return <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>Đang tải...</div>
  if (!data)
    return null

  const allShifts = extractShifts(data.doctors)
  const doctors   = filterGroup
    ? data.doctors.filter(d => d.sharedGroups.some(g => g.id === filterGroup))
    : data.doctors

  const totalDoctors    = doctors.length
  const doctorsWithSched = doctors.filter(d => Object.keys(d.days).length > 0).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
        {[
          { icon: Users,    label: 'Bác sĩ cùng nhóm',       value: totalDoctors,        color: '#3b82f6', bg: '#eff6ff' },
          { icon: Calendar, label: 'Bác sĩ có lịch tuần này', value: doctorsWithSched,    color: '#8b5cf6', bg: '#f5f3ff' },
          { icon: Star,     label: 'Nhóm dịch vụ',            value: data.serviceGroups.length, color: '#f97316', bg: '#fff7ed' },
        ].map(s => (
          <div key={s.label} style={{
            backgroundColor: 'white', borderRadius: '10px', padding: '14px 16px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              backgroundColor: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <s.icon size={18} color={s.color} />
            </div>
            <div>
              <p style={{ fontSize: '22px', fontWeight: 700, color: '#111827', lineHeight: 1.1 }}>{s.value}</p>
              <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      {data.serviceGroups.length > 1 && (
        <div style={{
          backgroundColor: 'white', borderRadius: '10px', padding: '10px 16px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>Lọc nhóm:</span>
          {[{ id: null, name: 'Tất cả' }, ...data.serviceGroups].map(g => (
            <button key={g.id ?? 'all'}
              onClick={() => setFilterGroup(g.id)}
              style={{
                padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
                border: filterGroup === g.id ? '1.5px solid #3b82f6' : '1.5px solid #e5e7eb',
                backgroundColor: filterGroup === g.id ? '#eff6ff' : 'white',
                color:           filterGroup === g.id ? '#2563eb'  : '#6b7280',
                cursor: 'pointer',
              }}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {data.serviceGroups.length === 0 && (
        <div style={{
          backgroundColor: 'white', borderRadius: '12px', padding: '48px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)', textAlign: 'center',
        }}>
          <AlertCircle size={40} color="#d1d5db" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>
            Bạn chưa được phân vào nhóm dịch vụ nào
          </p>
          <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
            Liên hệ Admin để được thêm vào nhóm dịch vụ
          </p>
        </div>
      )}

      {/* Grid table: rows = shifts, columns = days */}
      {allShifts.length > 0 && (
        <div style={{
          backgroundColor: 'white', borderRadius: '12px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={15} color="#374151" />
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>Lịch trực nhóm theo ca</h3>
            <span style={{ fontSize: '11px', color: '#6b7280' }}>
              ({doctors.length} bác sĩ)
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '860px' }}>
              {/* Table header */}
              <thead>
                <tr style={{ backgroundColor: '#f9fafb' }}>
                  <th style={{ ...thStyle, width: '110px', position: 'sticky', left: 0, backgroundColor: '#f9fafb', zIndex: 2 }}>
                    Ca / Ngày
                  </th>
                  {data.weekDays.map(wd => (
                    <th key={wd.date} style={{
                      ...thStyle,
                      backgroundColor: wd.isToday ? '#eff6ff' : '#f9fafb',
                      color:           wd.isToday ? '#2563eb' : '#374151',
                      borderBottom:    wd.isToday ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                    }}>
                      <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>{wd.dayLabel}</p>
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

              {/* Rows grouped by shift */}
              <tbody>
                {allShifts.map((shift, shIdx) => (
                  <tr key={shift.shiftId} style={{
                    backgroundColor: shIdx % 2 === 1 ? '#fafafa' : 'white',
                    verticalAlign: 'top',
                  }}>
                    {/* Left: shift label */}
                    <td style={{
                      ...tdStyle,
                      position: 'sticky', left: 0, zIndex: 1,
                      backgroundColor: shIdx % 2 === 1 ? '#fafafa' : 'white',
                      width: '110px',
                    }}>
                      <div style={{
                        display: 'inline-block',
                        padding: '4px 0',
                      }}>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '4px 10px', borderRadius: '20px',
                          backgroundColor: hexAlpha(shift.colorCode, 0.1),
                          border: `1px solid ${hexAlpha(shift.colorCode, 0.3)}`,
                          marginBottom: '4px',
                        }}>
                          <div style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            backgroundColor: shift.colorCode, flexShrink: 0,
                          }} />
                          <span style={{ fontSize: '11px', fontWeight: 700, color: shift.colorCode }}>
                            {shift.shiftName}
                          </span>
                        </div>
                        <p style={{ fontSize: '10px', color: '#9ca3af' }}>
                          {shift.startTime}–{shift.endTime}
                        </p>
                      </div>
                    </td>

                    {/* Day cells */}
                    {data.weekDays.map(wd => {
                      const docsInCell = doctors.filter(doc =>
                        doc.days[wd.date]?.some(s => s.shiftId === shift.shiftId)
                      )
                      return (
                        <td key={wd.date} style={{
                          ...tdStyle,
                          minWidth: '140px',
                          backgroundColor: wd.isToday
                            ? (shIdx % 2 === 1 ? '#f0f7ff' : '#f5f9ff')
                            : undefined,
                        }}>
                          {docsInCell.length === 0 ? (
                            <span style={{ fontSize: '11px', color: '#d1d5db' }}>Chưa phân công</span>
                          ) : (
                            docsInCell.map(doc => {
                              const sh = doc.days[wd.date]!.find(s => s.shiftId === shift.shiftId)!
                              return (
                                <GroupDoctorCard
                                  key={doc.id}
                                  doc={doc}
                                  shift={sh}
                                  isMe={doc.id === myId || doc.isMe}
                                />
                              )
                            })
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No schedules at all */}
      {allShifts.length === 0 && data.serviceGroups.length > 0 && (
        <div style={{
          backgroundColor: 'white', borderRadius: '12px', padding: '48px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)', textAlign: 'center',
        }}>
          <Calendar size={40} color="#d1d5db" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: '14px', color: '#6b7280', fontWeight: 500 }}>
            Tuần này nhóm chưa có lịch trực nào
          </p>
        </div>
      )}

      {/* Legend */}
      <div style={{
        backgroundColor: 'white', borderRadius: '10px', padding: '12px 16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 500 }}>Chú thích:</span>
        {[
          { color: '#3b82f6', label: 'Lịch của tôi', border: '#93c5fd' },
          { color: '#22c55e', label: 'Bác sĩ cùng nhóm', border: 'rgba(34,197,94,0.3)' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '14px', height: '14px', borderRadius: '3px',
              backgroundColor: `${l.color}18`, border: `1.5px solid ${l.border}`,
              borderLeft: `3px solid ${l.color}`,
            }} />
            <span style={{ fontSize: '11px', color: '#374151' }}>{l.label}</span>
          </div>
        ))}
        {[
          { color: '#ef4444', label: 'Đầy lịch' },
          { color: '#eab308', label: 'Gần đầy' },
          { color: '#22c55e', label: 'Còn chỗ' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '24px', height: '4px', borderRadius: '2px', backgroundColor: l.color }} />
            <span style={{ fontSize: '11px', color: '#374151' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════

export default function DoctorMySchedulePage() {
  const [tab,       setTab]       = useState<'my' | 'group'>('my')
  const [weekStart, setWeekStart] = useState(getThisMonday())
  const [myData,    setMyData]    = useState<MyScheduleData | null>(null)
  const [grpData,   setGrpData]   = useState<GroupScheduleData | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL)
  const countdownRef = useRef(REFRESH_INTERVAL)

  // Derive myId from stored user
  const myId: number = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}').id ?? 0 } catch { return 0 }
  })()

  const load = useCallback(async (ws: string) => {
    setLoading(true); setError('')
    try {
      const [r1, r2] = await Promise.all([
        doctorApi.getMySchedule(ws),
        doctorApi.getGroupSchedule(ws),
      ])
      setMyData(r1.data)
      setGrpData(r2.data)
      countdownRef.current = REFRESH_INTERVAL
      setCountdown(REFRESH_INTERVAL)
    } catch {
      setError('Không thể tải dữ liệu. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(weekStart) }, [weekStart, load])

  // Auto-refresh countdown
  useEffect(() => {
    const timer = setInterval(() => {
      countdownRef.current -= 1
      setCountdown(countdownRef.current)
      if (countdownRef.current <= 0) load(weekStart)
    }, 1000)
    return () => clearInterval(timer)
  }, [weekStart, load])

  const prevWeek = () => setWeekStart(ws => shiftWeek(ws, -1))
  const nextWeek = () => setWeekStart(ws => shiftWeek(ws, +1))
  const goToday  = () => setWeekStart(getThisMonday())

  const activeData = tab === 'my' ? myData : grpData
  const weekDayRange = activeData
    ? `${activeData.weekDays[0]?.displayDate} – ${activeData.weekDays[6]?.displayDate}`
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Week navigation */}
      <WeekNav
        weekStart={weekStart}
        updatedAt={activeData?.updatedAt ?? null}
        loading={loading}
        countdown={countdown}
        weekNumber={activeData?.weekNumber ?? null}
        weekDayRange={weekDayRange}
        onPrev={prevWeek}
        onNext={nextWeek}
        onToday={goToday}
        onRefresh={() => load(weekStart)}
      />

      {/* Tab switcher */}
      <div style={{
        backgroundColor: 'white', borderRadius: '12px', padding: '6px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
        display: 'inline-flex', gap: '4px', alignSelf: 'flex-start',
      }}>
        {([
          { key: 'my',    label: 'Lịch của tôi',         icon: Clock  },
          { key: 'group', label: 'Lịch nhóm dịch vụ',    icon: Users  },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '9px 20px', borderRadius: '8px',
              border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              backgroundColor: tab === t.key ? '#eff6ff' : 'transparent',
              color:           tab === t.key ? '#2563eb' : '#6b7280',
              transition: 'all 0.2s',
            }}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          backgroundColor: '#fef2f2', border: '1px solid #fca5a5',
          borderRadius: '8px', padding: '12px 16px', color: '#dc2626', fontSize: '13px',
        }}>
          {error}
        </div>
      )}

      {/* Tab content */}
      {tab === 'my' && <MyScheduleTab data={myData} loading={loading} />}
      {tab === 'group' && <GroupScheduleTab data={grpData} loading={loading} myId={myId} />}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─── Style constants ─────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'center', fontSize: '11px', fontWeight: 600,
  color: '#374151', border: '1px solid #e5e7eb', whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px', border: '1px solid #f3f4f6', verticalAlign: 'top',
}
