import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { authApi } from '../../api/auth.api'
import { useAuthStore } from '../../stores/auth.store'
import { HeartPulse, Eye, EyeOff, Loader2, ShieldCheck, UserRound, Calculator, Stethoscope } from 'lucide-react'

const ROLES = [
  { key: 'ADMIN',        label: 'Quản trị viên', icon: ShieldCheck,  activeColor: '#7c3aed', activeBg: '#ede9fe', border: '#c4b5fd' },
  { key: 'RECEPTIONIST', label: 'Lễ tân',         icon: UserRound,    activeColor: '#ffffff', activeBg: '#2563eb', border: '#2563eb' },
  { key: 'ACCOUNTANT',   label: 'Kế toán',        icon: Calculator,   activeColor: '#16a34a', activeBg: '#dcfce7', border: '#86efac' },
  { key: 'DOCTOR',       label: 'Bác sĩ',         icon: Stethoscope,  activeColor: '#0d9488', activeBg: '#ccfbf1', border: '#5eead4' },
]

function RoleSelector({ roles, onSelect }: { roles: string[]; onSelect: (r: string) => void }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #f1f5f9', padding: '32px', width: '100%', maxWidth: '360px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, textAlign: 'center', marginBottom: '8px', color: '#111827' }}>Chọn vai trò</h2>
        <p style={{ fontSize: '13px', color: '#6b7280', textAlign: 'center', marginBottom: '24px' }}>Bạn muốn đăng nhập với vai trò nào?</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {ROLES.filter(r => roles.includes(r.key)).map(r => (
            <button key={r.key} onClick={() => onSelect(r.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '14px 16px', border: '2px solid #e5e7eb',
                borderRadius: '10px', background: 'none', cursor: 'pointer',
                fontSize: '14px', fontWeight: 500, color: '#374151',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#3b82f6'; (e.currentTarget as HTMLElement).style.backgroundColor = '#eff6ff' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
            >
              <r.icon size={20} color="#3b82f6" />
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth, setActiveRole } = useAuthStore()
  const [selectedRole, setSelectedRole] = useState<string>('RECEPTIONIST')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingLogin, setPendingLogin] = useState<{ token: string; user: any } | null>(null)

  const { register, handleSubmit } = useForm<{ username: string; password: string }>()

  const navigateByRole = (role: string) => {
    if (role === 'ADMIN') navigate('/dashboard')
    else navigate('/staff-portal')
  }

  const onSubmit = async (data: any) => {
    setLoading(true)
    setError('')
    try {
      const res = await authApi.login(data)
      const { token, user } = res.data

      if (user.roles.length === 1) {
        setAuth(token, user)
        setActiveRole(user.roles[0])
        navigateByRole(user.roles[0])
      } else if (user.roles.includes(selectedRole)) {
        // Đã chọn vai trò trước khi đăng nhập và tài khoản có vai trò đó
        setAuth(token, user)
        setActiveRole(selectedRole)
        navigateByRole(selectedRole)
      } else {
        // Có nhiều vai trò, chưa khớp với lựa chọn → hiện màn hình chọn lại
        setPendingLogin({ token, user })
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi hệ thống')
    } finally {
      setLoading(false)
    }
  }

  const handleRoleSelect = (role: string) => {
    if (!pendingLogin) return
    setAuth(pendingLogin.token, pendingLogin.user)
    setActiveRole(role)
    navigateByRole(role)
  }

  if (pendingLogin) return <RoleSelector roles={pendingLogin.user.roles} onSelect={handleRoleSelect} />

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>

      {/* Left panel */}
<div style={{
  width: '46%', background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 60%, #1e3a8a 100%)',
  color: 'white', display: 'flex', flexDirection: 'column',
  justifyContent: 'space-between', padding: '40px 48px'
}}>
  {/* Logo */}
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
    <div style={{ width: '40px', height: '40px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <HeartPulse size={20} />
    </div>
    <div>
      <p style={{ fontWeight: 700, fontSize: '15px' }}>DentCare Pro</p>
      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Hệ thống Quản lý Phòng khám</p>
    </div>
  </div>

  {/* Content */}
  <div>
    <h2 style={{ fontSize: '36px', fontWeight: 800, lineHeight: 1.25, marginBottom: '16px' }}>
      Quản lý phòng khám<br />thông minh & hiệu quả
    </h2>
    <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, marginBottom: '32px' }}>
      DentCare Pro cung cấp giải pháp quản lý toàn diện — từ đặt lịch hẹn, hồ sơ bệnh nhân, ca làm việc bác sĩ đến báo cáo doanh thu và thống kê chuyên sâu.
    </p>

    {/* Features */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {[
        { icon: '📅', title: 'Quản lý lịch hẹn',     desc: 'Đặt lịch, xác nhận và theo dõi trạng thái lịch hẹn theo thời gian thực' },
        { icon: '🦷', title: 'Hồ sơ bệnh nhân',       desc: 'Lưu trữ và tra cứu hồ sơ, lịch sử khám và điều trị đầy đủ' },
        { icon: '👨‍⚕️', title: 'Quản lý nhân sự',    desc: 'Phân công bác sĩ, ca làm việc và theo dõi hiệu suất làm việc' },
        { icon: '📊', title: 'Báo cáo & Thống kê',    desc: 'Doanh thu, tỉ lệ đúng hẹn và các chỉ số vận hành phòng khám' },
      ].map(f => (
        <div key={f.title} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div style={{
            width: '36px', height: '36px', backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: '8px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '18px', flexShrink: 0
          }}>
            {f.icon}
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 700, marginBottom: '2px' }}>{f.title}</p>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{f.desc}</p>
          </div>
        </div>
      ))}
    </div>
  </div>

  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>© 2026 DentCare Pro. Phiên bản 1.0</p>
</div>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', backgroundColor: '#ffffff' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#111827' }}>Đăng nhập hệ thống</h2>
            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '6px' }}>Chọn vai trò và nhập thông tin đăng nhập</p>
          </div>

          {/* Role selector — bấm được */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
            {ROLES.map(r => {
              const isSelected = selectedRole === r.key
              return (
                <button key={r.key} onClick={() => setSelectedRole(r.key)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: '8px', padding: '14px 12px', borderRadius: '12px', cursor: 'pointer',
                    border: `2px solid ${isSelected ? r.border : '#e5e7eb'}`,
                    backgroundColor: isSelected ? r.activeBg : '#fafafa',
                    transition: 'all 0.15s',
                  }}>
                  <r.icon size={22} color={isSelected ? r.activeColor : '#9ca3af'} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? r.activeColor : '#6b7280' }}>
                    {r.label}
                  </span>
                </button>
              )
            })}
          </div>

          {error && (
            <div style={{
              backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px',
              padding: '10px 14px', marginBottom: '16px', color: '#dc2626', fontSize: '13px'
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  Tên đăng nhập
                </label>
                <input {...register('username')} placeholder="Nhập tên đăng nhập"
                  style={{
                    width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb',
                    borderRadius: '8px', fontSize: '14px', outline: 'none',
                    boxSizing: 'border-box', color: '#111827'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  Mật khẩu
                </label>
                <div style={{ position: 'relative' }}>
                  <input {...register('password')} type={showPw ? 'text' : 'password'} placeholder="••••••••"
                    style={{
                      width: '100%', padding: '10px 40px 10px 14px', border: '1px solid #e5e7eb',
                      borderRadius: '8px', fontSize: '14px', outline: 'none',
                      boxSizing: 'border-box', color: '#111827'
                    }}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    {showPw ? <EyeOff size={16} color="#9ca3af" /> : <Eye size={16} color="#9ca3af" />}
                  </button>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <a href="/forgot-password" style={{ fontSize: '13px', color: '#3b82f6', textDecoration: 'none' }}>
                  Quên mật khẩu?
                </a>
              </div>

              <button type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '11px', backgroundColor: loading ? '#93c5fd' : '#2563eb',
                  color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px',
                  fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}>
                {loading && <Loader2 size={16} />}
                Đăng nhập
              </button>

              <p style={{ textAlign: 'center', fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                Chưa có tài khoản Admin?{' '}
                <a href="/register" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
                  Đăng ký ngay
                </a>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}