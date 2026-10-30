import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  ChevronLeft, Pencil, X, Loader2, CheckCircle2, AlertTriangle,
  User, Phone, IdCard, Shield, MapPin, Briefcase, Calendar,
  Clock, Stethoscope, Image, FileText, Activity, UserX, Armchair,
} from 'lucide-react'
import {
  patientsApi, CLASSIFICATION_META, ANXIETY_META, TOOTH_STATUS_META,
  type PatientDetail, type PatientAppointment, type DuplicateError,
  type ToothChartData,
} from '../../api/patients.api'
import { receptionApi, type ReceptionItem } from '../../api/reception.api'
import { treatmentApi } from '../../api/treatment.api'
import type { DentalRecord } from '../../api/treatment.api'
import { invoiceApi } from '../../api/invoice.api'
import type { Invoice } from '../../api/invoice.api'
import { useAuthStore } from '../../stores/auth.store'
import ToothChart from './components/ToothChart'

// ─── Shared styles ────────────────────────────────────────────

const card: React.CSSProperties = {
  backgroundColor: 'white', borderRadius: '14px',
  border: '1px solid #e5e7eb', padding: '24px 28px', marginBottom: '20px',
}
const inputBase: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb',
  borderRadius: '8px', fontSize: '13px', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit', backgroundColor: 'white',
}
const inputErr: React.CSSProperties = { ...inputBase, borderColor: '#ef4444' }
const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:    { label: 'Chờ xác nhận', color: '#d97706', bg: '#fffbeb' },
  CONFIRMED:  { label: 'Đã xác nhận',  color: '#2563eb', bg: '#eff6ff' },
  CHECKED_IN: { label: 'Đã đến',       color: '#0891b2', bg: '#ecfeff' },
  IN_PROGRESS:{ label: 'Đang khám',    color: '#7c3aed', bg: '#f5f3ff' },
  COMPLETED:  { label: 'Hoàn thành',   color: '#059669', bg: '#ecfdf5' },
  CANCELLED:  { label: 'Đã hủy',       color: '#dc2626', bg: '#fff1f2' },
  NO_SHOW:    { label: 'Không đến',    color: '#6b7280', bg: '#f3f4f6' },
}

// ─── Role-based tab config ────────────────────────────────────

const ALL_TABS = [
  { key: 'info',            label: 'Thông tin cá nhân', icon: User },
  { key: 'tooth-chart',     label: 'Sơ đồ răng',        icon: Activity },
  { key: 'appointments',    label: 'Lịch hẹn',          icon: Calendar },
  { key: 'treatment',       label: 'Lịch sử điều trị',  icon: Stethoscope },
  { key: 'xray',            label: 'X-quang',            icon: Image },
  { key: 'invoices',        label: 'Hóa đơn',            icon: FileText },
  { key: 'reception-history',label: 'Lịch sử tiếp đón', icon: Clock },
]

const TABS_BY_ROLE: Record<string, string[]> = {
  RECEPTIONIST: ['info', 'appointments', 'reception-history'],
  DOCTOR:       ['info', 'tooth-chart', 'treatment', 'xray'],
  ACCOUNTANT:   ['info', 'invoices'],
  ADMIN:        ['info', 'tooth-chart', 'appointments', 'treatment', 'xray', 'invoices', 'reception-history'],
}

// ─── Small helpers ────────────────────────────────────────────

function ViewField({ label, value, icon: Icon }: { label: string; value?: string | null; icon?: any }) {
  return (
    <div>
      <span style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {Icon && <Icon size={13} color="#6b7280" />}
        <span style={{ fontSize: '13px', color: '#111827', fontWeight: 500 }}>
          {value || <span style={{ color: '#9ca3af' }}>—</span>}
        </span>
      </div>
    </div>
  )
}

function SectionHeader({ icon: Icon, title, color = '#2563eb' }: { icon: any; title: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
      <Icon size={15} color={color} />
      <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111827', margin: 0 }}>{title}</h3>
    </div>
  )
}

// ─── Appointment row ──────────────────────────────────────────

function AppointmentRow({ apt }: { apt: PatientAppointment }) {
  const st = STATUS_META[apt.status] ?? { label: apt.status, color: '#6b7280', bg: '#f3f4f6' }
  const d  = new Date(apt.appointmentDate)
  const isUpcoming = d > new Date() && !['CANCELLED','NO_SHOW'].includes(apt.status)
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '12px',
      padding: '14px 16px', border: '1px solid #f3f4f6', borderRadius: '10px',
      backgroundColor: isUpcoming ? '#f0f9ff' : '#fafafa',
      borderLeftColor: isUpcoming ? '#2563eb' : '#f3f4f6',
      borderLeftWidth: isUpcoming ? '3px' : '1px',
    }}>
      <div style={{
        width: '38px', height: '38px', borderRadius: '9px', flexShrink: 0,
        backgroundColor: isUpcoming ? '#dbeafe' : '#f3f4f6',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Calendar size={16} color={isUpcoming ? '#2563eb' : '#6b7280'} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
            {d.toLocaleString('vi-VN')}
          </span>
          <span style={{
            padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600,
            color: st.color, backgroundColor: st.bg,
          }}>
            {st.label}
          </span>
          {isUpcoming && (
            <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600 }}>Sắp tới</span>
          )}
        </div>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6b7280' }}>
          Bác sĩ: <strong>{apt.doctor?.fullName ?? '—'}</strong> · Dịch vụ: {apt.service?.name ?? '—'}
        </p>
        {apt.note && (
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#374151', fontStyle: 'italic' }}>
            {apt.note}
          </p>
        )}
      </div>
      <span style={{ fontSize: '11px', color: '#9ca3af', flexShrink: 0 }}>{apt.code}</span>
    </div>
  )
}

