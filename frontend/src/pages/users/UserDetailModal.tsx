import { useState, useEffect, useRef } from 'react'
import { X, RefreshCw, Eye, EyeOff, Upload, FileText, Image, Trash2, Camera } from 'lucide-react'
import { authApi } from '../../api/auth.api'

const ROLE_INFO: Record<string, { label: string; color: string; bg: string }> = {
  ADMIN:        { label: 'Admin',   color: '#2563eb', bg: '#eff6ff' },
  DOCTOR:       { label: 'Bác sĩ', color: '#16a34a', bg: '#f0fdf4' },
  RECEPTIONIST: { label: 'Lễ tân', color: '#7c3aed', bg: '#f5f3ff' },
  ACCOUNTANT:   { label: 'Kế toán',color: '#d97706', bg: '#fffbeb' },
}

const STAFF_ROLES = [
  { key: 'ADMIN',        label: 'Admin',   color: '#2563eb', bg: '#eff6ff' },
  { key: 'RECEPTIONIST', label: 'Lễ tân',  color: '#7c3aed', bg: '#f5f3ff' },
  { key: 'DOCTOR',       label: 'Bác sĩ',  color: '#16a34a', bg: '#f0fdf4' },
  { key: 'ACCOUNTANT',   label: 'Kế toán', color: '#d97706', bg: '#fffbeb' },
]

const generatePassword = () => {
  const u = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', l = 'abcdefghijklmnopqrstuvwxyz'
  const d = '0123456789', s = '!@#$%&*', a = u + l + d + s
  let pw = u[Math.floor(Math.random()*u.length)] + l[Math.floor(Math.random()*l.length)]
         + d[Math.floor(Math.random()*d.length)] + s[Math.floor(Math.random()*s.length)]
  for (let i = 4; i < 12; i++) pw += a[Math.floor(Math.random()*a.length)]
  return pw.split('').sort(() => Math.random()-0.5).join('')
}

const fmtDate = (v: any) => {
  if (!v) return ''
  const s = typeof v === 'string' ? v : v.toISOString()
  return s.slice(0, 10)
}

interface Props { userId: number; onClose: () => void; onSuccess: () => void }

type TabKey = 'personal' | 'professional' | 'employment' | 'salary' | 'certs' | 'security'

