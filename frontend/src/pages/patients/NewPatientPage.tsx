import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  User, Phone, Calendar, IdCard, Shield, MapPin, Briefcase,
  AlertTriangle, CheckCircle2, ChevronLeft, Loader2,
  Search, X, Stethoscope, Clock,
} from 'lucide-react'
import { patientsApi, type DuplicateError } from '../../api/patients.api'
import { api } from '../../api/auth.api'
import { appointmentsApi } from '../../api/appointments.api'
import type { AppointmentItem } from '../../api/appointments.api'

// ─── Design helpers ───────────────────────────────────────────

const section: React.CSSProperties = {
  backgroundColor: 'white', borderRadius: '14px',
  border: '1px solid #e5e7eb', padding: '24px 28px', marginBottom: '20px',
}
const label: React.CSSProperties = { fontSize: '13px', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '6px' }
const required = <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>
const inputBase: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb',
  borderRadius: '8px', fontSize: '13px', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit', backgroundColor: 'white',
}
const inputError: React.CSSProperties = { ...inputBase, borderColor: '#ef4444' }
const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }
const errorMsg: React.CSSProperties = { fontSize: '12px', color: '#ef4444', marginTop: '4px' }

function FieldInput({
  icon: Icon, placeholder, value, onChange, type = 'text', error,
}: {
  icon?: any; placeholder: string; value: string
  onChange: (v: string) => void; type?: string; error?: string
}) {
  return (
    <div style={{ position: 'relative' }}>
      {Icon && <Icon size={14} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{ ...(error ? inputError : inputBase), paddingLeft: Icon ? '34px' : '12px' }}
      />
      {error && <p style={errorMsg}>{error}</p>}
    </div>
  )
}

// ─── Duplicate warning ────────────────────────────────────────

function DuplicateWarning({
  dup, onProceed, onGoToExisting,
}: {
  dup: DuplicateError
  onProceed: () => void
  onGoToExisting: () => void
}) {
  return (
    <div style={{
      backgroundColor: '#fff7ed', border: '1px solid #fed7aa',
      borderRadius: '12px', padding: '20px 24px', marginBottom: '20px',
    }}>
      <div style={{ display: 'flex', gap: '12px' }}>
        <AlertTriangle size={20} color="#ea580c" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: '14px', color: '#9a3412', margin: 0 }}>
            {dup.message}
          </p>
          <p style={{ fontSize: '13px', color: '#c2410c', marginTop: '6px' }}>
            Hồ sơ hiện có: <strong>{dup.duplicate.patient.code}</strong> – {dup.duplicate.patient.fullName} ({dup.duplicate.patient.phone})
          </p>
          <p style={{ fontSize: '12px', color: '#ea580c', marginTop: '4px' }}>
            Kiểm tra lại: nếu là cùng một người, hãy xem hồ sơ hiện có. Nếu khác người, tiếp tục đăng ký mới.
          </p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
            <button
              onClick={onGoToExisting}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: '1.5px solid #ea580c',
                backgroundColor: 'white', color: '#ea580c', fontWeight: 600,
                fontSize: '13px', cursor: 'pointer',
              }}
            >
              Xem hồ sơ hiện có
            </button>
            <button
              onClick={onProceed}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none',
                backgroundColor: '#ea580c', color: 'white', fontWeight: 600,
                fontSize: '13px', cursor: 'pointer',
              }}
            >
              Tiếp tục đăng ký mới
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────

// ─── Classification config ────────────────────────────────────

