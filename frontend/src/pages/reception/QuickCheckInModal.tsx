import React, { useState, useEffect, useRef } from 'react'
import { X, Search, AlertTriangle, CheckCircle2, Clock, UserCheck, Calendar, Phone } from 'lucide-react'
import { receptionApi } from '../../api/reception.api'
import type { SearchPatientResult, DoctorOption, ChairStatus } from '../../api/reception.api'

// ─── Visit Reason options ─────────────────────────────────────

const VISIT_REASONS = [
  { value: 'NEW_EXAM',     label: 'Khám mới' },
  { value: 'REVISIT',      label: 'Tái khám' },
  { value: 'TREATMENT',    label: 'Điều trị theo kế hoạch' },
  { value: 'SCALING',      label: 'Cạo vôi răng' },
  { value: 'BRACES',       label: 'Niềng răng' },
  { value: 'WHITENING',    label: 'Tẩy trắng răng' },
  { value: 'PAYMENT',      label: 'Thanh toán công nợ' },
  { value: 'PICKUP',       label: 'Lấy hồ sơ' },
  { value: 'CONSULTATION', label: 'Tư vấn' },
  { value: 'OTHER',        label: 'Khác' },
]

const CLASS_BADGE: Record<string, { label: string; color: string }> = {
  NEW:      { label: 'Mới',        color: '#6b7280' },
  RETURNING:{ label: 'Thường',     color: '#2563eb' },
  VIP:      { label: 'VIP',        color: '#d97706' },
  SPECIAL:  { label: 'Đặc biệt',   color: '#dc2626' },
}

// ─── Step 1: Search patient ───────────────────────────────────