export default function UserDetailModal({ userId, onClose, onSuccess }: Props) {
  const [user, setUser]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<TabKey>('personal')

  // Avatar
  const [avatarPreview, setAvatarPreview] = useState<string>('')
  const [avatarFile, setAvatarFile]       = useState<File | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Personal + admin fields (shared across all roles)
  const [personal, setPersonal] = useState({
    fullName: '', email: '', phone: '', address: '', gender: '',
    dateOfBirth: '', nationalId: '', issueDate: '', issuePlace: '',
    hometown: '', maritalStatus: '', emergencyContactName: '',
    emergencyContactPhone: '', notes: '',
  })
  const [savingPersonal, setSavingPersonal] = useState(false)
  const [personalMsg, setPersonalMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Professional (doctor only)
  const [professional, setProfessional] = useState({
    specialization: '', degree: '', educationLevel: '', graduatedSchool: '',
    graduationYear: '', licenseNumber: '', licenseIssueDate: '',
    licenseExpiryDate: '', yearsOfExperience: '',
  })
  const [savingProf, setSavingProf] = useState(false)
  const [profMsg, setProfMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Employment
  const [employment, setEmployment] = useState({
    employmentStatus: '', position: '', workType: '',
    startDate: '', endDate: '', contractNumber: '',
  })
  const [savingEmp, setSavingEmp] = useState(false)
  const [empMsg, setEmpMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Salary
  const [salary, setSalary] = useState({
    baseSalary: '', salaryType: '', commissionRate: '',
    bankAccountName: '', bankName: '', bankAccountNumber: '',
    taxCode: '', insuranceNumber: '',
  })
  const [savingSalary, setSavingSalary] = useState(false)
  const [salaryMsg, setSalaryMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Role
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [savingRoles, setSavingRoles] = useState(false)
  const [roleMsg, setRoleMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Security
  const [newPw, setNewPw]         = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [resetting, setResetting] = useState(false)
  const [pwMsg, setPwMsg]         = useState<{ ok: boolean; text: string } | null>(null)

  // Certificates
  const [certs, setCerts]               = useState<any[]>([])
  const [certDragging, setCertDragging] = useState(false)
  const [certUploading, setCertUploading] = useState(false)
  const [certMsg, setCertMsg]           = useState<{ ok: boolean; text: string } | null>(null)
  const certInputRef = useRef<HTMLInputElement>(null)

  const loadCerts = () =>
    authApi.getCertificates(userId).then(r => setCerts(r.data)).catch(() => {})

  useEffect(() => {
    authApi.getUserById(userId).then(r => {
      const u = r.data
      setUser(u)
      const p = u.doctorProfile ?? u.receptionistProfile ?? u.accountantProfile ?? u.adminProfile ?? {}

      if (p.avatar) setAvatarPreview(`http://localhost:5000${p.avatar}`)

      setPersonal({
        fullName: u.fullName ?? '',
        email: u.email ?? '',
        phone: p.phone ?? '',
        address: p.address ?? '',
        gender: p.gender ?? '',
        dateOfBirth: fmtDate(p.dateOfBirth),
        nationalId: p.nationalId ?? '',
        issueDate: fmtDate(p.issueDate),
        issuePlace: p.issuePlace ?? '',
        hometown: p.hometown ?? '',
        maritalStatus: p.maritalStatus ?? '',
        emergencyContactName: p.emergencyContactName ?? '',
        emergencyContactPhone: p.emergencyContactPhone ?? '',
        notes: p.notes ?? '',
      })
      setSelectedRoles(u.roles?.map((r: any) => r.role.name) ?? [])

      const dp = u.doctorProfile ?? {}
      setProfessional({
        specialization: dp.specialization ?? '',
        degree: dp.degree ?? '',
        educationLevel: dp.educationLevel ?? '',
        graduatedSchool: dp.graduatedSchool ?? '',
        graduationYear: dp.graduationYear?.toString() ?? '',
        licenseNumber: dp.licenseNumber ?? '',
        licenseIssueDate: fmtDate(dp.licenseIssueDate),
        licenseExpiryDate: fmtDate(dp.licenseExpiryDate),
        yearsOfExperience: dp.yearsOfExperience?.toString() ?? '',
      })
      setEmployment({
        employmentStatus: dp.employmentStatus ?? '',
        position: dp.position ?? '',
        workType: dp.workType ?? '',
        startDate: fmtDate(dp.startDate),
        endDate: fmtDate(dp.endDate),
        contractNumber: dp.contractNumber ?? '',
      })
      setSalary({
        baseSalary: dp.baseSalary?.toString() ?? '',
        salaryType: dp.salaryType ?? '',
        commissionRate: dp.commissionRate?.toString() ?? '',
        bankAccountName: dp.bankAccountName ?? '',
        bankName: dp.bankName ?? '',
        bankAccountNumber: dp.bankAccountNumber ?? '',
        taxCode: dp.taxCode ?? '',
        insuranceNumber: dp.insuranceNumber ?? '',
      })
    }).finally(() => setLoading(false))
    loadCerts()
  }, [userId])

  const isDoctor = user?.roles?.some((r: any) => r.role.name === 'DOCTOR')
  const roles: string[] = user?.roles?.map((r: any) => r.role.name) ?? []

  // ─── Handlers ────────────────────────────────────────────────
  const handleAvatarChange = (file: File) => {
    if (!file.type.startsWith('image/')) return
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSavePersonal = async () => {
    setSavingPersonal(true); setPersonalMsg(null)
    try {
      if (avatarFile) await authApi.uploadAvatar(userId, avatarFile)
      await authApi.updateProfile(userId, personal)
      setAvatarFile(null)
      setPersonalMsg({ ok: true, text: 'Cập nhật thông tin cá nhân thành công.' })
      onSuccess()
    } catch (err: any) {
      setPersonalMsg({ ok: false, text: err.response?.data?.message || 'Lỗi hệ thống' })
    } finally { setSavingPersonal(false) }
  }

  const handleSaveProfessional = async () => {
    setSavingProf(true); setProfMsg(null)
    try {
      await authApi.updateProfile(userId, {
        ...professional,
        graduationYear: professional.graduationYear ? Number(professional.graduationYear) : null,
        yearsOfExperience: professional.yearsOfExperience ? Number(professional.yearsOfExperience) : null,
      })
      setProfMsg({ ok: true, text: 'Cập nhật thông tin chuyên môn thành công.' })
      onSuccess()
    } catch (err: any) {
      setProfMsg({ ok: false, text: err.response?.data?.message || 'Lỗi hệ thống' })
    } finally { setSavingProf(false) }
  }

  const handleSaveEmployment = async () => {
    setSavingEmp(true); setEmpMsg(null)
    try {
      await authApi.updateProfile(userId, employment)
      setEmpMsg({ ok: true, text: 'Cập nhật thông tin công việc thành công.' })
      onSuccess()
    } catch (err: any) {
      setEmpMsg({ ok: false, text: err.response?.data?.message || 'Lỗi hệ thống' })
    } finally { setSavingEmp(false) }
  }

  const handleSaveSalary = async () => {
    setSavingSalary(true); setSalaryMsg(null)
    try {
      await authApi.updateProfile(userId, {
        ...salary,
        baseSalary: salary.baseSalary ? Number(salary.baseSalary) : null,
        commissionRate: salary.commissionRate ? Number(salary.commissionRate) : null,
      })
      setSalaryMsg({ ok: true, text: 'Cập nhật thông tin tài chính thành công.' })
      onSuccess()
    } catch (err: any) {
      setSalaryMsg({ ok: false, text: err.response?.data?.message || 'Lỗi hệ thống' })
    } finally { setSavingSalary(false) }
  }

  const handleSaveRoles = async () => {
    if (selectedRoles.length === 0) return setRoleMsg({ ok: false, text: 'Phải có ít nhất một vai trò.' })
    setSavingRoles(true); setRoleMsg(null)
    try {
      await authApi.updateUserRoles(userId, selectedRoles)
      setRoleMsg({ ok: true, text: 'Cập nhật vai trò thành công.' })
      onSuccess()
    } catch (err: any) {
      setRoleMsg({ ok: false, text: err.response?.data?.message || 'Lỗi hệ thống' })
    } finally { setSavingRoles(false) }
  }

  const handleResetPassword = async () => {
    if (!newPw) return setPwMsg({ ok: false, text: 'Vui lòng nhập mật khẩu mới.' })
    setResetting(true); setPwMsg(null)
    try {
      await authApi.adminResetPassword(userId, newPw)
      setPwMsg({ ok: true, text: 'Đặt lại mật khẩu thành công, mật khẩu mới đã gửi qua email.' })
      setNewPw('')
    } catch (err: any) {
      setPwMsg({ ok: false, text: err.response?.data?.message || 'Lỗi hệ thống' })
    } finally { setResetting(false) }
  }

  const CERT_ALLOWED = ['application/pdf', 'image/png', 'image/jpeg']
  const handleCertUpload = async (file: File) => {
    if (!CERT_ALLOWED.includes(file.type))
      return setCertMsg({ ok: false, text: `"${file.name}" không đúng định dạng (chỉ PDF, PNG, JPG).` })
    if (file.size > 10 * 1024 * 1024)
      return setCertMsg({ ok: false, text: `"${file.name}" vượt quá 10MB.` })
    setCertUploading(true); setCertMsg(null)
    try {
      await authApi.uploadCertificate(userId, file)
      setCertMsg({ ok: true, text: `Tải lên "${file.name}" thành công.` })
      loadCerts()
    } catch {
      setCertMsg({ ok: false, text: 'Tải lên thất bại, vui lòng thử lại.' })
    } finally { setCertUploading(false) }
  }

  const handleCertDelete = async (certId: number) => {
    try {
      await authApi.deleteCertificate(userId, certId)
      setCerts(prev => prev.filter(c => c.id !== certId))
    } catch {
      setCertMsg({ ok: false, text: 'Xóa thất bại.' })
    }
  }

  const formatSize = (b: number) =>
    b < 1024*1024 ? `${(b/1024).toFixed(1)} KB` : `${(b/(1024*1024)).toFixed(1)} MB`

  // ─── Styles ──────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 11px', borderRadius: '7px',
    border: '1px solid #e5e7eb', fontSize: '13px', color: '#111827',
    outline: 'none', boxSizing: 'border-box', backgroundColor: 'white',
  }
  const lbl: React.CSSProperties = {
    fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '5px',
  }
  const sel: React.CSSProperties = { ...inp, cursor: 'pointer' }
  const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }
  const grid3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }
  const section = (title: string) => (
    <p style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', letterSpacing: '0.06em',
      textTransform: 'uppercase', marginTop: '4px', marginBottom: '10px',
      borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>{title}</p>
  )
  const msg = (m: { ok: boolean; text: string } | null) => m && (
    <div style={{
      padding: '8px 12px', borderRadius: '7px', fontSize: '12px', marginTop: '4px',
      backgroundColor: m.ok ? '#f0fdf4' : '#fef2f2',
      border: `1px solid ${m.ok ? '#86efac' : '#fca5a5'}`,
      color: m.ok ? '#16a34a' : '#dc2626',
    }}>{m.text}</div>
  )
  const saveBtn = (label: string, saving: boolean, onClick: () => void) => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px' }}>
      <button onClick={onClick} disabled={saving} style={{
        padding: '8px 18px', borderRadius: '8px', border: 'none',
        backgroundColor: saving ? '#93c5fd' : '#2563eb', color: 'white',
        fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
      }}>{saving ? 'Đang lưu...' : label}</button>
    </div>
  )

  const TABS: { key: TabKey; label: string; show?: boolean }[] = [
    { key: 'personal',     label: 'Cá nhân' },
    { key: 'professional', label: 'Chuyên môn', show: isDoctor },
    { key: 'employment',   label: 'Công việc',  show: isDoctor },
    { key: 'salary',       label: 'Tài chính',  show: isDoctor },
    { key: 'certs',        label: 'Bằng cấp' },
    { key: 'security',     label: 'Bảo mật' },
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '16px', width: '680px',
        maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 24px 0' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0 }}>Thông tin người dùng</h2>
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '3px' }}>Xem chi tiết và cập nhật thông tin nhân sự (UC05/UC06).</p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>Đang tải...</div>
        ) : (
          <>
            {/* Meta row */}
            <div style={{ display: 'flex', gap: '20px', padding: '12px 24px', flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { label: 'ID',       value: `U${String(user.id).padStart(2,'0')}` },
                { label: 'NGÀY TẠO', value: new Date(user.createdAt).toLocaleDateString('vi-VN') },
              ].map(m => (
                <div key={m.label}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em' }}>{m.label}</span>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', marginTop: '2px' }}>{m.value}</p>
                </div>
              ))}
              <div>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em' }}>VAI TRÒ</span>
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                  {roles.map(r => {
                    const cfg = ROLE_INFO[r] ?? { label: r, color: '#6b7280', bg: '#f3f4f6' }
                    return <span key={r} style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', color: cfg.color, backgroundColor: cfg.bg }}>{cfg.label}</span>
                  })}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em' }}>TRẠNG THÁI</span>
                <p style={{ marginTop: '4px', fontSize: '12px', fontWeight: 600, color: user.isActive ? '#16a34a' : '#d97706' }}>
                  {user.isActive ? 'Hoạt động' : 'Bị khóa'}
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', padding: '0 24px', overflowX: 'auto' }}>
              {TABS.filter(t => t.show !== false).map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  padding: '9px 14px', fontSize: '12px', fontWeight: tab === t.key ? 600 : 400,
                  color: tab === t.key ? '#2563eb' : '#6b7280', border: 'none',
                  borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
                  background: 'none', cursor: 'pointer', marginBottom: '-1px', whiteSpace: 'nowrap',
                }}>{t.label}</button>
              ))}
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* ── TAB CÁ NHÂN ─────────────────────────────── */}
              {tab === 'personal' && (
                <>
                  {/* Avatar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div
                      onClick={() => avatarInputRef.current?.click()}
                      style={{
                        width: '80px', height: '80px', borderRadius: '50%', flexShrink: 0,
                        border: '2px dashed #bfdbfe', cursor: 'pointer', overflow: 'hidden',
                        backgroundColor: '#eff6ff', position: 'relative',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {avatarPreview
                        ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <Camera size={28} color="#93c5fd" />
                      }
                      <div style={{
                        position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.35)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0,
                        transition: 'opacity 0.15s',
                      }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                      >
                        <Camera size={18} color="white" />
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
                        {avatarFile ? `Đã chọn: ${avatarFile.name}` : 'Ảnh đại diện'}
                      </p>
                      <p style={{ fontSize: '12px', color: '#6b7280' }}>Nhấn vào ảnh để thay đổi. JPG, PNG · Tối đa 5MB</p>
                    </div>
                    <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarChange(f); e.target.value = '' }} />
                  </div>

                  {section('Thông tin cơ bản')}
                  <div style={grid2}>
                    <div><label style={lbl}>Họ và tên <span style={{ color: '#ef4444' }}>*</span></label>
                      <input style={inp} value={personal.fullName} onChange={e => setPersonal(p => ({ ...p, fullName: e.target.value }))} /></div>
                    <div><label style={lbl}>Email <span style={{ color: '#ef4444' }}>*</span></label>
                      <input style={inp} type="email" value={personal.email} onChange={e => setPersonal(p => ({ ...p, email: e.target.value }))} /></div>
                  </div>
                  <div style={grid2}>
                    <div><label style={lbl}>Giới tính</label>
                      <select style={sel} value={personal.gender} onChange={e => setPersonal(p => ({ ...p, gender: e.target.value }))}>
                        <option value="">-- Chọn --</option>
                        <option value="male">Nam</option>
                        <option value="female">Nữ</option>
                        <option value="other">Khác</option>
                      </select></div>
                    <div><label style={lbl}>Ngày sinh</label>
                      <input style={inp} type="date" value={personal.dateOfBirth} onChange={e => setPersonal(p => ({ ...p, dateOfBirth: e.target.value }))} /></div>
                  </div>
                  <div style={grid2}>
                    <div><label style={lbl}>Số điện thoại</label>
                      <input style={inp} placeholder="0901 234 567" value={personal.phone} onChange={e => setPersonal(p => ({ ...p, phone: e.target.value }))} /></div>
                    <div><label style={lbl}>Quê quán</label>
                      <input style={inp} placeholder="Hà Nội" value={personal.hometown} onChange={e => setPersonal(p => ({ ...p, hometown: e.target.value }))} /></div>
                  </div>
                  <div><label style={lbl}>Địa chỉ hiện tại</label>
                    <input style={inp} placeholder="Quận 1, TP.HCM" value={personal.address} onChange={e => setPersonal(p => ({ ...p, address: e.target.value }))} /></div>
                  <div><label style={lbl}>Tình trạng hôn nhân</label>
                    <select style={sel} value={personal.maritalStatus} onChange={e => setPersonal(p => ({ ...p, maritalStatus: e.target.value }))}>
                      <option value="">-- Chọn --</option>
                      <option value="single">Độc thân</option>
                      <option value="married">Đã kết hôn</option>
                      <option value="divorced">Ly hôn</option>
                      <option value="widowed">Góa</option>
                      <option value="other">Khác</option>
                    </select></div>

                  {section('Giấy tờ tùy thân')}
                  <div style={grid3}>
                    <div><label style={lbl}>CMND / CCCD</label>
                      <input style={inp} placeholder="012345678901" value={personal.nationalId} onChange={e => setPersonal(p => ({ ...p, nationalId: e.target.value }))} /></div>
                    <div><label style={lbl}>Ngày cấp</label>
                      <input style={inp} type="date" value={personal.issueDate} onChange={e => setPersonal(p => ({ ...p, issueDate: e.target.value }))} /></div>
                    <div><label style={lbl}>Nơi cấp</label>
                      <input style={inp} placeholder="Cục CSQLHC về TTXH" value={personal.issuePlace} onChange={e => setPersonal(p => ({ ...p, issuePlace: e.target.value }))} /></div>
                  </div>

                  {section('Liên hệ khẩn cấp')}
                  <div style={grid2}>
                    <div><label style={lbl}>Họ tên người thân</label>
                      <input style={inp} value={personal.emergencyContactName} onChange={e => setPersonal(p => ({ ...p, emergencyContactName: e.target.value }))} /></div>
                    <div><label style={lbl}>SĐT người thân</label>
                      <input style={inp} placeholder="0901 234 567" value={personal.emergencyContactPhone} onChange={e => setPersonal(p => ({ ...p, emergencyContactPhone: e.target.value }))} /></div>
                  </div>
                  <div><label style={lbl}>Ghi chú</label>
                    <textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' }} value={personal.notes}
                      onChange={e => setPersonal(p => ({ ...p, notes: e.target.value }))} /></div>

                  {section('Vai trò hệ thống')}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {STAFF_ROLES.map(r => {
                      const checked = selectedRoles.includes(r.key)
                      return (
                        <label key={r.key} style={{
                          display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                          border: `1px solid ${checked ? r.color : '#e5e7eb'}`, backgroundColor: checked ? r.bg : 'white',
                        }}>
                          <input type="checkbox" checked={checked} onChange={() => { setSelectedRoles(prev => prev.includes(r.key) ? prev.filter(x => x !== r.key) : [...prev, r.key]); setRoleMsg(null) }}
                            style={{ width: '14px', height: '14px', accentColor: r.color }} />
                          <span style={{ fontSize: '13px', fontWeight: checked ? 600 : 400, color: checked ? r.color : '#374151' }}>{r.label}</span>
                        </label>
                      )
                    })}
                  </div>
                  {msg(roleMsg)}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={handleSaveRoles} disabled={savingRoles} style={{
                      padding: '7px 14px', borderRadius: '8px', border: '1px solid #2563eb',
                      backgroundColor: savingRoles ? '#eff6ff' : 'white', color: '#2563eb',
                      fontSize: '12px', fontWeight: 600, cursor: savingRoles ? 'not-allowed' : 'pointer',
                    }}>{savingRoles ? 'Đang lưu...' : 'Lưu vai trò'}</button>
                  </div>

                  {msg(personalMsg)}
                  {saveBtn('Lưu thông tin cá nhân', savingPersonal, handleSavePersonal)}
                </>
              )}

              {/* ── TAB CHUYÊN MÔN ──────────────────────────── */}
              {tab === 'professional' && (
                <>
                  {section('Trình độ học vấn')}
                  <div style={grid2}>
                    <div><label style={lbl}>Chuyên khoa</label>
                      <input style={inp} placeholder="Nha khoa tổng quát" value={professional.specialization} onChange={e => setProfessional(p => ({ ...p, specialization: e.target.value }))} /></div>
                    <div><label style={lbl}>Bằng cấp</label>
                      <input style={inp} placeholder="Bác sĩ / Thạc sĩ / Tiến sĩ" value={professional.degree} onChange={e => setProfessional(p => ({ ...p, degree: e.target.value }))} /></div>
                  </div>
                  <div style={grid2}>
                    <div><label style={lbl}>Trình độ học vấn</label>
                      <select style={sel} value={professional.educationLevel} onChange={e => setProfessional(p => ({ ...p, educationLevel: e.target.value }))}>
                        <option value="">-- Chọn --</option>
                        <option value="Cao đẳng">Cao đẳng</option>
                        <option value="Đại học">Đại học</option>
                        <option value="Thạc sĩ">Thạc sĩ</option>
                        <option value="Tiến sĩ">Tiến sĩ</option>
                        <option value="Phó giáo sư">Phó giáo sư</option>
                        <option value="Giáo sư">Giáo sư</option>
                      </select></div>
                    <div><label style={lbl}>Số năm kinh nghiệm</label>
                      <input style={inp} type="number" min="0" placeholder="5" value={professional.yearsOfExperience} onChange={e => setProfessional(p => ({ ...p, yearsOfExperience: e.target.value }))} /></div>
                  </div>
                  <div style={grid2}>
                    <div><label style={lbl}>Trường tốt nghiệp</label>
                      <input style={inp} placeholder="ĐH Y Hà Nội" value={professional.graduatedSchool} onChange={e => setProfessional(p => ({ ...p, graduatedSchool: e.target.value }))} /></div>
                    <div><label style={lbl}>Năm tốt nghiệp</label>
                      <input style={inp} type="number" min="1970" max="2100" placeholder="2015" value={professional.graduationYear} onChange={e => setProfessional(p => ({ ...p, graduationYear: e.target.value }))} /></div>
                  </div>

                  {section('Chứng chỉ hành nghề')}
                  <div><label style={lbl}>Số chứng chỉ hành nghề</label>
                    <input style={inp} placeholder="CCHN-2023-001234" value={professional.licenseNumber} onChange={e => setProfessional(p => ({ ...p, licenseNumber: e.target.value }))} /></div>
                  <div style={grid2}>
                    <div><label style={lbl}>Ngày cấp CCHN</label>
                      <input style={inp} type="date" value={professional.licenseIssueDate} onChange={e => setProfessional(p => ({ ...p, licenseIssueDate: e.target.value }))} /></div>
                    <div><label style={lbl}>Ngày hết hạn CCHN</label>
                      <input style={inp} type="date" value={professional.licenseExpiryDate} onChange={e => setProfessional(p => ({ ...p, licenseExpiryDate: e.target.value }))} /></div>
                  </div>

                  {msg(profMsg)}
                  {saveBtn('Lưu thông tin chuyên môn', savingProf, handleSaveProfessional)}
                </>
              )}

              {/* ── TAB CÔNG VIỆC ────────────────────────────── */}
              {tab === 'employment' && (
                <>
                  {section('Thông tin công việc')}
                  <div style={grid2}>
                    <div><label style={lbl}>Trạng thái làm việc</label>
                      <select style={sel} value={employment.employmentStatus} onChange={e => setEmployment(p => ({ ...p, employmentStatus: e.target.value }))}>
                        <option value="">-- Chọn --</option>
                        <option value="working">Đang làm việc</option>
                        <option value="on_leave">Đang nghỉ phép</option>
                        <option value="resigned">Đã nghỉ việc</option>
                        <option value="inactive">Ngừng hoạt động</option>
                      </select></div>
                    <div><label style={lbl}>Loại hình công việc</label>
                      <select style={sel} value={employment.workType} onChange={e => setEmployment(p => ({ ...p, workType: e.target.value }))}>
                        <option value="">-- Chọn --</option>
                        <option value="full_time">Toàn thời gian</option>
                        <option value="part_time">Bán thời gian</option>
                        <option value="collaborator">Cộng tác viên</option>
                      </select></div>
                  </div>
                  <div><label style={lbl}>Vị trí / Chức danh</label>
                    <input style={inp} placeholder="Bác sĩ trưởng" value={employment.position} onChange={e => setEmployment(p => ({ ...p, position: e.target.value }))} /></div>
                  <div style={grid2}>
                    <div><label style={lbl}>Ngày bắt đầu</label>
                      <input style={inp} type="date" value={employment.startDate} onChange={e => setEmployment(p => ({ ...p, startDate: e.target.value }))} /></div>
                    <div><label style={lbl}>Ngày kết thúc</label>
                      <input style={inp} type="date" value={employment.endDate} onChange={e => setEmployment(p => ({ ...p, endDate: e.target.value }))} /></div>
                  </div>
                  <div><label style={lbl}>Số hợp đồng</label>
                    <input style={inp} placeholder="HD-2023-001" value={employment.contractNumber} onChange={e => setEmployment(p => ({ ...p, contractNumber: e.target.value }))} /></div>

                  {msg(empMsg)}
                  {saveBtn('Lưu thông tin công việc', savingEmp, handleSaveEmployment)}
                </>
              )}

              {/* ── TAB TÀI CHÍNH ────────────────────────────── */}
              {tab === 'salary' && (
                <>
                  {section('Lương & Hoa hồng')}
                  <div style={grid2}>
                    <div><label style={lbl}>Lương cơ bản (VNĐ)</label>
                      <input style={inp} type="number" min="0" placeholder="15000000" value={salary.baseSalary} onChange={e => setSalary(p => ({ ...p, baseSalary: e.target.value }))} /></div>
                    <div><label style={lbl}>Loại lương</label>
                      <select style={sel} value={salary.salaryType} onChange={e => setSalary(p => ({ ...p, salaryType: e.target.value }))}>
                        <option value="">-- Chọn --</option>
                        <option value="monthly">Theo tháng</option>
                        <option value="per_shift">Theo ca</option>
                        <option value="percentage">Theo phần trăm</option>
                      </select></div>
                  </div>
                  <div><label style={lbl}>Tỷ lệ hoa hồng (%)</label>
                    <input style={inp} type="number" min="0" max="100" step="0.1" placeholder="10.5" value={salary.commissionRate} onChange={e => setSalary(p => ({ ...p, commissionRate: e.target.value }))} /></div>

                  {section('Thông tin ngân hàng')}
                  <div style={grid2}>
                    <div><label style={lbl}>Tên ngân hàng</label>
                      <input style={inp} placeholder="Vietcombank" value={salary.bankName} onChange={e => setSalary(p => ({ ...p, bankName: e.target.value }))} /></div>
                    <div><label style={lbl}>Số tài khoản</label>
                      <input style={inp} placeholder="1234567890" value={salary.bankAccountNumber} onChange={e => setSalary(p => ({ ...p, bankAccountNumber: e.target.value }))} /></div>
                  </div>
                  <div><label style={lbl}>Tên chủ tài khoản</label>
                    <input style={inp} placeholder="NGUYEN VAN A" value={salary.bankAccountName} onChange={e => setSalary(p => ({ ...p, bankAccountName: e.target.value }))} /></div>

                  {section('Thuế & Bảo hiểm')}
                  <div style={grid2}>
                    <div><label style={lbl}>Mã số thuế</label>
                      <input style={inp} placeholder="8123456789" value={salary.taxCode} onChange={e => setSalary(p => ({ ...p, taxCode: e.target.value }))} /></div>
                    <div><label style={lbl}>Số bảo hiểm xã hội</label>
                      <input style={inp} placeholder="0123456789" value={salary.insuranceNumber} onChange={e => setSalary(p => ({ ...p, insuranceNumber: e.target.value }))} /></div>
                  </div>

                  {msg(salaryMsg)}
                  {saveBtn('Lưu thông tin tài chính', savingSalary, handleSaveSalary)}
                </>
              )}

              {/* ── TAB BẰNG CẤP ─────────────────────────────── */}
              {tab === 'certs' && (
                <>
                  <label style={{ ...lbl, marginBottom: 0 }}>
                    Bằng cấp &amp; Chứng chỉ
                    <span style={{ fontSize: '11px', fontWeight: 400, color: '#9ca3af', marginLeft: '6px' }}>
                      PDF · PNG · JPG · Tối đa 10MB/file
                    </span>
                  </label>
                  <div
                    onDragOver={e => { e.preventDefault(); setCertDragging(true) }}
                    onDragLeave={() => setCertDragging(false)}
                    onDrop={e => { e.preventDefault(); setCertDragging(false); const f = e.dataTransfer.files[0]; if (f) handleCertUpload(f) }}
                    onClick={() => certInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${certDragging ? '#2563eb' : '#d1d5db'}`,
                      borderRadius: '10px', padding: '18px', textAlign: 'center',
                      cursor: certUploading ? 'not-allowed' : 'pointer',
                      backgroundColor: certDragging ? '#eff6ff' : '#f9fafb', transition: 'all 0.15s',
                    }}
                  >
                    <Upload size={20} color={certDragging ? '#2563eb' : '#9ca3af'} style={{ marginBottom: '4px' }} />
                    <p style={{ fontSize: '13px', color: certDragging ? '#2563eb' : '#6b7280', fontWeight: 500 }}>
                      {certUploading ? 'Đang tải lên...' : 'Nhấn để chọn file hoặc kéo thả vào đây'}
                    </p>
                    <input ref={certInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: 'none' }}
                      disabled={certUploading}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleCertUpload(f); e.target.value = '' }} />
                  </div>
                  {msg(certMsg)}
                  {certs.length > 0
                    ? <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {certs.map(c => (
                          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '6px', flexShrink: 0, backgroundColor: c.mimetype === 'application/pdf' ? '#fef2f2' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {c.mimetype === 'application/pdf' ? <FileText size={16} color="#ef4444" /> : <Image size={16} color="#3b82f6" />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <a href={`http://localhost:5000/uploads/certificates/${userId}/${c.filename}`} target="_blank" rel="noreferrer"
                                style={{ fontSize: '12px', fontWeight: 600, color: '#111827', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                                title={c.originalName}>{c.originalName}</a>
                              <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>{formatSize(c.size)} · {new Date(c.uploadedAt).toLocaleDateString('vi-VN')}</p>
                            </div>
                            <button onClick={() => handleCertDelete(c.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px', flexShrink: 0 }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    : <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center' }}>Chưa có bằng cấp/chứng chỉ nào được tải lên.</p>
                  }
                </>
              )}

              {/* ── TAB BẢO MẬT ──────────────────────────────── */}
              {tab === 'security' && (
                <>
                  <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '14px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#1d4ed8' }}>🔑 Đặt lại mật khẩu cho nhân sự (UC06)</p>
                    <p style={{ fontSize: '12px', color: '#3b82f6', marginTop: '4px' }}>Mật khẩu mới sẽ được gửi qua email. Tất cả phiên làm việc của tài khoản này sẽ bị hủy ngay lập tức.</p>
                  </div>
                  <div>
                    <label style={lbl}>Tên đăng nhập</label>
                    <input style={{ ...inp, backgroundColor: '#f9fafb', color: '#6b7280' }} value={user.username} disabled />
                    <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>Tên đăng nhập không thể thay đổi.</p>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ ...lbl, marginBottom: 0 }}>Mật khẩu mới <span style={{ color: '#ef4444' }}>*</span></label>
                      <button onClick={() => setNewPw(generatePassword())}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#2563eb', border: 'none', background: 'none', cursor: 'pointer' }}>
                        <RefreshCw size={12} /> Tạo tự động
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input style={{ ...inp, paddingRight: '36px' }} type={showPw ? 'text' : 'password'}
                        placeholder="Nhập mật khẩu mới..." value={newPw} onChange={e => setNewPw(e.target.value)} />
                      <button onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  {msg(pwMsg)}
                  {saveBtn('Đặt lại mật khẩu', resetting, handleResetPassword)}
                </>
              )}

            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 24px 20px' }}>
              <button onClick={onClose} style={{
                padding: '9px 18px', borderRadius: '8px', border: '1px solid #e5e7eb',
                background: 'white', fontSize: '13px', cursor: 'pointer', color: '#374151',
              }}>Đóng</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
