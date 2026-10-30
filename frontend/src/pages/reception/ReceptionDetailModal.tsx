import React, { useState } from 'react'
import {
  X, Clock, CheckCircle2, Stethoscope, CreditCard, Ban,
  UserCheck, Armchair, AlertTriangle, Phone, Calendar, User, Tag
} from 'lucide-react'
import { receptionApi } from '../../api/reception.api'
import type { ReceptionItem, DoctorOption, ChairStatus } from '../../api/reception.api'
import { useAuthStore } from '../../stores/auth.store'

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  WAITING:           { label: 'Chờ vào ghế',   color: '#d97706', bg: '#fffbeb' },
  IN_TREATMENT:      { label: 'Đang điều trị',  color: '#7c3aed', bg: '#f5f3ff' },
  WAITING_PAYMENT:   { label: 'Chờ thanh toán', color: '#0891b2', bg: '#ecfeff' },
  COMPLETED:         { label: 'Hoàn tất',        color: '#059669', bg: '#ecfdf5' },
  CONSULTATION_ONLY: { label: 'Chỉ tư vấn',     color: '#2563eb', bg: '#eff6ff' },
  ABSENT:            { label: 'Vắng mặt',        color: '#6b7280', bg: '#f3f4f6' },
  CANCELLED:         { label: 'Đã hủy',          color: '#dc2626', bg: '#fff1f2' },
}

const CLASSIFICATION_META: Record<string, { label: string; color: string }> = {
  NEW:      { label: 'Mới',       color: '#6b7280' },
  RETURNING:{ label: 'Thường',    color: '#2563eb' },
  VIP:      { label: 'VIP',       color: '#d97706' },
  SPECIAL:  { label: 'Đặc biệt',  color: '#dc2626' },
}

const VISIT_REASON_LABEL: Record<string, string> = {
  NEW_EXAM:     'Khám mới',
  REVISIT:      'Tái khám',
  TREATMENT:    'Điều trị theo kế hoạch',
  SCALING:      'Cạo vôi răng',
  BRACES:       'Niềng răng',
  WHITENING:    'Tẩy trắng răng',
  PAYMENT:      'Thanh toán công nợ',
  PICKUP:       'Lấy hồ sơ',
  CONSULTATION: 'Tư vấn',
  OTHER:        'Khác',
}

interface Props {
  rec:       ReceptionItem
  doctors:   DoctorOption[]
  chairs:    ChairStatus[]
  onClose:   () => void
  onUpdated: (rec: ReceptionItem) => void
}