// ─── Placeholder tab ──────────────────────────────────────────

function PlaceholderTab({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 24px', color: '#9ca3af' }}>
      <div style={{ width: '56px', height: '56px', borderRadius: '14px', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
        <Icon size={24} color="#9ca3af" />
      </div>
      <p style={{ fontSize: '15px', fontWeight: 600, color: '#374151', margin: 0 }}>{title}</p>
      <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '6px' }}>{subtitle}</p>
    </div>
  )
}

// ─── Reception History Tab ────────────────────────────────────

const REC_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  WAITING:           { label: 'Chờ vào ghế',   color: '#d97706', bg: '#fffbeb' },
  IN_TREATMENT:      { label: 'Đang điều trị',  color: '#7c3aed', bg: '#f5f3ff' },
  WAITING_PAYMENT:   { label: 'Chờ thanh toán', color: '#0891b2', bg: '#ecfeff' },
  COMPLETED:         { label: 'Hoàn tất',        color: '#059669', bg: '#ecfdf5' },
  CONSULTATION_ONLY: { label: 'Chỉ tư vấn',     color: '#2563eb', bg: '#eff6ff' },
  ABSENT:            { label: 'Vắng mặt',        color: '#6b7280', bg: '#f3f4f6' },
  CANCELLED:         { label: 'Đã hủy',          color: '#dc2626', bg: '#fff1f2' },
}

const VISIT_REASON_LABEL: Record<string, string> = {
  NEW_EXAM: 'Khám mới', REVISIT: 'Tái khám', TREATMENT: 'Điều trị',
  SCALING: 'Cạo vôi', BRACES: 'Niềng răng', WHITENING: 'Tẩy trắng',
  PAYMENT: 'Thanh toán', PICKUP: 'Lấy hồ sơ', CONSULTATION: 'Tư vấn', OTHER: 'Khác',
}

