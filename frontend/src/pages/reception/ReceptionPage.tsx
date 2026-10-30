import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Users, RefreshCw, Plus, Search, Clock, CheckCircle2,
  AlertTriangle, Armchair, UserCheck, ChevronDown, X,
  Stethoscope, CreditCard, Ban, Phone, Tag, Edit2
} from 'lucide-react'
import { receptionApi } from '../../api/reception.api'
import type { ReceptionItem, ChairStatus, QueueStats, DoctorOption } from '../../api/reception.api'
import QuickCheckInModal from './QuickCheckInModal'
import ReceptionDetailModal from './ReceptionDetailModal'

// ─── Constants ────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  WAITING:           { label: 'Chờ vào ghế',    color: '#d97706', bg: '#fffbeb', icon: <Clock size={12} /> },
  IN_TREATMENT:      { label: 'Đang điều trị',   color: '#7c3aed', bg: '#f5f3ff', icon: <Stethoscope size={12} /> },
  WAITING_PAYMENT:   { label: 'Chờ thanh toán',  color: '#0891b2', bg: '#ecfeff', icon: <CreditCard size={12} /> },
  COMPLETED:         { label: 'Hoàn tất',         color: '#059669', bg: '#ecfdf5', icon: <CheckCircle2 size={12} /> },
  CONSULTATION_ONLY: { label: 'Chỉ tư vấn',      color: '#2563eb', bg: '#eff6ff', icon: <UserCheck size={12} /> },
  ABSENT:            { label: 'Vắng mặt',         color: '#6b7280', bg: '#f3f4f6', icon: <X size={12} /> },
  CANCELLED:         { label: 'Đã hủy',           color: '#dc2626', bg: '#fff1f2', icon: <Ban size={12} /> },
}

const CHAIR_STATUS_META = {
  EMPTY:        { label: 'Trống',        color: '#059669', bg: '#ecfdf5' },
  ASSIGNED:     { label: 'Đã phân công', color: '#d97706', bg: '#fffbeb' },
  IN_TREATMENT: { label: 'Đang dùng',    color: '#7c3aed', bg: '#f5f3ff' },
}

const CLASSIFICATION_META: Record<string, { label: string; color: string }> = {
  NEW:      { label: 'Mới',     color: '#6b7280' },
  RETURNING:{ label: 'Thường',  color: '#2563eb' },
  VIP:      { label: 'VIP',     color: '#d97706' },
  SPECIAL:  { label: 'Đặc biệt',color: '#dc2626' },
}

const ACTIVE_STATUSES = ['WAITING', 'IN_TREATMENT', 'WAITING_PAYMENT']

// ─── Status Badge ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, color: '#6b7280', bg: '#f3f4f6', icon: null }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600,
      color: m.color, backgroundColor: m.bg,
    }}>
      {m.icon}{m.label}
    </span>
  )
}

// ─── Classification Badge ─────────────────────────────────────

function ClassBadge({ cls }: { cls: string }) {
  const m = CLASSIFICATION_META[cls] ?? { label: cls, color: '#6b7280' }
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
      border: `1px solid ${m.color}`, color: m.color, whiteSpace: 'nowrap',
    }}>
      {m.label}
    </span>
  )
}

// ─── Stats Bar ────────────────────────────────────────────────

