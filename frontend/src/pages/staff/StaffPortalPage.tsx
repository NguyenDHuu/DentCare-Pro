import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth.store'
import { HeartPulse, Clock, LogOut, UserRound, Stethoscope, Calculator } from 'lucide-react'

const ROLE_CONFIG: Record<string, {
  label: string
  icon: React.ElementType
  color: string
  bg: string
  desc: string
  features: string[]
}> = {
  RECEPTIONIST: {
    label: 'Lễ tân',
    icon: UserRound,
    color: '#2563eb',
    bg: '#eff6ff',
    desc: 'Cổng thông tin dành cho bộ phận Lễ tân',
    features: [
      'Quản lý lịch hẹn bệnh nhân',
      'Tiếp nhận và tra cứu hồ sơ',
      'Xác nhận & thông báo lịch hẹn',
      'Quản lý hàng chờ khám',
    ],
  },
  DOCTOR: {
    label: 'Bác sĩ',
    icon: Stethoscope,
    color: '#0d9488',
    bg: '#f0fdfa',
    desc: 'Cổng thông tin dành cho Bác sĩ',
    features: [
      'Lịch khám trong ngày',
      'Hồ sơ & lịch sử điều trị bệnh nhân',
      'Kê đơn và ghi chú điều trị',
      'Quản lý ca làm việc',
    ],
  },
  ACCOUNTANT: {
    label: 'Kế toán',
    icon: Calculator,
    color: '#d97706',
    bg: '#fffbeb',
    desc: 'Cổng thông tin dành cho bộ phận Kế toán',
    features: [
      'Quản lý hóa đơn & thanh toán',
      'Báo cáo doanh thu theo kỳ',
      'Theo dõi công nợ',
      'Xuất báo cáo tài chính',
    ],
  },
}

export default function StaffPortalPage() {
  const navigate = useNavigate()
  const { user, activeRole, logout } = useAuthStore()

  const cfg = activeRole ? ROLE_CONFIG[activeRole] : null
  const Icon = cfg?.icon ?? UserRound

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#f9fafb',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        backgroundColor: 'white', borderBottom: '1px solid #e5e7eb',
        padding: '0 32px', height: '60px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', backgroundColor: '#1d4ed8',
            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <HeartPulse size={16} color="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>DentCare Pro</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{user?.fullName}</p>
            <p style={{ fontSize: '11px', color: '#9ca3af' }}>{cfg?.label ?? activeRole}</p>
          </div>
          <button onClick={handleLogout} title="Đăng xuất" style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 12px', border: '1px solid #e5e7eb', borderRadius: '8px',
            background: 'white', cursor: 'pointer', fontSize: '13px', color: '#6b7280',
          }}>
            <LogOut size={14} /> Đăng xuất
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px',
      }}>
        <div style={{ maxWidth: '520px', width: '100%', textAlign: 'center' }}>
          {/* Icon */}
          <div style={{
            width: '80px', height: '80px', borderRadius: '20px',
            backgroundColor: cfg?.bg ?? '#f3f4f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <Icon size={36} color={cfg?.color ?? '#6b7280'} />
          </div>

          {/* Badge */}
          <div style={{ marginBottom: '16px' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '20px',
              color: cfg?.color ?? '#6b7280', backgroundColor: cfg?.bg ?? '#f3f4f6',
            }}>
              <Clock size={12} /> Đang phát triển
            </span>
          </div>

          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', marginBottom: '12px' }}>
            Cổng {cfg?.label ?? 'Nhân sự'}
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.7, marginBottom: '32px' }}>
            {cfg?.desc}. Giao diện này đang được phát triển và sẽ sớm ra mắt.
          </p>

          {/* Feature list */}
          {cfg && (
            <div style={{
              backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb',
              padding: '24px', textAlign: 'left', marginBottom: '32px',
            }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '14px' }}>
                Tính năng sẽ có:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {cfg.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                      backgroundColor: cfg.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', color: cfg.color, fontWeight: 700,
                    }}>✓</div>
                    <span style={{ fontSize: '13px', color: '#374151' }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={handleLogout} style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', borderRadius: '8px', border: '1px solid #e5e7eb',
            background: 'white', cursor: 'pointer', fontSize: '13px',
            fontWeight: 500, color: '#374151',
          }}>
            <LogOut size={14} /> Đăng xuất
          </button>
        </div>
      </div>
    </div>
  )
}
