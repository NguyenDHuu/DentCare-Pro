import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, UserPlus, MoreHorizontal, Eye, Pencil, UserX,
  ChevronLeft, ChevronRight, AlertTriangle, RefreshCw, CalendarPlus,
} from 'lucide-react'
import { patientsApi, CLASSIFICATION_META, type PatientRow, type AppointmentHit } from '../../api/patients.api'
import { useAuthStore } from '../../stores/auth.store'

// ─── Design tokens ────────────────────────────────────────────

const card: React.CSSProperties = {
  backgroundColor: 'white', borderRadius: '14px',
  border: '1px solid #e5e7eb', padding: '0',
}
const th: React.CSSProperties = {
  padding: '11px 16px', textAlign: 'left', fontSize: '12px',
  fontWeight: 600, color: '#6b7280', textTransform: 'uppercase',
  letterSpacing: '0.04em', borderBottom: '1px solid #f3f4f6',
  backgroundColor: '#f9fafb', whiteSpace: 'nowrap',
}
const td: React.CSSProperties = {
  padding: '14px 16px', fontSize: '13px', color: '#374151',
  borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle',
}

// ─── Classification badge ─────────────────────────────────────

function ClassBadge({ cls }: { cls: string }) {
  const m = CLASSIFICATION_META[cls] ?? { label: cls, color: '#6b7280', bg: '#f3f4f6' }
  return (
    <span style={{
      padding: '3px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: 600,
      color: m.color, backgroundColor: m.bg, whiteSpace: 'nowrap',
    }}>
      {m.label}
    </span>
  )
}

// ─── Row actions dropdown ─────────────────────────────────────