const CLASSIFICATIONS = [
  { value: 'NEW',      label: 'Mới',                 color: '#6b7280', bg: '#f3f4f6', border: '#d1d5db' },
  { value: 'RETURNING',label: 'Tái khám',            color: '#2563eb', bg: '#eff6ff', border: '#93c5fd' },
  { value: 'VIP',      label: 'VIP',                 color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
  { value: 'SPECIAL',  label: 'Theo dõi đặc biệt',  color: '#dc2626', bg: '#fff1f2', border: '#fca5a5' },
]

interface FormState {
  fullName: string; dateOfBirth: string; gender: string; phone: string
  nationalId: string; bhytCode: string; address: string; occupation: string
  emergencyContactName: string; emergencyContactPhone: string; adminNote: string
  classification: string
}
const INIT: FormState = {
  fullName: '', dateOfBirth: '', gender: 'NAM', phone: '',
  nationalId: '', bhytCode: '', address: '', occupation: '',
  emergencyContactName: '', emergencyContactPhone: '', adminNote: '',
  classification: 'NEW',
}

export default function NewPatientPage() {
  const navigate      = useNavigate()
  const [params]      = useSearchParams()
  const urlApptId     = params.get('appointmentId') ? Number(params.get('appointmentId')) : undefined

  const [form,       setForm]       = useState<FormState>(INIT)
  const [errors,     setErrors]     = useState<Partial<FormState>>({})
  const [saving,     setSaving]     = useState(false)
  const [success,    setSuccess]    = useState('')
  const [apiError,   setApiError]   = useState('')
  const [duplicate,  setDuplicate]  = useState<DuplicateError | null>(null)
  const [forceNew,   setForceNew]   = useState(false)

  // ── Appointment reference lookup ──────────────────────────────
  const [apptCode,     setApptCode]     = useState('')
  const [apptLooking,  setApptLooking]  = useState(false)
  const [apptFound,    setApptFound]    = useState<AppointmentItem | null>(null)
  const [apptError,    setApptError]    = useState('')
  const [linkedApptId, setLinkedApptId] = useState<number | undefined>(urlApptId)
  const apptDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // effective appointmentId to submit
  const appointmentId = linkedApptId

  useEffect(() => {
    if (apptDebounce.current) clearTimeout(apptDebounce.current)
    if (!apptCode.trim()) { setApptFound(null); setApptError(''); return }

    apptDebounce.current = setTimeout(async () => {
      setApptLooking(true); setApptError(''); setApptFound(null)
      try {
        const res = await appointmentsApi.list({ search: apptCode.trim(), limit: 5 })
        const match = res.data.items.find(
          a => a.code.toLowerCase() === apptCode.trim().toLowerCase()
        ) ?? res.data.items[0] ?? null
        if (match) {
          setApptFound(match)
          setLinkedApptId(match.id)
        } else {
          setApptError('Không tìm thấy lịch hẹn với mã này')
          setLinkedApptId(undefined)
        }
      } catch {
        setApptError('Lỗi tra cứu lịch hẹn')
        setLinkedApptId(undefined)
      } finally { setApptLooking(false) }
    }, 500)
  }, [apptCode])

  const clearAppt = () => {
    setApptCode('')
    setApptFound(null)
    setApptError('')
    setLinkedApptId(urlApptId)
  }

  // A3: prefill from URL appointment param
  useEffect(() => {
    if (!urlApptId) return
    api.get(`/receptionist/appointments/${urlApptId}`)
      .then(res => {
        const apt = res.data
        if (apt?.patientName) {
          setForm(f => ({
            ...f,
            fullName:    apt.patientName    ?? '',
            phone:       apt.patientPhone   ?? '',
            dateOfBirth: apt.patientDob ? apt.patientDob.slice(0, 10) : '',
            gender:      apt.patientGender  ?? 'NAM',
          }))
        }
      })
      .catch(() => {})
  }, [urlApptId])

  const set = (key: keyof FormState) => (v: string) => {
    setForm(f => ({ ...f, [key]: v }))
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }))
    setDuplicate(null); setForceNew(false)
  }

  // Validation
  const validate = (): boolean => {
    const e: Partial<FormState> = {}
    if (!form.fullName.trim())    e.fullName    = 'Họ và tên không được để trống'
    if (!form.dateOfBirth)        e.dateOfBirth = 'Ngày sinh không được để trống'
    if (!form.phone.trim())       e.phone       = 'Số điện thoại không được để trống'
    else if (!/^0\d{9,10}$/.test(form.phone.replace(/\s/g, '')))
      e.phone = 'Số điện thoại không hợp lệ (10–11 chữ số, bắt đầu bằng 0)'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSaving(true); setApiError(''); setDuplicate(null)

    const payload = {
      fullName:              form.fullName.trim(),
      dateOfBirth:           form.dateOfBirth,
      gender:                form.gender,
      phone:                 form.phone.trim(),
      classification:        form.classification,
      nationalId:            form.nationalId.trim() || undefined,
      bhytCode:              form.bhytCode.trim()   || undefined,
      address:               form.address.trim()    || undefined,
      occupation:            form.occupation.trim() || undefined,
      emergencyContactName:  form.emergencyContactName.trim()  || undefined,
      emergencyContactPhone: form.emergencyContactPhone.trim() || undefined,
      adminNote:             form.adminNote.trim()  || undefined,
      appointmentId,
    }

    try {
      const res = await patientsApi.create(payload)
      const patient = res.data
      setSuccess(`Đã tạo hồ sơ bệnh nhân: ${patient.code}`)
      setTimeout(() => navigate(`/staff/patients/${patient.id}`), 1500)
    } catch (err: any) {
      if (err?.response?.status === 409 && !forceNew) {
        setDuplicate(err.response.data as DuplicateError)
      } else {
        setApiError(err?.response?.data?.message ?? 'Lỗi kết nối. Vui lòng thử lại.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: '860px', margin: '0 auto' }}>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px', fontSize: '13px', color: '#6b7280' }}>
        <Link to="/staff/patients" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>Bệnh nhân</Link>
        <span>›</span>
        <span>Đăng ký mới</span>
      </div>

      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/staff/patients')}
          style={{ padding: '7px', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer', display: 'flex' }}
        >
          <ChevronLeft size={16} color="#6b7280" />
        </button>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>Đăng ký bệnh nhân mới</h1>
          <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>Tạo hồ sơ cho bệnh nhân lần đầu đến phòng khám.</p>
        </div>
      </div>

      {appointmentId && (
        <div style={{ padding: '12px 16px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', marginBottom: '20px', fontSize: '13px', color: '#1d4ed8' }}>
          Đang tạo hồ sơ từ lịch hẹn #{appointmentId}. Thông tin đã được điền sẵn – hãy kiểm tra và bổ sung.
        </div>
      )}

      {/* Duplicate warning (A1) */}
      {duplicate && (
        <DuplicateWarning
          dup={duplicate}
          onProceed={() => { setForceNew(true); setDuplicate(null) }}
          onGoToExisting={() => navigate(`/staff/patients/${duplicate.duplicate.patient.id}`)}
        />
      )}

      {/* Success */}
      {success && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '14px 20px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: '10px', marginBottom: '20px',
        }}>
          <CheckCircle2 size={18} color="#16a34a" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#15803d' }}>{success}</span>
        </div>
      )}

      {/* Section 1 – Required */}
      <div style={section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <User size={16} color="#2563eb" />
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0 }}>Thông tin cá nhân</h2>
          <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 500 }}>Bắt buộc</span>
        </div>

        <div style={row2}>
          <div>
            <label style={label}>Họ và tên {required}</label>
            <FieldInput icon={User} placeholder="Nhập họ và tên bệnh nhân" value={form.fullName} onChange={set('fullName')} error={errors.fullName} />
          </div>
          <div>
            <label style={label}>Ngày sinh {required}</label>
            <input
              type="date"
              value={form.dateOfBirth}
              max={new Date().toISOString().slice(0, 10)}
              onChange={e => set('dateOfBirth')(e.target.value)}
              style={errors.dateOfBirth ? inputError : inputBase}
            />
            {errors.dateOfBirth && <p style={errorMsg}>{errors.dateOfBirth}</p>}
          </div>
        </div>

        <div style={{ ...row2, marginTop: '16px' }}>
          <div>
            <label style={label}>Giới tính {required}</label>
            <div style={{ display: 'flex', gap: '20px', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white' }}>
              {[{ value: 'NAM', label: 'Nam' }, { value: 'NU', label: 'Nữ' }].map(g => (
                <label key={g.value} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
                  <input
                    type="radio" name="gender" value={g.value}
                    checked={form.gender === g.value}
                    onChange={() => set('gender')(g.value)}
                    style={{ accentColor: '#2563eb' }}
                  />
                  {g.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label style={label}>Số điện thoại {required}</label>
            <FieldInput icon={Phone} placeholder="0912345678" value={form.phone} onChange={set('phone')} error={errors.phone} />
          </div>
        </div>

        {/* Phân loại bệnh nhân */}
        <div style={{ marginTop: '16px' }}>
          <label style={label}>Phân loại bệnh nhân {required}</label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {CLASSIFICATIONS.map(cls => {
              const active = form.classification === cls.value
              return (
                <button
                  key={cls.value}
                  type="button"
                  onClick={() => set('classification')(cls.value)}
                  style={{
                    flex: '1 1 120px',
                    padding: '10px 14px',
                    borderRadius: '9px',
                    border: `2px solid ${active ? cls.color : cls.border}`,
                    backgroundColor: active ? cls.bg : '#fafafa',
                    color: active ? cls.color : '#6b7280',
                    fontWeight: active ? 700 : 500,
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: active ? `0 0 0 3px ${cls.color}22` : 'none',
                  }}
                >
                  {cls.label}
                </button>
              )
            })}
          </div>
          <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '6px' }}>
            Mặc định: Mới. Phân loại ảnh hưởng đến ưu tiên hàng chờ và quy trình khám.
          </p>
        </div>
      </div>

      {/* Section 2 – Optional */}
      <div style={section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <IdCard size={16} color="#059669" />
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0 }}>Thông tin bổ sung</h2>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>Tùy chọn</span>
        </div>

        <div style={row2}>
          <div>
            <label style={label}>Số CCCD / CMND</label>
            <FieldInput icon={IdCard} placeholder="Nhập số CCCD" value={form.nationalId} onChange={set('nationalId')} />
            <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Bỏ trống nếu bệnh nhân không mang giấy tờ tùy thân.</p>
          </div>
          <div>
            <label style={label}>Mã Thẻ BHYT</label>
            <FieldInput icon={Shield} placeholder="Nhập mã thẻ BHYT (nếu có)" value={form.bhytCode} onChange={set('bhytCode')} />
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={label}>Địa chỉ hiện tại</label>
          <div style={{ position: 'relative' }}>
            <MapPin size={14} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '12px' }} />
            <input
              value={form.address}
              onChange={e => set('address')(e.target.value)}
              placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
              style={{ ...inputBase, paddingLeft: '34px' }}
            />
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={label}>Nghề nghiệp</label>
          <FieldInput icon={Briefcase} placeholder="Nhập nghề nghiệp" value={form.occupation} onChange={set('occupation')} />
        </div>

        {/* Appointment reference */}
        <div style={{ marginTop: '16px' }}>
          <label style={label}>
            Mã lịch hẹn trước
            <span style={{ fontSize: '11px', fontWeight: 400, color: '#9ca3af', marginLeft: 6 }}>
              (Tùy chọn — nhập để liên kết hồ sơ với lịch hẹn đã đặt)
            </span>
          </label>
          <div style={{ position: 'relative' }}>
            <Search size={14} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              value={apptCode}
              onChange={e => setApptCode(e.target.value)}
              placeholder="VD: LH-20260608-0001"
              style={{ ...inputBase, paddingLeft: '34px', paddingRight: apptFound ? '36px' : '12px' }}
            />
            {apptLooking && (
              <Loader2 size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', animation: 'spin 1s linear infinite', color: '#9ca3af' }} />
            )}
            {apptFound && (
              <button
                onClick={clearAppt}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0 }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Found preview */}
          {apptFound && (
            <div style={{
              marginTop: '8px', padding: '10px 14px', borderRadius: '8px',
              background: '#f0fdf4', border: '1.5px solid #86efac',
              display: 'flex', gap: '10px', alignItems: 'flex-start',
            }}>
              <CheckCircle2 size={15} color="#16a34a" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, fontSize: '12px' }}>
                <div style={{ fontWeight: 700, color: '#15803d', marginBottom: 3 }}>
                  Đã tìm thấy · <span style={{ fontFamily: 'monospace' }}>{apptFound.code}</span>
                </div>
                <div style={{ color: '#374151', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {apptFound.patientName && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <User size={11} /> {apptFound.patientName}
                    </span>
                  )}
                  {apptFound.serviceName && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Stethoscope size={11} /> {apptFound.serviceName}
                    </span>
                  )}
                  {apptFound.doctorName && (
                    <span>BS. {apptFound.doctorName}</span>
                  )}
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#6b7280' }}>
                    <Clock size={11} />
                    {new Date(apptFound.appointmentDate).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {apptError && (
            <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={11} /> {apptError}
            </p>
          )}
        </div>
      </div>

      {/* Section 3 – Emergency & Note */}
      <div style={section}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <AlertTriangle size={16} color="#f59e0b" />
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0 }}>Liên hệ khẩn cấp & Ghi chú</h2>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>Tùy chọn</span>
        </div>

        <div style={row2}>
          <div>
            <label style={label}>Người liên hệ khẩn cấp</label>
            <FieldInput icon={User} placeholder="Họ tên người liên hệ" value={form.emergencyContactName} onChange={set('emergencyContactName')} />
          </div>
          <div>
            <label style={label}>Số điện thoại liên hệ khẩn cấp</label>
            <FieldInput icon={Phone} placeholder="Số điện thoại" value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} />
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <label style={label}>Ghi chú hành chính</label>
          <textarea
            value={form.adminNote}
            onChange={e => set('adminNote')(e.target.value)}
            placeholder="Nhập ghi chú cho bộ phận lễ tân (nếu có)"
            rows={3}
            style={{ ...inputBase, resize: 'vertical', lineHeight: 1.5 }}
          />
          <p style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>
            Lưu ý: Chỉ ghi chú thông tin hành chính. KHÔNG nhập thông tin y tế, tiền sử bệnh, dị ứng vào đây.
          </p>
        </div>
      </div>

      {/* API error */}
      {apiError && (
        <div style={{ padding: '12px 16px', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', marginBottom: '20px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#be123c', fontWeight: 500 }}>{apiError}</p>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '4px' }}>
        <button
          onClick={() => navigate('/staff/patients')}
          disabled={saving}
          style={{
            padding: '10px 24px', border: '1.5px solid #e5e7eb', borderRadius: '9px',
            backgroundColor: 'white', color: '#374151', fontWeight: 500, fontSize: '13px', cursor: 'pointer',
          }}
        >
          Hủy bỏ
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !!success}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '10px 28px', border: 'none', borderRadius: '9px',
            backgroundColor: saving || success ? '#93c5fd' : '#2563eb',
            color: 'white', fontWeight: 600, fontSize: '13px', cursor: saving ? 'wait' : 'pointer',
          }}
        >
          {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
          Lưu / Đăng ký
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