export default function ReceptionDetailModal({ rec, doctors, chairs, onClose, onUpdated }: Props) {
  const { activeRole } = useAuthStore()
  const canManage = activeRole === 'RECEPTIONIST' || activeRole === 'ADMIN'

  const [assignDoctorId, setAssignDoctorId] = useState<string>(rec.doctor?.id?.toString() ?? '')
  const [assignChairId,  setAssignChairId]  = useState<string>(rec.chair?.id?.toString() ?? '')
  const [assigning, setAssigning] = useState(false)

  const [cancelReason, setCancelReason] = useState('')
  const [showCancelInput, setShowCancelInput] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Classification change (UC3.6)
  const [showClassChange, setShowClassChange] = useState(false)
  const [newClass,    setNewClass]    = useState(rec.patient.classification)
  const [classReason, setClassReason] = useState('')
  const [changingClass, setChangingClass] = useState(false)

  const isActive = ['WAITING', 'IN_TREATMENT', 'WAITING_PAYMENT'].includes(rec.status)

  const fmt = (iso: string | null) => iso
    ? new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
    : '—'

  const NEXT_STATUSES: { label: string; status: string; color: string; bg: string }[] =
    rec.status === 'WAITING'
      ? [
          { label: 'Vào ghế → Điều trị', status: 'IN_TREATMENT',    color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Chỉ tư vấn',          status: 'CONSULTATION_ONLY', color: '#2563eb', bg: '#eff6ff' },
          { label: 'Vắng mặt',            status: 'ABSENT',            color: '#6b7280', bg: '#f3f4f6' },
          { label: 'Hủy lượt',            status: 'CANCELLED',         color: '#dc2626', bg: '#fff1f2' },
        ]
      : rec.status === 'IN_TREATMENT'
      ? [
          { label: 'Chờ thanh toán', status: 'WAITING_PAYMENT', color: '#0891b2', bg: '#ecfeff' },
          { label: 'Hoàn tất',       status: 'COMPLETED',       color: '#059669', bg: '#ecfdf5' },
        ]
      : rec.status === 'WAITING_PAYMENT'
      ? [{ label: 'Hoàn tất', status: 'COMPLETED', color: '#059669', bg: '#ecfdf5' }]
      : []

  const handleStatusChange = async (status: string) => {
    if (status === 'CANCELLED') { setShowCancelInput(true); return }
    setErrorMsg(null)
    try {
      const updated = await receptionApi.updateStatus(rec.id, { status })
      onUpdated(updated)
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Lỗi cập nhật trạng thái'
      setErrorMsg(msg)
    }
  }

  const handleCancel = async () => {
    setErrorMsg(null)
    try {
      const updated = await receptionApi.updateStatus(rec.id, { status: 'CANCELLED', cancelReason })
      onUpdated(updated)
      setShowCancelInput(false)
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message ?? 'Lỗi hủy lượt')
    }
  }

  const handleAssign = async () => {
    setAssigning(true)
    try {
      const updated = await receptionApi.assign(rec.id, {
        doctorId: assignDoctorId ? Number(assignDoctorId) : null,
        chairId:  assignChairId  ? Number(assignChairId)  : null,
      })
      onUpdated(updated)
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Lỗi phân công')
    } finally {
      setAssigning(false)
    }
  }

  const handleClassChange = async () => {
    if (!newClass) return
    if ((newClass === 'VIP' || newClass === 'SPECIAL') && !classReason.trim()) {
      alert('Cần nhập lý do khi gán nhãn VIP hoặc Đặc biệt')
      return
    }
    setChangingClass(true)
    try {
      await receptionApi.changeClassification(rec.patient.id, newClass, classReason)
      setShowClassChange(false)
      alert('Đã cập nhật phân loại bệnh nhân')
      // Note: parent's onUpdated won't reflect classification since rec object is immutable here
      // but the page will re-fetch from backend on next load
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Lỗi thay đổi phân loại')
    } finally {
      setChangingClass(false)
    }
  }

  const sm = STATUS_META[rec.status] ?? { label: rec.status, color: '#6b7280', bg: '#f3f4f6' }
  const clsM = CLASSIFICATION_META[rec.patient.classification]

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '18px 20px', borderBottom: '1px solid #f3f4f6',
        }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1f2937', margin: 0 }}>
              Chi tiết tiếp đón
            </h2>
            <code style={{ fontSize: 13, color: '#6366f1' }}>{rec.code}</code>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {/* Patient info */}
          <div style={{
            background: '#f8fafc', borderRadius: 10, padding: '14px',
            marginBottom: 18, border: '1px solid #e2e8f0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: '#1f2937' }}>
                  {rec.patient.fullName}
                </span>
                {clsM && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                    border: `1px solid ${clsM.color}`, color: clsM.color,
                  }}>
                    {clsM.label}
                  </span>
                )}
              </div>
              {canManage && (
                <button
                  onClick={() => { setShowClassChange(true); setNewClass(rec.patient.classification) }}
                  style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 6,
                    border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#6b7280',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Tag size={10} /> Đổi phân loại
                </button>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Phone size={10} />{rec.patient.phone}</span>
              <span style={{ fontFamily: 'monospace' }}>{rec.patient.code}</span>
            </div>
            {rec.patient.allergies && (
              <div style={{
                marginTop: 8, padding: '5px 10px',
                background: '#fff1f2', borderRadius: 6, border: '1px solid #fca5a5',
                fontSize: 12, color: '#dc2626',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <AlertTriangle size={12} />
                Dị ứng: {rec.patient.allergies}
              </div>
            )}
          </div>

          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
            <InfoItem icon={<Clock size={13} />}      label="Giờ đến"    value={fmt(rec.arrivedAt)} />
            <InfoItem icon={<Stethoscope size={13} />} label="Giờ vào ghế" value={fmt(rec.seatStartAt)} />
            <InfoItem icon={<CheckCircle2 size={13} />}label="Kết thúc"   value={fmt(rec.endAt)} />
            <InfoItem icon={<User size={13} />}        label="Lý do"      value={VISIT_REASON_LABEL[rec.visitReason] ?? rec.visitReason} />
            <InfoItem icon={<Armchair size={13} />}    label="Ghế khám"   value={rec.chair?.name ?? 'Chưa chọn'} />
            <InfoItem icon={<UserCheck size={13} />}   label="Bác sĩ"     value={rec.doctor ? `BS. ${rec.doctor.fullName}` : 'Chưa phân công'} />
            {rec.appointment && (
              <InfoItem icon={<Calendar size={13} />}  label="Lịch hẹn"  value={rec.appointment.service.name} />
            )}
            <InfoItem
              icon={null}
              label="Tiếp đón bởi"
              value={rec.receptionist.fullName}
            />
          </div>

          {/* Status */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Trạng thái hiện tại</div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 12px', borderRadius: 999, fontSize: 13, fontWeight: 700,
              color: sm.color, background: sm.bg,
            }}>
              {sm.label}
            </span>
            {rec.cancelReason && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#dc2626' }}>
                Lý do hủy: {rec.cancelReason}
              </div>
            )}
          </div>

          {/* Assign resources */}
          {isActive && canManage && (
            <div style={{
              border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px',
              marginBottom: 18,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>
                Phân công ghế / Bác sĩ
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <select
                  value={assignDoctorId}
                  onChange={e => setAssignDoctorId(e.target.value)}
                  style={{
                    flex: '1 1 160px', padding: '8px 10px', borderRadius: 7,
                    border: '1px solid #d1d5db', fontSize: 13, outline: 'none',
                  }}
                >
                  <option value="">— Bác sĩ —</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.fullName}{d.isScheduledToday ? ' ✓' : ''}</option>
                  ))}
                </select>
                <select
                  value={assignChairId}
                  onChange={e => setAssignChairId(e.target.value)}
                  style={{
                    flex: '1 1 120px', padding: '8px 10px', borderRadius: 7,
                    border: '1px solid #d1d5db', fontSize: 13, outline: 'none',
                  }}
                >
                  <option value="">— Ghế —</option>
                  {chairs.map(c => (
                    <option
                      key={c.id}
                      value={c.id}
                      disabled={c.status !== 'EMPTY' && c.id !== rec.chair?.id}
                    >
                      {c.name} ({c.status === 'EMPTY' ? 'Trống' : c.status === 'IN_TREATMENT' ? 'Đang dùng' : 'Đã phân công'})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAssign}
                  disabled={assigning}
                  style={{
                    padding: '8px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                    background: '#6366f1', color: '#fff', border: 'none',
                    cursor: assigning ? 'not-allowed' : 'pointer',
                  }}
                >
                  {assigning ? '...' : 'Lưu'}
                </button>
              </div>
            </div>
          )}

          {/* Error banner */}
          {errorMsg && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              background: '#fff1f2', border: '1px solid #fca5a5', borderRadius: 8,
              padding: '10px 12px', marginBottom: 14, fontSize: 13, color: '#dc2626',
            }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{errorMsg}</span>
              <button
                onClick={() => setErrorMsg(null)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 0 }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Status actions */}
          {NEXT_STATUSES.length > 0 && canManage && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
                Chuyển trạng thái
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {NEXT_STATUSES.map(a => (
                  <button
                    key={a.status}
                    onClick={() => handleStatusChange(a.status)}
                    style={{
                      padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                      background: a.bg, color: a.color, border: `1px solid ${a.color}`,
                      cursor: 'pointer',
                    }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              {/* Cancel input */}
              {showCancelInput && (
                <div style={{ marginTop: 12 }}>
                  <textarea
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                    placeholder="Nhập lý do hủy..."
                    rows={2}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 7,
                      border: '1px solid #fca5a5', fontSize: 13, outline: 'none',
                      resize: 'vertical', boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      onClick={() => setShowCancelInput(false)}
                      style={{
                        padding: '6px 14px', borderRadius: 7, fontSize: 13,
                        border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer',
                      }}
                    >
                      Thôi
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={!cancelReason.trim()}
                      style={{
                        padding: '6px 14px', borderRadius: 7, fontSize: 13, fontWeight: 700,
                        background: '#dc2626', color: '#fff', border: 'none',
                        cursor: cancelReason.trim() ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Xác nhận hủy
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Admin note */}
          {rec.adminNote && (
            <div style={{
              background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
              padding: '10px 12px', fontSize: 12, color: '#92400e',
            }}>
              <strong>Ghi chú: </strong>{rec.adminNote}
            </div>
          )}
        </div>

        {/* Classification change panel */}
        {showClassChange && (
          <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
          }}>
            <div style={{
              background: '#fff', borderRadius: 14, width: '100%', maxWidth: 420,
              padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1f2937', margin: '0 0 16px' }}>
                Thay đổi phân loại bệnh nhân
              </h3>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Phân loại mới
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['NEW', 'RETURNING', 'VIP', 'SPECIAL'] as const).map(cls => {
                    const m = CLASSIFICATION_META[cls]
                    const disabled = (cls === 'VIP' && activeRole !== 'ADMIN')
                      || (cls === 'SPECIAL' && activeRole !== 'ADMIN' && activeRole !== 'DOCTOR')
                    return (
                      <button
                        key={cls}
                        onClick={() => !disabled && setNewClass(cls)}
                        disabled={disabled}
                        style={{
                          flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
                          border: `2px solid ${newClass === cls ? m.color : '#e5e7eb'}`,
                          background: newClass === cls ? m.color + '18' : '#fff',
                          color: disabled ? '#d1d5db' : m.color,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          opacity: disabled ? 0.5 : 1,
                        }}
                      >
                        {m.label}
                        {disabled && <div style={{ fontSize: 9, fontWeight: 400 }}>No quyền</div>}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Lý do {(newClass === 'VIP' || newClass === 'SPECIAL') && <span style={{ color: '#dc2626' }}>*</span>}
                </label>
                <textarea
                  value={classReason}
                  onChange={e => setClassReason(e.target.value)}
                  rows={2}
                  placeholder="Nhập lý do thay đổi..."
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    border: '1px solid #d1d5db', fontSize: 13, outline: 'none',
                    resize: 'vertical', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowClassChange(false)}
                  style={{
                    padding: '8px 16px', borderRadius: 8, fontSize: 13,
                    border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  onClick={handleClassChange}
                  disabled={changingClass}
                  style={{
                    padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    background: '#6366f1', color: '#fff', border: 'none',
                    cursor: changingClass ? 'not-allowed' : 'pointer',
                  }}
                >
                  {changingClass ? 'Đang lưu...' : 'Xác nhận'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon}{label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{value}</div>
    </div>
  )
}
