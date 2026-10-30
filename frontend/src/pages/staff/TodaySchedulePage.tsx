import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search, ChevronLeft, ChevronRight, RefreshCw,
  Calendar, Clock, User, Phone, Stethoscope,
  CheckCircle2, PlayCircle, XCircle, X, Loader2,
  CalendarDays, ChevronDown, ChevronUp, FileText,
} from 'lucide-react'
import { doctorApi } from '../../api/doctor.api'
import type { DoctorAppointment, AptView, TodayReception } from '../../api/doctor.api'

// ─── Constants & helpers ──────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PENDING:     { label: 'Chờ xác nhận', color: '#f97316', bg: '#fff7ed', border: '#fed7aa' },
  CONFIRMED:   { label: 'Đã xác nhận',  color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  CHECKED_IN:  { label: 'Đã check-in',  color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  IN_PROGRESS: { label: 'Đang khám',    color: '#a855f7', bg: '#faf5ff', border: '#e9d5ff' },
  COMPLETED:   { label: 'Hoàn thành',   color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0' },
  ABSENT:      { label: 'Vắng mặt',     color: '#eab308', bg: '#fefce8', border: '#fde68a' },
  CANCELLED:   { label: 'Đã hủy',       color: '#9ca3af', bg: '#f9fafb', border: '#e5e7eb' },
}

// Actions the DOCTOR can perform
const DOCTOR_ACTIONS: Record<string, { label: string; next: string; color: string; icon: React.ReactNode } | null> = {
  CHECKED_IN:  { label: 'Bắt đầu khám',   next: 'IN_PROGRESS', color: '#a855f7', icon: <PlayCircle  size={14} /> },
  IN_PROGRESS: { label: 'Hoàn thành khám', next: 'COMPLETED',   color: '#22c55e', icon: <CheckCircle2 size={14} /> },
}

const GENDER_LABEL: Record<string, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' }

function pad2(n: number) { return String(n).padStart(2, '0') }

function toLocalStr(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`
}

function fmtDate(iso: string, view: AptView): string {
  const d = new Date(iso)
  if (view === 'day') return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function fmtDateLabel(dateStr: string, view: AptView): string {
  const d   = new Date(dateStr + 'T12:00:00')
  const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
  if (view === 'day')
    return `${DOW[d.getDay()]}, ${d.getDate()} tháng ${d.getMonth()+1}, ${d.getFullYear()}`
  if (view === 'week') {
    const dow  = d.getDay()
    const mon  = new Date(d); mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
    const sun  = new Date(mon); sun.setDate(mon.getDate() + 6)
    return `${mon.getDate()}/${mon.getMonth()+1} – ${sun.getDate()}/${sun.getMonth()+1}/${sun.getFullYear()}`
  }
  return `Tháng ${d.getMonth()+1}, ${d.getFullYear()}`
}

function shiftDate(dateStr: string, view: AptView, delta: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  if (view === 'day')   d.setDate(d.getDate() + delta)
  if (view === 'week')  d.setDate(d.getDate() + delta * 7)
  if (view === 'month') d.setMonth(d.getMonth() + delta)
  return toLocalStr(d)
}

function isToday(dateStr: string): boolean { return dateStr === toLocalStr(new Date()) }

// ─── Toast ────────────────────────────────────────────────────

function Toast({ msg, type, onDismiss }: { msg: string; type: 'success' | 'error'; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 3500); return () => clearTimeout(t) }, [onDismiss])
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 2000,
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '12px 18px', borderRadius: '10px', maxWidth: '360px',
      backgroundColor: type === 'success' ? '#f0fdf4' : '#fef2f2',
      border: `1px solid ${type === 'success' ? '#bbf7d0' : '#fca5a5'}`,
      boxShadow: '0 4px 16px rgba(0,0,0,.12)',
      fontSize: '13px', fontWeight: 600,
      color: type === 'success' ? '#16a34a' : '#dc2626',
    }}>
      {type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
      {msg}
      <button onClick={onDismiss} style={{ marginLeft: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
        <X size={13} />
      </button>
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: 600,
      color: m.color, backgroundColor: m.bg, border: `1px solid ${m.border}`,
      whiteSpace: 'nowrap',
    }}>
      {m.label}
    </span>
  )
}

// ─── Single appointment card (Day view) ──────────────────────

function AptCard({ apt, busy, onAction, view }: {
  apt:      DoctorAppointment
  busy:     boolean
  onAction: (id: number, next: string) => void
  view:     AptView
}) {
  const [expanded, setExpanded] = useState(false)
  const action = DOCTOR_ACTIONS[apt.status] ?? null
  const meta   = STATUS_META[apt.status] ?? STATUS_META['PENDING']
  const d      = new Date(apt.appointmentDate)
  const timeStr = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  const dateStr  = view !== 'day'
    ? `${pad2(d.getDate())}/${pad2(d.getMonth()+1)} · ` : ''

  const isActive = ['CHECKED_IN', 'IN_PROGRESS'].includes(apt.status)

  return (
    <div style={{
      backgroundColor: 'white',
      border:          `1.5px solid ${isActive ? meta.border : '#e5e7eb'}`,
      borderLeft:      `4px solid ${meta.color}`,
      borderRadius:    '12px',
      overflow:        'hidden',
      boxShadow:       isActive ? `0 0 0 3px ${meta.bg}` : '0 1px 3px rgba(0,0,0,0.06)',
      transition:      'box-shadow 0.2s',
    }}>
      {/* Main row */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Time */}
        <div style={{ textAlign: 'center', minWidth: '52px', flexShrink: 0 }}>
          <p style={{ fontSize: '18px', fontWeight: 800, color: meta.color, lineHeight: 1 }}>{timeStr}</p>
          {view !== 'day' && (
            <p style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>
              {pad2(d.getDate())}/{pad2(d.getMonth()+1)}
            </p>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '48px', backgroundColor: '#f3f4f6', flexShrink: 0 }} />

        {/* Patient info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>
              {apt.patientName}
            </p>
            {apt.patientGender && (
              <span style={{ fontSize: '10px', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '1px 6px', borderRadius: '99px' }}>
                {GENDER_LABEL[apt.patientGender] ?? apt.patientGender}
              </span>
            )}
            <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600 }}>{apt.code}</span>
            <StatusBadge status={apt.status} />
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Phone size={11} /> {apt.patientPhone}
            </span>
            {apt.serviceName && (
              <span style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Stethoscope size={11} /> {apt.serviceName}
              </span>
            )}
            {apt.patientDob && (
              <span style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CalendarDays size={11} /> {apt.patientDob.slice(0,10).split('-').reverse().join('/')}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          {action && (
            <button
              onClick={() => onAction(apt.id, action.next)}
              disabled={busy}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '8px', border: 'none',
                backgroundColor: action.color, color: 'white',
                fontWeight: 600, fontSize: '13px',
                cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {busy
                ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                : action.icon}
              {action.label}
            </button>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '32px', height: '32px', borderRadius: '8px',
              border: '1.5px solid #e5e7eb', backgroundColor: 'white',
              cursor: 'pointer', color: '#6b7280',
            }}
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          borderTop: '1px solid #f3f4f6',
          padding: '12px 16px',
          backgroundColor: '#fafafa',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px',
        }}>
          {[
            { label: 'Họ tên',      value: apt.patientName },
            { label: 'SĐT',         value: apt.patientPhone },
            { label: 'Giới tính',   value: apt.patientGender ? GENDER_LABEL[apt.patientGender] ?? apt.patientGender : '—' },
            { label: 'Ngày sinh',   value: apt.patientDob ? apt.patientDob.slice(0,10).split('-').reverse().join('/') : '—' },
            { label: 'Dịch vụ',     value: apt.serviceName ?? '—' },
            { label: 'Trạng thái',  value: STATUS_META[apt.status]?.label ?? apt.status },
          ].map(row => (
            <div key={row.label}>
              <p style={{ fontSize: '10px', color: '#9ca3af', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{row.label}</p>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0 }}>{row.value}</p>
            </div>
          ))}
          {apt.note && (
            <div style={{ gridColumn: '1/-1' }}>
              <p style={{ fontSize: '10px', color: '#9ca3af', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Ghi chú</p>
              <p style={{ fontSize: '13px', color: '#374151', margin: 0, backgroundColor: '#fff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                {apt.note}
              </p>
            </div>
          )}
          {apt.cancelReason && (
            <div style={{ gridColumn: '1/-1', backgroundColor: '#fef2f2', padding: '8px 10px', borderRadius: '6px', border: '1px solid #fca5a5' }}>
              <p style={{ fontSize: '10px', color: '#9ca3af', margin: '0 0 2px', textTransform: 'uppercase' }}>Lý do hủy</p>
              <p style={{ fontSize: '13px', color: '#dc2626', margin: 0 }}>{apt.cancelReason}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Status filter pills ──────────────────────────────────────

const STATUS_ORDER = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'ABSENT', 'CANCELLED']

function StatusFilter({ value, counts, onChange }: {
  value:    string
  counts:   Record<string, number>
  onChange: (s: string) => void
}) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      <button onClick={() => onChange('')} style={{
        padding: '5px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: 600,
        border:           `1.5px solid ${value === '' ? '#3b82f6' : '#e5e7eb'}`,
        backgroundColor:  value === '' ? '#eff6ff' : 'white',
        color:            value === '' ? '#2563eb' : '#6b7280',
        cursor: 'pointer',
      }}>
        Tất cả {total > 0 && `(${total})`}
      </button>
      {STATUS_ORDER.map(st => {
        const cnt  = counts[st] ?? 0
        if (!cnt && value !== st) return null
        const meta = STATUS_META[st]
        const active = value === st
        return (
          <button key={st} onClick={() => onChange(active ? '' : st)} style={{
            padding: '5px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: 600,
            border:          `1.5px solid ${active ? meta.color : '#e5e7eb'}`,
            backgroundColor: active ? meta.bg : 'white',
            color:           active ? meta.color : '#6b7280',
            cursor: 'pointer',
          }}>
            {meta.label} ({cnt})
          </button>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════

const VISIT_REASON_LABEL: Record<string, string> = {
  NEW_EXAM: 'Khám mới', REVISIT: 'Tái khám', TREATMENT: 'Điều trị theo kế hoạch',
  SCALING: 'Cạo vôi răng', BRACES: 'Niềng răng', WHITENING: 'Tẩy trắng răng',
  PAYMENT: 'Thanh toán công nợ', PICKUP: 'Lấy hồ sơ', CONSULTATION: 'Tư vấn', OTHER: 'Khác',
}

const REC_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  WAITING:         { label: 'Chờ vào ghế',    color: '#d97706', bg: '#fffbeb' },
  IN_TREATMENT:    { label: 'Đang điều trị',   color: '#7c3aed', bg: '#f5f3ff' },
  WAITING_PAYMENT: { label: 'Chờ thanh toán',  color: '#0891b2', bg: '#ecfeff' },
  COMPLETED:       { label: 'Hoàn tất',        color: '#059669', bg: '#ecfdf5' },
  ABSENT:          { label: 'Vắng mặt',        color: '#6b7280', bg: '#f3f4f6' },
  CANCELLED:       { label: 'Đã hủy',          color: '#dc2626', bg: '#fff1f2' },
}

function WalkInCard({ rec }: { rec: TodayReception }) {
  const meta = REC_STATUS_META[rec.status] ?? { label: rec.status, color: '#6b7280', bg: '#f3f4f6' }
  const arrivedTime = new Date(rec.arrivedAt)
  const timeStr = `${pad2(arrivedTime.getHours())}:${pad2(arrivedTime.getMinutes())}`
  return (
    <div style={{
      backgroundColor: 'white',
      border: `1.5px solid ${meta.bg}`,
      borderLeft: `4px solid ${meta.color}`,
      borderRadius: '12px',
      padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: '14px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{ textAlign: 'center', minWidth: '52px', flexShrink: 0 }}>
        <p style={{ fontSize: '18px', fontWeight: 800, color: meta.color, lineHeight: 1 }}>{timeStr}</p>
        <p style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px' }}>Check-in</p>
      </div>
      <div style={{ width: '1px', height: '48px', backgroundColor: '#f3f4f6', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
          <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>{rec.patientName}</p>
          <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 600 }}>{rec.code}</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '3px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: 600,
            color: meta.color, backgroundColor: meta.bg,
          }}>{meta.label}</span>
          <span style={{ fontSize: '11px', color: '#9ca3af', backgroundColor: '#f3f4f6', padding: '2px 7px', borderRadius: '99px' }}>
            Walk-in
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Phone size={11} /> {rec.patientPhone}
          </span>
          <span style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Stethoscope size={11} /> {VISIT_REASON_LABEL[rec.visitReason] ?? rec.visitReason}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function TodaySchedulePage() {
  const today = toLocalStr(new Date())

  const [view,        setView]        = useState<AptView>('day')
  const [refDate,     setRefDate]     = useState(today)
  const [search,      setSearch]      = useState('')
  const [statusF,     setStatusF]     = useState('')
  const [items,       setItems]       = useState<DoctorAppointment[]>([])
  const [counts,      setCounts]      = useState<Record<string, number>>({})
  const [walkIns,     setWalkIns]     = useState<TodayReception[]>([])
  const [loading,     setLoading]     = useState(false)
  const [busyId,      setBusyId]      = useState<number | null>(null)
  const [toast,       setToast]       = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [dSearch, setDSearch] = useState('')
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDSearch(search), 380)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [aptRes, recRes] = await Promise.all([
        doctorApi.getMyAppointments({
          view, date: refDate,
          status: statusF || undefined,
          search: dSearch  || undefined,
          limit: 100,
        }),
        // Only fetch walk-ins when viewing today in day view
        (view === 'day' && refDate === today)
          ? doctorApi.getTodayReceptions()
          : Promise.resolve({ data: [] as any }),
      ])
      setItems(aptRes.data.items)
      setCounts(aptRes.data.statusCounts)
      setWalkIns(Array.isArray(recRes.data) ? recRes.data : [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [view, refDate, statusF, dSearch, today])

  useEffect(() => { load() }, [load])

  // Reset refDate to today when switching views
  const switchView = (v: AptView) => { setView(v); setRefDate(today) }

  const showToast = (msg: string, type: 'success' | 'error') => setToast({ msg, type })

  const handleAction = async (id: number, next: string) => {
    setBusyId(id)
    try {
      await doctorApi.patchStatus(id, next)
      const LABELS: Record<string, string> = {
        IN_PROGRESS: 'Đã bắt đầu khám bệnh nhân',
        COMPLETED:   'Đã hoàn thành khám bệnh nhân',
      }
      showToast(LABELS[next] ?? 'Cập nhật thành công', 'success')
      load()
    } catch (e: any) {
      showToast(e.response?.data?.message ?? 'Lỗi cập nhật trạng thái', 'error')
    } finally { setBusyId(null) }
  }

  const totalApts  = Object.values(counts).reduce((a, b) => a + b, 0)
  const inProgress = (counts['IN_PROGRESS'] ?? 0) + walkIns.filter(r => r.status === 'IN_TREATMENT').length
  const checkedIn  = (counts['CHECKED_IN']  ?? 0) + walkIns.filter(r => r.status === 'WAITING').length
  const completed  = (counts['COMPLETED']   ?? 0) + walkIns.filter(r => r.status === 'COMPLETED').length

  const todayLabel = fmtDateLabel(refDate, view)
  const todayMark  = view === 'day' && isToday(refDate)

  return (
    <div style={{ maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>
            Lịch khám của tôi
          </h2>
          <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>
            Danh sách bệnh nhân và trạng thái khám trong ca làm việc
          </p>
        </div>
        <button onClick={load} disabled={loading} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 16px', borderRadius: '8px',
          border: '1.5px solid #e5e7eb', backgroundColor: 'white',
          color: '#374151', fontWeight: 600, fontSize: '13px',
          cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
        }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Làm mới
        </button>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: 'Tổng lịch hẹn',  value: totalApts,   color: '#3b82f6', bg: '#eff6ff' },
          { label: 'Chờ tiếp nhận',   value: checkedIn,   color: '#0891b2', bg: '#ecfeff' },
          { label: 'Đang khám',       value: inProgress,  color: '#a855f7', bg: '#faf5ff' },
          { label: 'Đã hoàn thành',   value: completed,   color: '#22c55e', bg: '#f0fdf4' },
        ].map(s => (
          <div key={s.label} style={{
            backgroundColor: 'white', borderRadius: '10px', padding: '14px 16px',
            border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '18px', fontWeight: 800, color: s.color }}>{s.value}</span>
            </div>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, lineHeight: 1.3 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── View switcher + date navigation ── */}
      <div style={{
        backgroundColor: 'white', borderRadius: '12px', padding: '12px 16px',
        border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
      }}>
        {/* View tabs */}
        <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f3f4f6', borderRadius: '8px', padding: '3px' }}>
          {([
            { key: 'day',   label: 'Hôm nay',  icon: <Clock size={13} /> },
            { key: 'week',  label: 'Tuần',      icon: <Calendar size={13} /> },
            { key: 'month', label: 'Tháng',     icon: <CalendarDays size={13} /> },
          ] as const).map(v => (
            <button key={v.key} onClick={() => switchView(v.key)} style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '6px 14px', borderRadius: '6px', border: 'none',
              cursor: 'pointer', fontSize: '12px', fontWeight: 600,
              backgroundColor: view === v.key ? 'white' : 'transparent',
              color:           view === v.key ? '#111827' : '#6b7280',
              boxShadow:       view === v.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>

        {/* Date navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setRefDate(d => shiftDate(d, view, -1))} style={{
            width: '30px', height: '30px', border: '1.5px solid #e5e7eb',
            borderRadius: '7px', backgroundColor: 'white', display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <ChevronLeft size={15} color="#374151" />
          </button>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>
              {todayLabel}
              {todayMark && (
                <span style={{
                  marginLeft: '8px', fontSize: '10px', fontWeight: 700,
                  padding: '2px 7px', borderRadius: '20px',
                  backgroundColor: '#3b82f6', color: 'white',
                }}>
                  HÔM NAY
                </span>
              )}
            </p>
          </div>
          <button onClick={() => setRefDate(d => shiftDate(d, view, +1))} style={{
            width: '30px', height: '30px', border: '1.5px solid #e5e7eb',
            borderRadius: '7px', backgroundColor: 'white', display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <ChevronRight size={15} color="#374151" />
          </button>
          {!isToday(refDate) && view === 'day' && (
            <button onClick={() => setRefDate(today)} style={{
              padding: '5px 12px', borderRadius: '7px', border: '1.5px solid #3b82f6',
              backgroundColor: 'white', color: '#3b82f6',
              fontWeight: 600, fontSize: '12px', cursor: 'pointer',
            }}>
              Hôm nay
            </button>
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
          <Search size={13} color="#9ca3af" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text" value={search}
            placeholder="Tìm bệnh nhân, mã lịch hẹn, SĐT..."
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px 8px 30px',
              border: '1.5px solid #e5e7eb', borderRadius: '8px',
              fontSize: '13px', outline: 'none', boxSizing: 'border-box',
              backgroundColor: 'white',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = '#3b82f6')}
            onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')}
          />
        </div>
        {/* Clear */}
        {(search || statusF) && (
          <button onClick={() => { setSearch(''); setStatusF('') }} style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '7px 12px', borderRadius: '8px',
            border: '1.5px solid #e5e7eb', backgroundColor: 'white',
            color: '#6b7280', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
          }}>
            <X size={12} /> Xóa lọc
          </button>
        )}
      </div>

      {/* Status filter pills */}
      <StatusFilter value={statusF} counts={counts} onChange={setStatusF} />

      {/* ── Appointment list ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
          <Loader2 size={28} color="#3b82f6" style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 10px' }} />
          <p style={{ fontSize: '13px', margin: 0 }}>Đang tải danh sách...</p>
        </div>
      ) : items.length === 0 ? (
        <div style={{
          backgroundColor: 'white', borderRadius: '12px', padding: '56px 32px',
          border: '1px solid #f3f4f6', textAlign: 'center',
        }}>
          <FileText size={40} color="#d1d5db" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: '15px', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>
            Không có lịch hẹn nào
          </p>
          <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>
            {search || statusF
              ? 'Thử thay đổi bộ lọc tìm kiếm'
              : view === 'day' ? 'Bạn không có lịch hẹn nào trong ngày này'
              : view === 'week' ? 'Không có lịch hẹn nào trong tuần này'
              : 'Không có lịch hẹn nào trong tháng này'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Priority section: CHECKED_IN + IN_PROGRESS first */}
          {(() => {
            const priority  = items.filter(a => ['CHECKED_IN', 'IN_PROGRESS'].includes(a.status))
            const rest      = items.filter(a => !['CHECKED_IN', 'IN_PROGRESS'].includes(a.status))
            const groups    = priority.length > 0 ? [
              { title: '🔔 Cần xử lý', list: priority },
              { title: 'Lịch hẹn khác', list: rest },
            ] : [{ title: '', list: rest }]

            return groups.filter(g => g.list.length > 0).map(grp => (
              <div key={grp.title}>
                {grp.title && (
                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {grp.title}
                  </p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {grp.list.map(apt => (
                    <AptCard
                      key={apt.id}
                      apt={apt}
                      busy={busyId === apt.id}
                      onAction={handleAction}
                      view={view}
                    />
                  ))}
                </div>
              </div>
            ))
          })()}

          {/* Summary footer */}
          <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', margin: '4px 0 0' }}>
            Hiển thị {items.length} lịch hẹn
          </p>
        </div>
      )}

      {/* ── Walk-in patients (tiếp đón không có lịch hẹn) ── */}
      {view === 'day' && refDate === today && walkIns.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0 10px' }}>
            <User size={14} color="#7c3aed" />
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#7c3aed', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Bệnh nhân tiếp đón hôm nay ({walkIns.length})
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {walkIns.map(rec => <WalkInCard key={rec.id} rec={rec} />)}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