function RowMenu({
  patient, onView, onEdit, onDeactivate, canEdit,
}: {
  patient: PatientRow
  onView:       () => void
  onEdit:       () => void
  onDeactivate: () => void
  canEdit:      boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: '6px',
          backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center',
        }}
      >
        <MoreHorizontal size={15} color="#6b7280" />
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: '4px',
          backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '10px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.10)', zIndex: 50, minWidth: '170px', padding: '4px',
        }}>
          {[
            { icon: Eye,     label: 'Xem hồ sơ',   action: onView,  color: '#374151', always: true },
            { icon: Pencil,  label: 'Chỉnh sửa',    action: onEdit,  color: '#374151', always: false },
          ].filter(item => item.always || canEdit).map(item => (
            <button
              key={item.label}
              onClick={() => { item.action(); setOpen(false) }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                padding: '9px 12px', border: 'none', background: 'none',
                cursor: 'pointer', borderRadius: '7px', fontSize: '13px', color: item.color,
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f9fafb')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <item.icon size={14} /> {item.label}
            </button>
          ))}
          {canEdit && patient.isActive && (
            <>
              <div style={{ height: '1px', backgroundColor: '#f3f4f6', margin: '4px 0' }} />
              <button
                onClick={() => { onDeactivate(); setOpen(false) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '9px 12px', border: 'none', background: 'none',
                  cursor: 'pointer', borderRadius: '7px', fontSize: '13px', color: '#dc2626',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fff1f2')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <UserX size={14} /> Vô hiệu hóa
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Appointment hint card (A4) ───────────────────────────────

function AppointmentHintCard({
  hit, onRegister, canRegister,
}: {
  hit: AppointmentHit
  onRegister: () => void
  canRegister: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '12px 16px', backgroundColor: '#fffbeb', border: '1px solid #fde68a',
      borderRadius: '10px', marginBottom: '8px',
    }}>
      <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#92400e' }}>
          Lịch hẹn chưa có hồ sơ bệnh nhân: <strong>{hit.patientName}</strong> – {hit.patientPhone}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#b45309' }}>
          Mã: {hit.code} · {new Date(hit.appointmentDate + 'T12:00:00').toLocaleDateString('vi-VN')}
        </p>
      </div>
      {canRegister && (
        <button
          onClick={onRegister}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '6px 14px', borderRadius: '7px', border: 'none',
            backgroundColor: '#d97706', color: 'white', fontSize: '12px',
            fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          <UserPlus size={13} /> Tạo hồ sơ
        </button>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────

export default function PatientListPage() {
  const navigate = useNavigate()
  const { activeRole } = useAuthStore()
  const isReceptionist = activeRole === 'RECEPTIONIST' || activeRole === 'ADMIN'
  const [q,             setQ]             = useState('')
  const [debouncedQ,    setDebouncedQ]    = useState('')
  const [page,          setPage]          = useState(1)
  const [patients,      setPatients]      = useState<PatientRow[]>([])
  const [total,         setTotal]         = useState(0)
  const [totalPages,    setTotalPages]    = useState(1)
  const [apptHits,      setApptHits]      = useState<AppointmentHit[]>([])
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState('')

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [q])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await patientsApi.list({ q: debouncedQ, page, limit: 20 })
      setPatients(res.data.patients)
      setTotal(res.data.total)
      setTotalPages(res.data.totalPages)
      setApptHits(res.data.appointmentHits)
    } catch {
      setError('Không thể tải danh sách. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }, [debouncedQ, page])

  useEffect(() => { load() }, [load])

  const handleDeactivate = async (id: number, name: string) => {
    if (!confirm(`Vô hiệu hóa hồ sơ của "${name}"? Hành động này có thể khôi phục sau.`)) return
    try {
      await patientsApi.deactivate(id)
      load()
    } catch { alert('Không thể vô hiệu hóa. Vui lòng thử lại.') }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1200px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: 0 }}>Quản lý Bệnh nhân</h1>
          <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
            Tra cứu, tìm kiếm và quản lý hồ sơ bệnh nhân nha khoa.
          </p>
        </div>
        {isReceptionist && (
          <button
            onClick={() => navigate('/staff/patients/new')}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '10px 20px', borderRadius: '9px', border: 'none',
              backgroundColor: '#2563eb', color: 'white', fontWeight: 600,
              fontSize: '13px', cursor: 'pointer',
            }}
          >
            <UserPlus size={15} /> Đăng ký mới
          </button>
        )}
      </div>

      {/* A4: Appointment hints — visible to all, but "Tạo hồ sơ" only for receptionist/admin */}
      {apptHits.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          {apptHits.map(hit => (
            <AppointmentHintCard
              key={hit.id}
              hit={hit}
              canRegister={isReceptionist}
              onRegister={() => navigate(`/staff/patients/new?appointmentId=${hit.id}`)}
            />
          ))}
        </div>
      )}

      {/* Search bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Tìm theo Tên, SĐT, CCCD, Mã BN..."
            style={{
              width: '100%', padding: '10px 12px 10px 36px',
              border: '1.5px solid #e5e7eb', borderRadius: '9px',
              fontSize: '13px', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <button
          onClick={load}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '10px 16px', border: '1.5px solid #e5e7eb',
            borderRadius: '9px', backgroundColor: 'white', cursor: 'pointer',
            fontSize: '13px', color: '#374151',
          }}
        >
          <RefreshCw size={14} /> Làm mới
        </button>
      </div>

      {/* E1: query too short warning */}
      {q.length === 1 && (
        <p style={{ fontSize: '12px', color: '#f59e0b', marginBottom: '12px' }}>
          Nhập ít nhất 2 ký tự để tìm kiếm.
        </p>
      )}

      {/* Table */}
      <div style={card}>
        {error ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#ef4444', fontSize: '13px' }}>{error}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Mã BN', 'Họ tên', 'Ngày sinh', 'Số điện thoại', 'Phân loại', 'Lần khám gần nhất', 'Thao tác'].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ ...td, textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                    Đang tải...
                  </td></tr>
                ) : patients.length === 0 ? (
                  <tr><td colSpan={7} style={{ ...td, textAlign: 'center', padding: '48px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                        Không tìm thấy bệnh nhân
                      </p>
                      {debouncedQ && (
                        <button
                          onClick={() => navigate('/staff/patients/new')}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 16px', borderRadius: '8px', border: 'none',
                            backgroundColor: '#2563eb', color: 'white', fontSize: '13px',
                            fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          <UserPlus size={14} /> Đăng ký bệnh nhân mới
                        </button>
                      )}
                    </div>
                  </td></tr>
                ) : patients.map(p => (
                  <tr
                    key={p.id}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => navigate(`/staff/patients/${p.id}`)}
                          style={{
                            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                            color: '#2563eb', fontWeight: 600, fontSize: '13px',
                          }}
                        >
                          {p.code}
                        </button>
                        {!p.isComplete && (
                          <span style={{
                            fontSize: '10px', fontWeight: 600, padding: '2px 6px',
                            borderRadius: '4px', backgroundColor: '#fff3cd', color: '#856404',
                          }}>Chưa đầy đủ</span>
                        )}
                        {!p.isActive && (
                          <span style={{
                            fontSize: '10px', fontWeight: 600, padding: '2px 6px',
                            borderRadius: '4px', backgroundColor: '#f3f4f6', color: '#6b7280',
                          }}>Vô hiệu</span>
                        )}
                      </div>
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                          backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#2563eb',
                        }}>
                          {p.fullName.charAt(0)}
                        </div>
                        <span style={{ fontWeight: 500 }}>{p.fullName}</span>
                      </div>
                    </td>
                    <td style={td}>{new Date(p.dateOfBirth).toLocaleDateString('vi-VN')}</td>
                    <td style={td}>{p.phone}</td>
                    <td style={td}><ClassBadge cls={p.classification} /></td>
                    <td style={td}>
                      {p.lastVisit
                        ? new Date(p.lastVisit).toLocaleDateString('vi-VN')
                        : <span style={{ color: '#9ca3af' }}>Chưa có</span>}
                    </td>
                    <td style={td}>
                      <RowMenu
                        patient={p}
                        canEdit={isReceptionist}
                        onView={() => navigate(`/staff/patients/${p.id}`)}
                        onEdit={() => navigate(`/staff/patients/${p.id}?edit=1`)}
                        onDeactivate={() => handleDeactivate(p.id, p.fullName)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
          {loading ? 'Đang tải...' : `Hiển thị ${patients.length} / ${total} kết quả`}
        </p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            style={{
              padding: '7px 14px', border: '1px solid #e5e7eb', borderRadius: '7px',
              backgroundColor: page <= 1 ? '#f9fafb' : 'white', cursor: page <= 1 ? 'default' : 'pointer',
              color: page <= 1 ? '#9ca3af' : '#374151', fontSize: '13px',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            <ChevronLeft size={14} /> Trước
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = totalPages <= 7 ? i + 1
              : page <= 4 ? i + 1
              : page >= totalPages - 3 ? totalPages - 6 + i
              : page - 3 + i
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                style={{
                  width: '34px', height: '34px', borderRadius: '7px', border: '1px solid #e5e7eb',
                  backgroundColor: page === p ? '#2563eb' : 'white',
                  color: page === p ? 'white' : '#374151',
                  fontWeight: page === p ? 700 : 400, fontSize: '13px', cursor: 'pointer',
                }}
              >
                {p}
              </button>
            )
          })}
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            style={{
              padding: '7px 14px', border: '1px solid #e5e7eb', borderRadius: '7px',
              backgroundColor: page >= totalPages ? '#f9fafb' : 'white',
              cursor: page >= totalPages ? 'default' : 'pointer',
              color: page >= totalPages ? '#9ca3af' : '#374151', fontSize: '13px',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            Tiếp <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