function ReceptionHistoryTab({ patientId }: { patientId: number }) {
  const [history, setHistory] = useState<ReceptionItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    receptionApi.getPatientHistory(patientId)
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [patientId])

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
      <Loader2 size={24} className="animate-spin" /> Đang tải...
    </div>
  )

  if (history.length === 0) return (
    <div style={{ ...card }}>
      <PlaceholderTab icon={Clock} title="Lịch sử tiếp đón" subtitle="Bệnh nhân chưa có lần tiếp đón nào." />
    </div>
  )

  return (
    <div style={card}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Armchair size={16} /> Lịch sử tiếp đón ({history.length} lần)
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {history.map(rec => {
          const sm = REC_STATUS_META[rec.status] ?? { label: rec.status, color: '#6b7280', bg: '#f3f4f6' }
          const arrivedDate = new Date(rec.arrivedAt)
          return (
            <div key={rec.id} style={{
              border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px',
              backgroundColor: '#fafafa',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6 }}>
                <div>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#6366f1', fontWeight: 700 }}>{rec.code}</span>
                  <span style={{ margin: '0 8px', color: '#d1d5db' }}>·</span>
                  <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>
                    {arrivedDate.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                  <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 6 }}>
                    {arrivedDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                  color: sm.color, background: sm.bg,
                }}>{sm.label}</span>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap', fontSize: 12, color: '#6b7280' }}>
                <span>📋 {VISIT_REASON_LABEL[rec.visitReason] ?? rec.visitReason}</span>
                {rec.doctor && <span>👨‍⚕️ BS. {rec.doctor.fullName}</span>}
                {rec.chair  && <span>🦷 {rec.chair.name}</span>}
                {rec.appointment && <span>📅 {rec.appointment.service.name}</span>}
                {rec.cancelReason && <span style={{ color: '#dc2626' }}>❌ {rec.cancelReason}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Treatment History Tab ────────────────────────────────────

const DR_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:  { label: 'Nháp',    color: '#6b7280', bg: '#f3f4f6' },
  SIGNED: { label: 'Đã ký số', color: '#059669', bg: '#d1fae5' },
}

function TreatmentHistoryTab({ patientId }: { patientId: number }) {
  const [records, setRecords] = useState<DentalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    treatmentApi.getPatientHistory(patientId)
      .then((data: any) => setRecords(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [patientId])

  if (loading) return (
    <div style={{ ...card, textAlign: 'center', padding: 40, color: '#9ca3af' }}>
      <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
      <div style={{ marginTop: 8, fontSize: 13 }}>Đang tải lịch sử...</div>
    </div>
  )

  if (records.length === 0) return (
    <div style={card}>
      <PlaceholderTab icon={Stethoscope} title="Lịch sử điều trị" subtitle="Chưa có lần điều trị nào được ghi nhận." />
    </div>
  )

  return (
    <div style={card}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Stethoscope size={16} color="#7c3aed" /> Lịch sử điều trị ({records.length} lần)
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {records.map((rec: any) => {
          const sm = DR_STATUS[rec.status] ?? DR_STATUS.DRAFT
          const isOpen = expanded === rec.id
          const dateStr = rec.signedAt ?? rec.createdAt
          const d = new Date(dateStr)
          return (
            <div key={rec.id} style={{
              border: '1px solid #e5e7eb', borderRadius: 12,
              overflow: 'hidden',
              borderLeft: rec.status === 'SIGNED' ? '3px solid #059669' : '3px solid #d1d5db',
            }}>
              {/* Header row — always visible */}
              <button
                onClick={() => setExpanded(isOpen ? null : rec.id)}
                style={{
                  width: '100%', textAlign: 'left', padding: '12px 16px',
                  background: isOpen ? '#f8fafc' : '#fafafa',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: rec.status === 'SIGNED' ? '#d1fae5' : '#f3f4f6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Stethoscope size={16} color={rec.status === 'SIGNED' ? '#059669' : '#9ca3af'} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#6366f1', fontWeight: 700 }}>{rec.code}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                        color: sm.color, background: sm.bg,
                      }}>{sm.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      {d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                      {' · '}BS. {rec.doctor?.fullName ?? '—'}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {rec.icd10Code && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1f2937' }}>{rec.icd10Code}</div>
                  )}
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>
                    {rec.services?.length ?? 0} dịch vụ
                    {' · '}
                    {isOpen ? '▲' : '▼'}
                  </div>
                </div>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f3f4f6', background: '#fff' }}>
                  {/* Diagnosis */}
                  {rec.icd10Code && (
                    <div style={{ padding: '10px 12px', background: '#f0f9ff', borderRadius: 8, marginTop: 12, marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#0369a1' }}>Chẩn đoán: </span>
                      <span style={{ fontSize: 13, color: '#1f2937' }}>
                        <strong>{rec.icd10Code}</strong> – {rec.icd10Description}
                      </span>
                    </div>
                  )}

                  {/* Visit reason */}
                  {rec.visitReason && (
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>Lý do khám: </span>
                      <span style={{ fontSize: 13, color: '#374151' }}>{rec.visitReason}</span>
                    </div>
                  )}

                  {/* Services */}
                  {rec.services?.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase' }}>Dịch vụ đã thực hiện</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {rec.services.map((s: any, i: number) => (
                          <span key={i} style={{
                            fontSize: 12, padding: '4px 10px', borderRadius: 20,
                            background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb',
                          }}>
                            {s.service?.name ?? s.serviceName ?? 'Dịch vụ'}
                            {s.toothNumber && <span style={{ color: '#9ca3af' }}> · Răng {s.toothNumber}</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Clinical notes */}
                  {rec.clinicalNotes && (
                    <div style={{ marginTop: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>Ghi chú lâm sàng: </span>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap' }}>{rec.clinicalNotes}</p>
                    </div>
                  )}

                  {/* Aftercare */}
                  {rec.aftercareNotes && (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Hướng dẫn chăm sóc: </span>
                      <span style={{ fontSize: 12, color: '#166534' }}>{rec.aftercareNotes}</span>
                    </div>
                  )}

                  {/* Follow-up */}
                  {rec.followUpDate && (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280' }}>
                      <Calendar size={13} />
                      Tái khám: <strong style={{ color: '#1f2937' }}>{new Date(rec.followUpDate).toLocaleDateString('vi-VN')}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Patient Invoices Tab ─────────────────────────────────────

const INV_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  WAITING_PAYMENT: { label: 'Chờ thanh toán', color: '#d97706', bg: '#fef3c7' },
  PAID:            { label: 'Đã thanh toán',  color: '#059669', bg: '#d1fae5' },
  CANCELLED:       { label: 'Đã hủy',         color: '#6b7280', bg: '#f3f4f6' },
  REFUNDED:        { label: 'Đã hoàn tiền',   color: '#6366f1', bg: '#ede9fe' },
}

function PatientInvoicesTab({ patientId }: { patientId: number }) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    invoiceApi.list({ patientId })
      .then(r => setInvoices(r.items))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [patientId])

  if (loading) return (
    <div style={{ ...card, textAlign: 'center', padding: 40, color: '#9ca3af' }}>
      <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  )

  if (invoices.length === 0) return (
    <div style={card}>
      <PlaceholderTab icon={FileText} title="Hóa đơn" subtitle="Bệnh nhân chưa có hóa đơn nào." />
    </div>
  )

  const totalPaid = invoices
    .filter(inv => inv.status === 'PAID')
    .reduce((s, inv) => s + inv.totalAmount, 0)

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1f2937', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText size={16} color="#6366f1" /> Hóa đơn ({invoices.length} lần)
        </h3>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#6366f1' }}>
          Đã thanh toán: {totalPaid.toLocaleString('vi-VN')}đ
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {invoices.map(inv => {
          const sm = INV_STATUS[inv.status] ?? INV_STATUS.WAITING_PAYMENT
          const d  = new Date(inv.paidAt ?? inv.createdAt)
          return (
            <div key={inv.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', border: '1px solid #e5e7eb', borderRadius: 10,
              background: '#fafafa',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#6366f1', fontWeight: 700 }}>{inv.code}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                    color: sm.color, background: sm.bg,
                  }}>{sm.label}</span>
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                  {d.toLocaleDateString('vi-VN')} · BS. {inv.doctor.fullName}
                  {inv.items.length > 0 && ` · ${inv.items.length} dịch vụ`}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1f2937' }}>
                  {inv.totalAmount.toLocaleString('vi-VN')}đ
                </div>
                {inv.discountAmount > 0 && (
                  <div style={{ fontSize: 11, color: '#059669' }}>–{inv.discountAmount.toLocaleString('vi-VN')}đ giảm</div>
                )}
                {inv.paymentMethod && (
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>
                    {{ CASH: 'Tiền mặt', CARD: 'Thẻ/CK', MOMO: 'MoMo', ZALOPAY: 'ZaloPay' }[inv.paymentMethod] ?? inv.paymentMethod}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Edit form types ──────────────────────────────────────────

interface AdminEditState {
  fullName: string; dateOfBirth: string; gender: string; phone: string
  nationalId: string; bhytCode: string; address: string; occupation: string
  emergencyContactName: string; emergencyContactPhone: string; adminNote: string
  classification: string
}

interface MedicalEditState {
  allergies: string; systemicDiseases: string
  dentalAnxietyLevel: string; internalNote: string
  toothChart: ToothChartData
}

function patientToAdmin(p: PatientDetail): AdminEditState {
  return {
    fullName: p.fullName, dateOfBirth: p.dateOfBirth.slice(0, 10),
    gender: p.gender, phone: p.phone,
    nationalId: p.nationalId ?? '', bhytCode: p.bhytCode ?? '',
    address: p.address ?? '', occupation: p.occupation ?? '',
    emergencyContactName: p.emergencyContactName ?? '',
    emergencyContactPhone: p.emergencyContactPhone ?? '',
    adminNote: p.adminNote ?? '', classification: p.classification,
  }
}

function patientToMedical(p: PatientDetail): MedicalEditState {
  return {
    allergies:          p.allergies          ?? '',
    systemicDiseases:   p.systemicDiseases   ?? '',
    dentalAnxietyLevel: p.dentalAnxietyLevel ?? 'NONE',
    internalNote:       p.internalNote       ?? '',
    toothChart:         p.toothChart         ?? {},
  }
}

// ─── Main page ────────────────────────────────────────────────

export default function PatientDetailPage() {
  const { id }        = useParams<{ id: string }>()
  const navigate      = useNavigate()
  const [sp]          = useSearchParams()
  const { activeRole } = useAuthStore()
  const role          = activeRole ?? 'RECEPTIONIST'

  // Tabs for this role
  const allowedKeys   = TABS_BY_ROLE[role] ?? TABS_BY_ROLE['RECEPTIONIST']
  const visibleTabs   = ALL_TABS.filter(t => allowedKeys.includes(t.key))
  const [activeTab,   setActiveTab]   = useState(sp.get('tab') ?? allowedKeys[0])

  // Data
  const [patient,     setPatient]     = useState<PatientDetail | null>(null)
  const [appointments,setAppointments]= useState<PatientAppointment[]>([])
  const [loading,     setLoading]     = useState(true)
  const [aptsLoading, setAptsLoading] = useState(false)
  const [notFound,    setNotFound]    = useState(false)

  // Admin edit mode
  const [editAdmin,   setEditAdmin]   = useState(sp.get('edit') === '1')
  const [adminForm,   setAdminForm]   = useState<AdminEditState | null>(null)
  const [adminErrors, setAdminErrors] = useState<Partial<AdminEditState>>({})

  // Medical edit mode
  const [editMedical, setEditMedical] = useState(false)
  const [medForm,     setMedForm]     = useState<MedicalEditState | null>(null)

  // Save state
  const [saving,      setSaving]      = useState(false)
  const [success,     setSuccess]     = useState('')
  const [apiError,    setApiError]    = useState('')
  const [duplicate,   setDuplicate]   = useState<DuplicateError | null>(null)

  // Load patient
  useEffect(() => {
    if (!id) return
    setLoading(true)
    patientsApi.get(Number(id))
      .then(r => {
        setPatient(r.data)
        setAdminForm(patientToAdmin(r.data))
        setMedForm(patientToMedical(r.data))
      })
      .catch(e => { if (e?.response?.status === 404) setNotFound(true) })
      .finally(() => setLoading(false))
  }, [id])

  // Load appointments when tab activated
  useEffect(() => {
    if (activeTab !== 'appointments' || !id) return
    setAptsLoading(true)
    patientsApi.getAppointments(Number(id))
      .then(r => setAppointments(r.data))
      .catch(() => {})
      .finally(() => setAptsLoading(false))
  }, [activeTab, id])

  // ── Admin save ──────────────────────────────────────────────

  const validateAdmin = (): boolean => {
    if (!adminForm) return false
    const e: Partial<AdminEditState> = {}
    if (!adminForm.fullName.trim())  e.fullName    = 'Không được để trống'
    if (!adminForm.dateOfBirth)      e.dateOfBirth = 'Không được để trống'
    if (!adminForm.phone.trim())     e.phone       = 'Không được để trống'
    else if (!/^0\d{9,10}$/.test(adminForm.phone.replace(/\s/g, '')))
      e.phone = 'Số điện thoại không hợp lệ'
    setAdminErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSaveAdmin = async () => {
    if (!adminForm || !patient) return
    if (!validateAdmin()) return
    setSaving(true); setApiError(''); setDuplicate(null)
    try {
      const res = await patientsApi.update(patient.id, {
        fullName: adminForm.fullName.trim(), dateOfBirth: adminForm.dateOfBirth,
        gender: adminForm.gender, phone: adminForm.phone.trim(),
        nationalId: adminForm.nationalId.trim() || undefined,
        bhytCode: adminForm.bhytCode.trim() || undefined,
        address: adminForm.address.trim() || undefined,
        occupation: adminForm.occupation.trim() || undefined,
        emergencyContactName: adminForm.emergencyContactName.trim() || undefined,
        emergencyContactPhone: adminForm.emergencyContactPhone.trim() || undefined,
        adminNote: adminForm.adminNote.trim() || undefined,
        classification: adminForm.classification,
      })
      setPatient(res.data); setAdminForm(patientToAdmin(res.data))
      setEditAdmin(false)
      setSuccess('Đã cập nhật thông tin hành chính')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      if (err?.response?.status === 409) setDuplicate(err.response.data)
      else setApiError(err?.response?.data?.message ?? 'Lỗi kết nối')
    } finally { setSaving(false) }
  }

  // ── Medical save ────────────────────────────────────────────

  const handleSaveMedical = async () => {
    if (!medForm || !patient) return
    setSaving(true); setApiError('')
    try {
      const res = await patientsApi.updateMedical(patient.id, {
        allergies:          medForm.allergies          || null,
        systemicDiseases:   medForm.systemicDiseases   || null,
        dentalAnxietyLevel: medForm.dentalAnxietyLevel || null,
        internalNote:       medForm.internalNote       || null,
        toothChart:         Object.keys(medForm.toothChart).length ? medForm.toothChart : null,
      })
      setPatient(res.data); setMedForm(patientToMedical(res.data))
      setEditMedical(false)
      setSuccess('Đã cập nhật thông tin y tế')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setApiError(err?.response?.data?.message ?? 'Lỗi kết nối')
    } finally { setSaving(false) }
  }

  // ── Helpers ─────────────────────────────────────────────────

  const setAdmin = (k: keyof AdminEditState) => (v: string) => {
    setAdminForm(f => f ? { ...f, [k]: v } : f)
    if (adminErrors[k]) setAdminErrors(e => ({ ...e, [k]: undefined }))
  }
  const setMed = (k: keyof MedicalEditState) => (v: any) =>
    setMedForm(f => f ? { ...f, [k]: v } : f)

  const handleDeactivate = async () => {
    if (!patient || !confirm(`Vô hiệu hóa hồ sơ "${patient.fullName}"?`)) return
    try { await patientsApi.deactivate(patient.id); navigate('/staff/patients') }
    catch { alert('Không thể vô hiệu hóa.') }
  }

  // ── Render loading / not found ──────────────────────────────

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
      <Loader2 size={24} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (notFound || !patient || !adminForm || !medForm) return (
    <div style={{ padding: '48px 32px', textAlign: 'center' }}>
      <p style={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>Không tìm thấy hồ sơ</p>
      <button onClick={() => navigate('/staff/patients')} style={{ marginTop: '12px', padding: '8px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: 'white', cursor: 'pointer', fontSize: '13px' }}>
        Quay lại danh sách
      </button>
    </div>
  )

  const cls = CLASSIFICATION_META[patient.classification] ?? { label: patient.classification, color: '#6b7280', bg: '#f3f4f6' }
  const hasAllergy = !!(patient.allergies?.trim())

  // ── Render ──────────────────────────────────────────────────

  return (
    <div style={{ padding: '24px 32px', maxWidth: '980px', margin: '0 auto' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', fontSize: '13px', color: '#6b7280' }}>
        <Link to="/staff/patients" style={{ color: '#2563eb', textDecoration: 'none' }}>Bệnh nhân</Link>
        <span>›</span>
        <span>Hồ sơ chi tiết</span>
      </div>

      {/* ── Medical Alert Banner (A1) ── */}
      {hasAllergy && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '12px',
          padding: '14px 20px', backgroundColor: '#fff1f2',
          borderLeft: '4px solid #dc2626', borderRadius: '0 10px 10px 0',
          marginBottom: '16px',
        }}>
          <Activity size={18} color="#dc2626" style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#dc2626' }}>
              Cảnh báo y tế nghiêm trọng
            </p>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#b91c1c' }}>
              {patient.allergies}
            </p>
          </div>
        </div>
      )}

      {/* ── Patient Header ── */}
      <div style={{ ...card, marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button onClick={() => navigate('/staff/patients')} style={{ padding: '7px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
            <ChevronLeft size={16} color="#6b7280" />
          </button>

          {/* Avatar */}
          <div style={{
            width: '52px', height: '52px', borderRadius: '13px', flexShrink: 0,
            backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '20px', fontWeight: 800, color: '#2563eb',
          }}>
            {patient.fullName.charAt(0)}
          </div>

          {/* Name + info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '19px', fontWeight: 800, color: '#111827', margin: 0 }}>
                {patient.fullName}
              </h1>
              <span style={{ padding: '3px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: 700, color: cls.color, backgroundColor: cls.bg }}>
                {cls.label}
              </span>
              {!patient.isActive && <span style={{ padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, color: '#6b7280', backgroundColor: '#f3f4f6' }}>Vô hiệu</span>}
              {!patient.isComplete && <span style={{ padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, color: '#92400e', backgroundColor: '#fef3c7' }}>Chưa đủ thông tin</span>}
            </div>
            <p style={{ margin: '5px 0 0', fontSize: '13px', color: '#6b7280' }}>
              Mã BN: <strong style={{ color: '#374151' }}>{patient.code}</strong>
              {' · '}{patient.gender === 'NAM' ? 'Nam' : 'Nữ'}
              {' · '}{new Date(patient.dateOfBirth).toLocaleDateString('vi-VN')}
              {' · '}{patient.phone}
            </p>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
            {/* Receptionist: Cập nhật + Check-in */}
            {role === 'RECEPTIONIST' && patient.isActive && !editAdmin && (
              <>
                <button
                  onClick={() => setEditAdmin(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', border: '1.5px solid #2563eb', borderRadius: '9px', backgroundColor: 'white', color: '#2563eb', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  <Pencil size={13} /> Cập nhật
                </button>
                <button
                  onClick={() => navigate(`/staff/appointments/new?patientId=${patient.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', border: 'none', borderRadius: '9px', backgroundColor: '#2563eb', color: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                >
                  <CheckCircle2 size={13} /> Check-in
                </button>
              </>
            )}
            {role === 'RECEPTIONIST' && editAdmin && (
              <>
                <button onClick={() => { setAdminForm(patientToAdmin(patient)); setEditAdmin(false); setAdminErrors({}) }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', border: '1.5px solid #e5e7eb', borderRadius: '9px', backgroundColor: 'white', color: '#374151', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>
                  <X size={13} /> Hủy
                </button>
                <button onClick={handleSaveAdmin} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', border: 'none', borderRadius: '9px', backgroundColor: saving ? '#93c5fd' : '#2563eb', color: 'white', fontWeight: 600, fontSize: '13px', cursor: saving ? 'wait' : 'pointer' }}>
                  {saving && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                  Lưu thay đổi
                </button>
              </>
            )}
            {/* Doctor: Cập nhật y tế */}
            {role === 'DOCTOR' && !editMedical && (
              <button onClick={() => setEditMedical(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', border: '1.5px solid #7c3aed', borderRadius: '9px', backgroundColor: 'white', color: '#7c3aed', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                <Pencil size={13} /> Cập nhật y tế
              </button>
            )}
            {role === 'DOCTOR' && editMedical && (
              <>
                <button onClick={() => { setMedForm(patientToMedical(patient)); setEditMedical(false) }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', border: '1.5px solid #e5e7eb', borderRadius: '9px', backgroundColor: 'white', color: '#374151', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>
                  <X size={13} /> Hủy
                </button>
                <button onClick={handleSaveMedical} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', border: 'none', borderRadius: '9px', backgroundColor: saving ? '#c4b5fd' : '#7c3aed', color: 'white', fontWeight: 600, fontSize: '13px', cursor: saving ? 'wait' : 'pointer' }}>
                  {saving && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                  Lưu
                </button>
              </>
            )}
            {/* Deactivate (receptionist / admin) */}
            {(role === 'RECEPTIONIST' || role === 'ADMIN') && patient.isActive && !editAdmin && (
              <button onClick={handleDeactivate} style={{ padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: '9px', backgroundColor: 'white', cursor: 'pointer', display: 'flex' }} title="Vô hiệu hóa">
                <UserX size={15} color="#9ca3af" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Notifications ── */}
      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', marginBottom: '16px' }}>
          <CheckCircle2 size={15} color="#16a34a" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#15803d' }}>{success}</span>
        </div>
      )}
      {apiError && (
        <div style={{ padding: '11px 16px', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', marginBottom: '16px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#be123c' }}>{apiError}</p>
        </div>
      )}
      {duplicate && (
        <div style={{ padding: '14px 16px', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', marginBottom: '16px' }}>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#9a3412' }}>{duplicate.message}</p>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#c2410c' }}>Hồ sơ trùng: {duplicate.duplicate.patient.code} – {duplicate.duplicate.patient.fullName}</p>
        </div>
      )}

      {/* ── Tab navigation ── */}
      <div style={{ display: 'flex', borderBottom: '2px solid #f3f4f6', marginBottom: '20px', overflowX: 'auto', gap: '2px' }}>
        {visibleTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '10px 18px', border: 'none', backgroundColor: 'transparent',
              borderBottom: activeTab === tab.key ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: '-2px', cursor: 'pointer', whiteSpace: 'nowrap',
              fontSize: '13px', fontWeight: activeTab === tab.key ? 700 : 400,
              color: activeTab === tab.key ? '#2563eb' : '#6b7280',
            }}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          TAB: Thông tin cá nhân
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'info' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

          {/* Left: Administrative info */}
          <div style={card}>
            <SectionHeader icon={User} title="Thông tin Hành chính" />
            {!editAdmin ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <ViewField label="CCCD / CMND"     value={patient.nationalId}  icon={IdCard} />
                <ViewField label="Số điện thoại"   value={patient.phone}       icon={Phone} />
                <ViewField label="Địa chỉ"          value={patient.address}     icon={MapPin} />
                <ViewField label="Nghề nghiệp"      value={patient.occupation}  icon={Briefcase} />
                <ViewField label="Mã BHYT"          value={patient.bhytCode}    icon={Shield} />
                <ViewField label="Phân loại"        value={cls.label} />
                <ViewField label="Người liên hệ"    value={patient.emergencyContactName ? `${patient.emergencyContactName} – ${patient.emergencyContactPhone ?? ''}` : null} />
                {patient.adminNote && (
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Ghi chú hành chính</span>
                    <p style={{ fontSize: '12px', color: '#374151', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{patient.adminNote}</p>
                  </div>
                )}
              </div>
            ) : (
              /* Edit form for admin fields */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { k: 'fullName' as const, label: 'Họ và tên', req: true },
                  { k: 'phone' as const, label: 'Số điện thoại', req: true },
                  { k: 'nationalId' as const, label: 'CCCD / CMND', req: false },
                  { k: 'bhytCode' as const, label: 'Mã BHYT', req: false },
                  { k: 'address' as const, label: 'Địa chỉ', req: false },
                  { k: 'occupation' as const, label: 'Nghề nghiệp', req: false },
                  { k: 'emergencyContactName' as const, label: 'Người liên hệ khẩn cấp', req: false },
                  { k: 'emergencyContactPhone' as const, label: 'SĐT liên hệ khẩn cấp', req: false },
                ].map(f => (
                  <div key={f.k}>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '4px' }}>
                      {f.label}{f.req && <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>}
                    </label>
                    <input
                      value={adminForm[f.k]}
                      onChange={e => setAdmin(f.k)(e.target.value)}
                      style={(adminErrors as any)[f.k] ? inputErr : inputBase}
                    />
                    {(adminErrors as any)[f.k] && <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '3px' }}>{(adminErrors as any)[f.k]}</p>}
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '4px' }}>Ngày sinh</label>
                  <input type="date" value={adminForm.dateOfBirth} max={new Date().toISOString().slice(0, 10)} onChange={e => setAdmin('dateOfBirth')(e.target.value)} style={adminErrors.dateOfBirth ? inputErr : inputBase} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '4px' }}>Giới tính</label>
                  <div style={{ display: 'flex', gap: '16px', padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: '8px' }}>
                    {[{ v: 'NAM', l: 'Nam' }, { v: 'NU', l: 'Nữ' }].map(g => (
                      <label key={g.v} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                        <input type="radio" checked={adminForm.gender === g.v} onChange={() => setAdmin('gender')(g.v)} style={{ accentColor: '#2563eb' }} />
                        {g.l}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '4px' }}>Phân loại</label>
                  <select value={adminForm.classification} onChange={e => setAdmin('classification')(e.target.value)} style={inputBase}>
                    {Object.entries(CLASSIFICATION_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '4px' }}>Ghi chú hành chính</label>
                  <textarea value={adminForm.adminNote} onChange={e => setAdmin('adminNote')(e.target.value)} rows={2} style={{ ...inputBase, resize: 'vertical' }} />
                </div>
              </div>
            )}
          </div>

          {/* Right: Medical info */}
          <div style={card}>
            <SectionHeader icon={Activity} title="Thông tin Y tế" color="#7c3aed" />
            {!editMedical ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Allergy card */}
                <div style={{
                  padding: '12px 14px', borderRadius: '10px',
                  backgroundColor: hasAllergy ? '#fff1f2' : '#f9fafb',
                  border: `1px solid ${hasAllergy ? '#fecdd3' : '#e5e7eb'}`,
                }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: hasAllergy ? '#dc2626' : '#6b7280', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Dị ứng
                  </p>
                  <p style={{ fontSize: '13px', color: hasAllergy ? '#be123c' : '#9ca3af', margin: 0 }}>
                    {patient.allergies || 'Không có'}
                  </p>
                </div>
                {/* Systemic disease card */}
                <div style={{
                  padding: '12px 14px', borderRadius: '10px',
                  backgroundColor: patient.systemicDiseases ? '#fffbeb' : '#f9fafb',
                  border: `1px solid ${patient.systemicDiseases ? '#fde68a' : '#e5e7eb'}`,
                }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: patient.systemicDiseases ? '#92400e' : '#6b7280', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Bệnh toàn thân
                  </p>
                  <p style={{ fontSize: '13px', color: patient.systemicDiseases ? '#78350f' : '#9ca3af', margin: 0 }}>
                    {patient.systemicDiseases || 'Không có'}
                  </p>
                </div>
                {/* Anxiety level */}
                {patient.dentalAnxietyLevel && (
                  <ViewField
                    label="Mức độ lo lắng"
                    value={ANXIETY_META[patient.dentalAnxietyLevel]?.label ?? patient.dentalAnxietyLevel}
                  />
                )}
                {/* Internal note (doctor only) */}
                {(role === 'DOCTOR' || role === 'ADMIN') && patient.internalNote && (
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Ghi chú nội bộ (bác sĩ)</span>
                    <p style={{ fontSize: '12px', color: '#374151', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{patient.internalNote}</p>
                  </div>
                )}
                {!patient.allergies && !patient.systemicDiseases && !patient.dentalAnxietyLevel && (
                  <p style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>
                    Chưa có thông tin y tế
                    {role === 'DOCTOR' && ' – Bác sĩ có thể cập nhật qua nút "Cập nhật y tế"'}
                  </p>
                )}
              </div>
            ) : (
              /* Medical edit form */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '4px' }}>Dị ứng (thuốc, vật liệu nha khoa)</label>
                  <textarea value={medForm.allergies} onChange={e => setMed('allergies')(e.target.value)} rows={2} placeholder="VD: Dị ứng Penicillin, Thuốc tê có Adrenalin" style={{ ...inputBase, resize: 'vertical', lineHeight: 1.5 }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '4px' }}>Bệnh toàn thân</label>
                  <textarea value={medForm.systemicDiseases} onChange={e => setMed('systemicDiseases')(e.target.value)} rows={2} placeholder="VD: Huyết áp cao, Tiểu đường, Tim mạch..." style={{ ...inputBase, resize: 'vertical', lineHeight: 1.5 }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '4px' }}>Mức độ lo lắng</label>
                  <select value={medForm.dentalAnxietyLevel} onChange={e => setMed('dentalAnxietyLevel')(e.target.value)} style={inputBase}>
                    <option value="NONE">Không lo lắng</option>
                    <option value="LOW">Lo lắng nhẹ</option>
                    <option value="MEDIUM">Lo lắng vừa</option>
                    <option value="HIGH">Lo lắng nhiều</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '4px' }}>Ghi chú nội bộ (bác sĩ)</label>
                  <textarea value={medForm.internalNote} onChange={e => setMed('internalNote')(e.target.value)} rows={2} placeholder="Ghi chú lâm sàng nội bộ..." style={{ ...inputBase, resize: 'vertical', lineHeight: 1.5 }} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB: Sơ đồ răng (Doctor)
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'tooth-chart' && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <SectionHeader icon={Activity} title="Sơ đồ răng FDI" color="#7c3aed" />
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {editMedical ? (
                <>
                  <button onClick={() => { setMedForm(patientToMedical(patient)); setEditMedical(false) }} style={{ padding: '7px 14px', border: '1.5px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', color: '#374151', fontSize: '12px', cursor: 'pointer' }}>
                    Hủy
                  </button>
                  <button onClick={handleSaveMedical} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 16px', border: 'none', borderRadius: '8px', backgroundColor: '#7c3aed', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    {saving && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                    Lưu sơ đồ
                  </button>
                </>
              ) : (
                role === 'DOCTOR' && (
                  <button onClick={() => setEditMedical(true)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', border: '1.5px solid #7c3aed', borderRadius: '8px', backgroundColor: 'white', color: '#7c3aed', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    <Pencil size={12} /> Chỉnh sửa
                  </button>
                )
              )}
            </div>
          </div>
          <ToothChart
            chart={editMedical ? medForm.toothChart : (patient.toothChart ?? {})}
            editable={editMedical && role === 'DOCTOR'}
            onChange={editMedical ? (c) => setMed('toothChart')(c) : undefined}
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB: Lịch hẹn (Receptionist)
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'appointments' && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <SectionHeader icon={Calendar} title="Lịch hẹn" />
            {role === 'RECEPTIONIST' && (
              <button
                onClick={() => navigate(`/staff/appointments/new`)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', border: 'none', borderRadius: '8px', backgroundColor: '#2563eb', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                + Đặt lịch
              </button>
            )}
          </div>
          {aptsLoading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#9ca3af' }}>Đang tải...</div>
          ) : appointments.length === 0 ? (
            <PlaceholderTab icon={Calendar} title="Lịch hẹn" subtitle="Chưa có lịch hẹn nào sắp tới." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {appointments.map(apt => <AppointmentRow key={apt.id} apt={apt} />)}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB: Lịch sử tiếp đón (Receptionist)
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'reception-history' && (
        <ReceptionHistoryTab patientId={Number(id)} />
      )}

      {/* ══════════════════════════════════════════════════════
          TAB: Lịch sử điều trị (Doctor)
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'treatment' && (
        <TreatmentHistoryTab patientId={Number(id)} />
      )}

      {/* ══════════════════════════════════════════════════════
          TAB: X-quang (Doctor)
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'xray' && (
        <div style={card}>
          <PlaceholderTab icon={Image} title="X-quang & Hình ảnh" subtitle="Chưa có hình ảnh nào được tải lên." />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB: Hóa đơn (Accountant / Admin)
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'invoices' && (
        <PatientInvoicesTab patientId={Number(id)} />
      )}
    </div>
  )
}