function StatsBar({ stats }: { stats: QueueStats }) {
  const cards = [
    { label: 'Chờ vào ghế',   value: stats.waiting,        color: '#d97706', bg: '#fffbeb' },
    { label: 'Đang điều trị', value: stats.inTreatment,    color: '#7c3aed', bg: '#f5f3ff' },
    { label: 'Chờ thanh toán',value: stats.waitingPayment,  color: '#0891b2', bg: '#ecfeff' },
    { label: 'Hoàn tất',       value: stats.completed,      color: '#059669', bg: '#ecfdf5' },
    { label: 'Tổng cộng',      value: stats.total,          color: '#374151', bg: '#f9fafb' },
  ]
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
      {cards.map(c => (
        <div key={c.label} style={{
          flex: '1 1 100px', minWidth: 100,
          backgroundColor: c.bg, borderRadius: 10, padding: '12px 16px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: c.color }}>{c.value}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{c.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Chair Panel ──────────────────────────────────────────────

function ChairPanel({ chairs }: { chairs: ChairStatus[] }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Armchair size={16} /> Ghế khám
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
        {chairs.map(chair => {
          const m = CHAIR_STATUS_META[chair.status] ?? CHAIR_STATUS_META.EMPTY
          return (
            <div key={chair.id} style={{
              border: `2px solid ${m.color}`,
              borderRadius: 10, padding: '12px 14px',
              backgroundColor: m.bg,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: m.color }}>
                  {chair.name}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: m.color }}>{m.label}</span>
              </div>
              {chair.currentReception ? (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {chair.currentReception.patientName}
                  </div>
                  {chair.currentReception.doctorName && (
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                      BS: {chair.currentReception.doctorName}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>—</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Queue Filter Tabs ────────────────────────────────────────

type FilterTab = 'ALL' | 'WAITING' | 'IN_TREATMENT' | 'WAITING_PAYMENT' | 'DONE'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'ALL',             label: 'Tất cả'          },
  { key: 'WAITING',         label: 'Chờ vào ghế'     },
  { key: 'IN_TREATMENT',    label: 'Đang điều trị'   },
  { key: 'WAITING_PAYMENT', label: 'Chờ thanh toán'  },
  { key: 'DONE',            label: 'Hoàn tất / Hủy'  },
]

// ─── Queue Row ────────────────────────────────────────────────

function QueueRow({
  rec, onSelect, doctors, chairs, onStatusChange, onAssign,
}: {
  rec: ReceptionItem
  onSelect: (rec: ReceptionItem) => void
  doctors: DoctorOption[]
  chairs: ChairStatus[]
  onStatusChange: (id: number, status: string) => void
  onAssign: (id: number, chairId: number | null, doctorId: number | null) => void
}) {
  const [showActions,   setShowActions]   = useState(false)
  const [showAssign,    setShowAssign]    = useState(false)
  const [selChair,      setSelChair]      = useState(rec.chair?.id?.toString() ?? '')
  const [selDoctor,     setSelDoctor]     = useState(rec.doctor?.id?.toString() ?? '')
  const [assigning,     setAssigning]     = useState(false)

  const isActive = ACTIVE_STATUSES.includes(rec.status)

  const NEXT_ACTIONS: { label: string; status: string; color: string }[] = rec.status === 'WAITING'
    ? [
        { label: 'Vào ghế → Điều trị', status: 'IN_TREATMENT',      color: '#7c3aed' },
        { label: 'Chỉ tư vấn',          status: 'CONSULTATION_ONLY', color: '#2563eb' },
        { label: 'Vắng mặt',            status: 'ABSENT',            color: '#6b7280' },
        { label: 'Hủy lượt',            status: 'CANCELLED',         color: '#dc2626' },
      ]
    : rec.status === 'IN_TREATMENT'
    ? [
        { label: 'Chuyển chờ thanh toán', status: 'WAITING_PAYMENT', color: '#0891b2' },
        { label: 'Hoàn tất',              status: 'COMPLETED',        color: '#059669' },
      ]
    : rec.status === 'WAITING_PAYMENT'
    ? [{ label: 'Hoàn tất', status: 'COMPLETED', color: '#059669' }]
    : []

  const handleAssign = async () => {
    setAssigning(true)
    try {
      await onAssign(rec.id, selChair ? Number(selChair) : null, selDoctor ? Number(selDoctor) : null)
      setShowAssign(false)
      setShowActions(false)
    } finally {
      setAssigning(false)
    }
  }

  const arrivedTime = new Date(rec.arrivedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  const canAssign = isActive

  return (
    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
      {/* STT + Code */}
      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#1f2937' }}>
          {rec.queuePosition ?? '—'}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{rec.code}</div>
      </td>

      {/* Bệnh nhân */}
      <td style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: '#1f2937' }}>
            {rec.patient.fullName}
          </span>
          <ClassBadge cls={rec.patient.classification} />
          {rec.patient.allergies && (
            <span title={`Dị ứng: ${rec.patient.allergies}`} style={{ color: '#dc2626', cursor: 'default' }}>
              <AlertTriangle size={13} />
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Phone size={10} />{rec.patient.phone}
          <span style={{ margin: '0 4px' }}>·</span>
          <span style={{ fontFamily: 'monospace' }}>{rec.patient.code}</span>
        </div>
        {rec.appointment && (
          <div style={{ fontSize: 11, color: '#2563eb', marginTop: 2 }}>
            📅 {rec.appointment.service.name}
          </div>
        )}
      </td>

      {/* Giờ đến + lý do */}
      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
        <div style={{ fontSize: 13, color: '#374151' }}>{arrivedTime}</div>
        <div style={{ fontSize: 11, color: '#9ca3af' }}>{rec.visitReason}</div>
      </td>

      {/* Ghế / Bác sĩ */}
      <td style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 12, color: '#374151' }}>
          {rec.chair ? rec.chair.name : <span style={{ color: '#9ca3af' }}>—</span>}
        </div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          {rec.doctor ? `BS. ${rec.doctor.fullName}` : <span style={{ color: '#9ca3af' }}>Chưa phân công</span>}
        </div>
      </td>

      {/* Trạng thái */}
      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
        <StatusBadge status={rec.status} />
      </td>

      {/* Actions */}
      <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button
            onClick={() => onSelect(rec)}
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 12,
              border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer',
              color: '#374151', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Edit2 size={12} /> Chi tiết
          </button>

          {(NEXT_ACTIONS.length > 0 || canAssign) && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setShowActions(p => !p); setShowAssign(false) }}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 12,
                  border: '1px solid #6366f1', background: '#6366f1',
                  cursor: 'pointer', color: '#fff',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                Cập nhật <ChevronDown size={12} />
              </button>

              {showActions && (
                <div style={{
                  position: 'absolute', right: 0, top: 30, zIndex: 100,
                  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 220,
                  overflow: 'hidden',
                }}>
                  {/* Phân ghế / BS — luôn hiển thị khi còn active */}
                  {canAssign && (
                    <>
                      <button
                        onClick={() => setShowAssign(p => !p)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          width: '100%', padding: '9px 14px', background: showAssign ? '#f5f3ff' : 'none',
                          border: 'none', fontSize: 13, cursor: 'pointer',
                          color: '#6366f1', fontWeight: 700,
                          borderBottom: '1px solid #f3f4f6',
                        }}
                        onMouseEnter={e => { if (!showAssign) e.currentTarget.style.backgroundColor = '#f9fafb' }}
                        onMouseLeave={e => { if (!showAssign) e.currentTarget.style.backgroundColor = 'transparent' }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Armchair size={13} /> Phân ghế / Bác sĩ
                        </span>
                        <ChevronDown size={12} style={{ transform: showAssign ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                      </button>

                      {/* Inline assign panel */}
                      {showAssign && (
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
                          {/* Chair select */}
                          <div style={{ marginBottom: 8 }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>
                              Ghế khám
                            </label>
                            <select
                              value={selChair}
                              onChange={e => setSelChair(e.target.value)}
                              style={{
                                width: '100%', padding: '6px 8px', borderRadius: 6,
                                border: '1px solid #d1d5db', fontSize: 12, outline: 'none',
                                background: '#fff',
                              }}
                            >
                              <option value="">— Chưa chọn ghế —</option>
                              {chairs.map(c => (
                                <option
                                  key={c.id}
                                  value={c.id}
                                  disabled={c.status !== 'EMPTY' && c.id !== rec.chair?.id}
                                >
                                  {c.name}
                                  {c.status === 'EMPTY' ? ' (Trống)' : c.id === rec.chair?.id ? ' (Hiện tại)' : ' (Đã dùng)'}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Doctor select */}
                          <div style={{ marginBottom: 10 }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>
                              Bác sĩ
                            </label>
                            <select
                              value={selDoctor}
                              onChange={e => setSelDoctor(e.target.value)}
                              style={{
                                width: '100%', padding: '6px 8px', borderRadius: 6,
                                border: '1px solid #d1d5db', fontSize: 12, outline: 'none',
                                background: '#fff',
                              }}
                            >
                              <option value="">— Chưa chọn BS —</option>
                              {doctors.map(d => (
                                <option key={d.id} value={d.id}>
                                  BS. {d.fullName}{d.isScheduledToday ? ' ✓' : ''}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            onClick={handleAssign}
                            disabled={assigning || (!selChair && !selDoctor)}
                            style={{
                              width: '100%', padding: '7px', borderRadius: 6,
                              background: assigning || (!selChair && !selDoctor) ? '#a5b4fc' : '#6366f1',
                              color: '#fff', border: 'none', fontSize: 12,
                              fontWeight: 700, cursor: assigning || (!selChair && !selDoctor) ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {assigning ? 'Đang lưu...' : 'Xác nhận phân công'}
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {/* Status actions */}
                  {NEXT_ACTIONS.map(a => (
                    <button
                      key={a.status}
                      onClick={() => { setShowActions(false); onStatusChange(rec.id, a.status) }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '8px 14px', background: 'none', border: 'none',
                        fontSize: 13, cursor: 'pointer', color: a.color, fontWeight: 600,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

// ─── Main Page ────────────────────────────────────────────────

export default function ReceptionPage() {
  const [queue,     setQueue]     = useState<ReceptionItem[]>([])
  const [chairs,    setChairs]    = useState<ChairStatus[]>([])
  const [stats,     setStats]     = useState<QueueStats>({ waiting: 0, inTreatment: 0, waitingPayment: 0, completed: 0, total: 0 })
  const [doctors,   setDoctors]   = useState<DoctorOption[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState<FilterTab>('ALL')
  const [search,    setSearch]    = useState('')
  const [showCheckIn,  setShowCheckIn]  = useState(false)
  const [selectedRec,  setSelectedRec]  = useState<ReceptionItem | null>(null)
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [queueData, docData] = await Promise.all([
        receptionApi.getTodayQueue(),
        receptionApi.getDoctors(),
      ])
      setQueue(queueData.queue)
      setChairs(queueData.chairs)
      setStats(queueData.stats)
      setDoctors(docData)
    } catch (err) {
      console.error('Lỗi tải hàng chờ:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    // Auto-refresh mỗi 30 giây
    refreshRef.current = setInterval(fetchData, 30_000)
    return () => { if (refreshRef.current) clearInterval(refreshRef.current) }
  }, [fetchData])

  const handleStatusChange = async (id: number, status: string) => {
    try {
      const updated = await receptionApi.updateStatus(id, { status })
      setQueue(q => q.map(r => r.id === id ? updated : r))
      fetchData()
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Lỗi cập nhật trạng thái')
    }
  }

  const handleAssign = async (id: number, chairId: number | null, doctorId: number | null) => {
    try {
      const updated = await receptionApi.assign(id, { chairId, doctorId })
      setQueue(q => q.map(r => r.id === id ? updated : r))
      fetchData()
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Lỗi phân công ghế')
    }
  }

  const handleCheckInSuccess = () => {
    setShowCheckIn(false)
    fetchData()
  }

  // Filter
  const DONE_STATUSES = ['COMPLETED', 'CONSULTATION_ONLY', 'ABSENT', 'CANCELLED']
  const filtered = queue.filter(r => {
    const matchFilter =
      filter === 'ALL'             ? true
      : filter === 'DONE'          ? DONE_STATUSES.includes(r.status)
      : r.status === filter

    const matchSearch = !search.trim()
      || r.patient.fullName.toLowerCase().includes(search.toLowerCase())
      || r.patient.phone.includes(search)
      || r.patient.code.toLowerCase().includes(search.toLowerCase())
      || r.code.toLowerCase().includes(search.toLowerCase())

    return matchFilter && matchSearch
  })

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1f2937', margin: 0 }}>
            Tiếp đón &amp; Hàng chờ
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
            {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={fetchData}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8, fontSize: 13,
              border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#374151',
            }}
          >
            <RefreshCw size={14} /> Làm mới
          </button>
          <button
            onClick={() => setShowCheckIn(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer',
            }}
          >
            <Plus size={16} /> Check-in nhanh
          </button>
        </div>
      </div>

      {/* Stats */}
      <StatsBar stats={stats} />

      {/* Chair panel */}
      <ChairPanel chairs={chairs} />

      {/* Queue table */}
      <div style={{
        background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
        overflow: 'hidden',
      }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 18px', borderBottom: '1px solid #f3f4f6', gap: 12, flexWrap: 'wrap',
        }}>
          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 4 }}>
            {FILTER_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                  background: filter === t.key ? '#6366f1' : '#f3f4f6',
                  color:      filter === t.key ? '#fff'    : '#6b7280',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tên, SĐT, mã BN..."
              style={{
                paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
                borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13,
                outline: 'none', width: 220,
              }}
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
            <div style={{ marginTop: 8 }}>Đang tải...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }}>
            <Users size={40} style={{ opacity: 0.3, marginBottom: 8 }} />
            <div>Không có bệnh nhân trong hàng chờ</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>STT</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Bệnh nhân</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Giờ / Lý do</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Ghế / BS</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Trạng thái</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(rec => (
                  <QueueRow
                    key={rec.id}
                    rec={rec}
                    doctors={doctors}
                    chairs={chairs}
                    onSelect={setSelectedRec}
                    onStatusChange={handleStatusChange}
                    onAssign={handleAssign}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCheckIn && (
        <QuickCheckInModal
          onClose={() => setShowCheckIn(false)}
          onSuccess={handleCheckInSuccess}
          doctors={doctors}
          chairs={chairs}
        />
      )}

      {selectedRec && (
        <ReceptionDetailModal
          rec={selectedRec}
          doctors={doctors}
          chairs={chairs}
          onClose={() => setSelectedRec(null)}
          onUpdated={(updated) => {
            setQueue(q => q.map(r => r.id === updated.id ? updated : r))
            setSelectedRec(updated)
            fetchData()
          }}
        />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