function Step1({
  onSelect,
}: {
  onSelect: (p: SearchPatientResult) => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchPatientResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await receptionApi.searchPatients(q)
        setResults(res)
      } catch { /* ignore */ }
      finally { setSearching(false) }
    }, 400)
  }, [q])

  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
        Tìm kiếm bệnh nhân
      </label>
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
        <input
          autoFocus
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Nhập tên, số điện thoại hoặc mã BN..."
          style={{
            width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
            borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {searching && <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 8 }}>Đang tìm kiếm…</p>}

      {results.length > 0 && (
        <div style={{ marginTop: 10, maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.map(p => {
            const cls = CLASS_BADGE[p.classification]
            const hasActive = !!p.activeReception
            return (
              <button
                key={p.id}
                onClick={() => !hasActive && onSelect(p)}
                disabled={hasActive}
                style={{
                  textAlign: 'left', padding: '12px 14px', borderRadius: 10,
                  border: hasActive ? '1px solid #fca5a5' : '1px solid #e5e7eb',
                  background: hasActive ? '#fff1f2' : '#fff',
                  cursor: hasActive ? 'not-allowed' : 'pointer',
                  opacity: hasActive ? 0.7 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#1f2937' }}>{p.fullName}</span>
                      {cls && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                          border: `1px solid ${cls.color}`, color: cls.color,
                        }}>
                          {cls.label}
                        </span>
                      )}
                      {p.allergies && (
                        <AlertTriangle size={13} style={{ color: '#dc2626' }} title={`Dị ứng: ${p.allergies}`} />
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 10 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Phone size={10} />{p.phone}</span>
                      <span style={{ fontFamily: 'monospace' }}>{p.code}</span>
                    </div>
                    {p.todayAppointment && !hasActive && (
                      <div style={{ marginTop: 4, fontSize: 11, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={10} />
                        Có lịch hẹn: {p.todayAppointment.service.name}
                        {p.todayAppointment.doctor && ` · BS. ${p.todayAppointment.doctor.fullName}`}
                      </div>
                    )}
                  </div>
                  {hasActive && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#dc2626', whiteSpace: 'nowrap' }}>
                      Đã check-in ({p.activeReception!.status})
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {q.trim().length >= 2 && !searching && results.length === 0 && (
        <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 10, textAlign: 'center' }}>
          Không tìm thấy bệnh nhân
        </p>
      )}
    </div>
  )
}

// ─── Step 2: Fill check-in form ───────────────────────────────

function Step2({
  patient,
  doctors,
  chairs,
  onBack,
  onSubmit,
  submitting,
}: {
  patient: SearchPatientResult
  doctors: DoctorOption[]
  chairs: ChairStatus[]
  onBack: () => void
  onSubmit: (data: {
    appointmentId?: number
    doctorId?: number
    chairId?: number
    visitReason: string
    adminNote?: string
  }) => void
  submitting: boolean
}) {
  const apptDoctor = patient.todayAppointment?.doctor ?? null

  const [visitReason, setVisitReason] = useState(
    patient.todayAppointment ? 'REVISIT' : 'NEW_EXAM'
  )
  const [useAppt,   setUseAppt]   = useState(!!patient.todayAppointment)
  const [doctorId,  setDoctorId]  = useState<string>(
    apptDoctor ? String(apptDoctor.id) : ''
  )
  const [chairId,   setChairId]   = useState<string>('')
  const [adminNote, setAdminNote] = useState('')

  // Khi toggle liên kết lịch hẹn → đồng bộ bác sĩ
  const handleToggleAppt = (checked: boolean) => {
    setUseAppt(checked)
    if (checked && apptDoctor) {
      setDoctorId(String(apptDoctor.id))
    } else if (!checked) {
      setDoctorId('')
    }
  }

  const availableChairs = chairs.filter(c => c.status === 'EMPTY')

  const handleSubmit = () => {
    onSubmit({
      appointmentId: useAppt && patient.todayAppointment ? patient.todayAppointment.id : undefined,
      doctorId:  doctorId  ? Number(doctorId)  : undefined,
      chairId:   chairId   ? Number(chairId)   : undefined,
      visitReason,
      adminNote: adminNote.trim() || undefined,
    })
  }

  return (
    <div>
      {/* Patient summary */}
      <div style={{
        background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
        padding: '12px 14px', marginBottom: 18,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1f2937' }}>{patient.fullName}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, display: 'flex', gap: 10 }}>
            <span><Phone size={10} style={{ verticalAlign: 'middle' }} /> {patient.phone}</span>
            <span style={{ fontFamily: 'monospace' }}>{patient.code}</span>
          </div>
          {patient.allergies && (
            <div style={{ marginTop: 6, padding: '4px 8px', background: '#fff1f2', borderRadius: 6, border: '1px solid #fca5a5', fontSize: 12, color: '#dc2626' }}>
              <AlertTriangle size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Dị ứng: {patient.allergies}
            </div>
          )}
        </div>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 12 }}>
          Đổi BN
        </button>
      </div>

      {/* Today appointment */}
      {patient.todayAppointment && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#1f2937' }}>
            <input
              type="checkbox"
              checked={useAppt}
              onChange={e => handleToggleAppt(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            Liên kết với lịch hẹn hôm nay
          </label>
          {useAppt && (
            <div style={{
              marginTop: 6, marginLeft: 24, padding: '8px 12px',
              background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe',
              fontSize: 12, color: '#1d4ed8',
            }}>
              <Calendar size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {patient.todayAppointment.service.name}
              {patient.todayAppointment.doctor && ` · BS. ${patient.todayAppointment.doctor.fullName}`}
              <span style={{ marginLeft: 8, color: '#6b7280' }}>
                {new Date(patient.todayAppointment.appointmentDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Visit reason */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          Lý do đến khám <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <select
          value={visitReason}
          onChange={e => setVisitReason(e.target.value)}
          style={{
            width: '100%', padding: '9px 12px', borderRadius: 8,
            border: '1px solid #d1d5db', fontSize: 13, outline: 'none',
          }}
        >
          {VISIT_REASONS.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {/* Doctor */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          Bác sĩ phụ trách {useAppt && apptDoctor ? '' : '(tùy chọn)'}
        </label>

        {/* Khi liên kết lịch hẹn có bác sĩ → hiển thị cố định, không cho đổi */}
        {useAppt && apptDoctor ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 12px', borderRadius: 8,
            border: '1.5px solid #6366f1', background: '#f5f3ff',
            fontSize: 13, fontWeight: 600, color: '#4f46e5',
          }}>
            <UserCheck size={15} />
            BS. {apptDoctor.fullName}
            <span style={{
              marginLeft: 'auto', fontSize: 11, fontWeight: 500,
              color: '#7c3aed', background: '#ede9fe',
              padding: '2px 8px', borderRadius: 20,
            }}>
              Theo lịch hẹn
            </span>
          </div>
        ) : (
          <select
            value={doctorId}
            onChange={e => setDoctorId(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 8,
              border: '1px solid #d1d5db', fontSize: 13, outline: 'none',
            }}
          >
            <option value="">— Chưa chọn —</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>
                {d.fullName}{d.isScheduledToday ? ' ✓' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Chair */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          Ghế khám (tùy chọn)
        </label>
        <select
          value={chairId}
          onChange={e => setChairId(e.target.value)}
          style={{
            width: '100%', padding: '9px 12px', borderRadius: 8,
            border: '1px solid #d1d5db', fontSize: 13, outline: 'none',
          }}
        >
          <option value="">— Chưa chọn —</option>
          {availableChairs.map(c => (
            <option key={c.id} value={c.id}>{c.name} (Trống)</option>
          ))}
          {chairs.filter(c => c.status !== 'EMPTY').map(c => (
            <option key={c.id} value={c.id} disabled>
              {c.name} ({c.status === 'IN_TREATMENT' ? 'Đang dùng' : 'Đã phân công'})
            </option>
          ))}
        </select>
      </div>

      {/* Admin note */}
      <div style={{ marginBottom: 18 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          Ghi chú (tùy chọn)
        </label>
        <textarea
          value={adminNote}
          onChange={e => setAdminNote(e.target.value)}
          rows={2}
          placeholder="Ghi chú cho lần tiếp đón này..."
          style={{
            width: '100%', padding: '9px 12px', borderRadius: 8,
            border: '1px solid #d1d5db', fontSize: 13, outline: 'none',
            resize: 'vertical', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button
          onClick={onBack}
          style={{
            padding: '9px 18px', borderRadius: 8, fontSize: 13,
            border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#374151',
          }}
        >
          Quay lại
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            padding: '9px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: submitting ? '#a5b4fc' : '#6366f1', color: '#fff',
            border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <UserCheck size={15} />
          {submitting ? 'Đang xử lý...' : 'Xác nhận Check-in'}
        </button>
      </div>
    </div>
  )
}

// ─── Step 3: Success ──────────────────────────────────────────

function Step3({ code, patientName, onClose }: { code: string; patientName: string; onClose: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%', background: '#dcfce7',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px',
      }}>
        <CheckCircle2 size={32} style={{ color: '#16a34a' }} />
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1f2937', margin: '0 0 8px' }}>Check-in thành công!</h3>
      <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>{patientName}</p>
      <div style={{
        display: 'inline-block', padding: '6px 16px', background: '#f0f9ff',
        borderRadius: 8, fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: '#0369a1',
        marginBottom: 24, border: '1px solid #bae6fd',
      }}>
        {code}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
        <button
          onClick={onClose}
          style={{
            padding: '9px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer',
          }}
        >
          Đóng
        </button>
      </div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────

interface Props {
  onClose:   () => void
  onSuccess: () => void
  doctors:   DoctorOption[]
  chairs:    ChairStatus[]
}

export default function QuickCheckInModal({ onClose, onSuccess, doctors, chairs }: Props) {
  const [step,       setStep]       = useState<1 | 2 | 3>(1)
  const [patient,    setPatient]    = useState<SearchPatientResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [doneCode,   setDoneCode]   = useState('')

  const handleSelect = (p: SearchPatientResult) => {
    setPatient(p)
    setStep(2)
  }

  const handleSubmit = async (data: {
    appointmentId?: number
    doctorId?: number
    chairId?: number
    visitReason: string
    adminNote?: string
  }) => {
    if (!patient) return
    setSubmitting(true)
    try {
      const rec = await receptionApi.checkIn({ patientId: patient.id, ...data })
      setDoneCode(rec.code)
      setStep(3)
      onSuccess()
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Lỗi check-in')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520,
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '18px 20px', borderBottom: '1px solid #f3f4f6',
        }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1f2937', margin: 0 }}>Check-in nhanh</h2>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {[1, 2, 3].map(s => (
                <div key={s} style={{
                  width: 24, height: 4, borderRadius: 2,
                  background: step >= s ? '#6366f1' : '#e5e7eb',
                }} />
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px' }}>
          {step === 1 && <Step1 onSelect={handleSelect} />}
          {step === 2 && patient && (
            <Step2
              patient={patient}
              doctors={doctors}
              chairs={chairs}
              onBack={() => setStep(1)}
              onSubmit={handleSubmit}
              submitting={submitting}
            />
          )}
          {step === 3 && (
            <Step3
              code={doneCode}
              patientName={patient?.fullName ?? ''}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  )
}
