import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  HeartPulse,
  LayoutDashboard,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  MessageSquare,
  Users,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  UserCog,
  KeyRound,
  LogOut,
  Clock,
  FileText,
  BarChart3,
  BarChart2,
  TrendingUp,
  ClipboardList,
  RefreshCw,
} from 'lucide-react'
import { useAuthStore } from '../stores/auth.store'

// ─── Menu definitions per role ────────────────────────────────

const RECEPTIONIST_MENU = [
  {
    section: 'TỔNG QUAN',
    items: [
      { label: 'Bảng điều khiển', icon: LayoutDashboard, path: '/staff/dashboard' },
    ],
  },
  {
    section: 'TIẾP ĐÓN',
    items: [
      { label: 'Hàng chờ hôm nay', icon: ClipboardList, path: '/staff/reception' },
    ],
  },
  {
    section: 'BỆNH NHÂN',
    items: [
      { label: 'Danh sách bệnh nhân', icon: Users,        path: '/staff/patients' },
      { label: 'Đăng ký bệnh nhân',  icon: CalendarPlus, path: '/staff/patients/new' },
    ],
  },
  {
    section: 'QUẢN LÝ LỊCH HẸN',
    items: [
      { label: 'Danh sách lịch hẹn', icon: CalendarDays, path: '/staff/appointments' },
      { label: 'Đặt lịch hẹn mới',   icon: CalendarPlus, path: '/staff/appointments/new' },
    ],
  },
  {
    section: 'LỊCH TRỰC',
    items: [
      { label: 'Lịch trực bác sĩ', icon: CalendarRange, path: '/staff/doctor-schedule' },
    ],
  },
  {
    section: 'CÀI ĐẶT',
    items: [
      { label: 'Thông báo SMS', icon: MessageSquare, path: '/staff/sms' },
    ],
  },
]

const DOCTOR_MENU = [
  {
    section: 'TỔNG QUAN',
    items: [
      { label: 'Bảng điều khiển', icon: LayoutDashboard, path: '/staff/dashboard' },
    ],
  },
  {
    section: 'KHÁM BỆNH',
    items: [
      { label: 'Khám & Điều trị', icon: HeartPulse,    path: '/staff/treatment' },
    ],
  },
  {
    section: 'LỊCH KHÁM',
    items: [
      { label: 'Lịch khám hôm nay',   icon: CalendarDays,  path: '/staff/today-schedule' },
      { label: 'Hồ sơ bệnh nhân',     icon: ClipboardList, path: '/staff/patients' },
    ],
  },
  {
    section: 'CA LÀM VIỆC',
    items: [
      { label: 'Lịch trực của tôi', icon: Clock, path: '/staff/my-schedule' },
    ],
  },
  {
    section: 'LƯƠNG',
    items: [
      { label: 'Hệ số ca phức tạp', icon: RefreshCw, path: '/staff/salary/uc4.3' },
    ],
  },
]

const ACCOUNTANT_MENU = [
  {
    section: '',
    items: [
      { label: 'Lịch hẹn',  icon: CalendarDays, path: '/staff/appointments' },
      { label: 'Bệnh nhân', icon: Users,         path: '/staff/patients' },
      { label: 'Hóa đơn',   icon: FileText,      path: '/staff/invoices' },
      { label: 'Thống kê',  icon: BarChart3,     path: '/staff/stats' },
    ],
  },
  {
    section: 'LƯƠNG',
    items: [
      { label: 'Lập phiếu lương',      icon: FileText,   path: '/staff/salary/uc4.4' },
      { label: 'Báo cáo lương tháng',  icon: BarChart2,  path: '/staff/salary/uc4.5' },
      { label: 'Lương năm (1 nhân sự)', icon: TrendingUp, path: '/staff/salary/uc4.6' },
      { label: 'Lương năm (toàn bộ)',   icon: BarChart3,  path: '/staff/salary/uc4.7' },
    ],
  },
]

const ROLE_LABEL: Record<string, string> = {
  RECEPTIONIST: 'Lễ tân',
  DOCTOR:       'Bác sĩ',
  ACCOUNTANT:   'Kế toán',
}

const getMenu = (role: string | null) => {
  if (role === 'RECEPTIONIST') return RECEPTIONIST_MENU
  if (role === 'DOCTOR')       return DOCTOR_MENU
  if (role === 'ACCOUNTANT')   return ACCOUNTANT_MENU
  return RECEPTIONIST_MENU
}

// ─── Component ────────────────────────────────────────────────

interface Props { collapsed: boolean; onToggle: () => void }

export default function StaffSidebar({ collapsed, onToggle }: Props) {
  const navigate = useNavigate()
  const { user, activeRole, logout } = useAuthStore()
  const [openMenus,   setOpenMenus]   = useState<string[]>([])
  const [showUserMenu, setShowUserMenu] = useState(false)

  const menu = getMenu(activeRole)

  const toggleMenu = (label: string) =>
    setOpenMenus(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    )

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'column',
      backgroundColor: '#1e3a8a', color: 'white',
      width: collapsed ? '64px' : '260px',
      minWidth: collapsed ? '64px' : '260px',
      height: '100vh', transition: 'width 0.3s ease', overflow: 'hidden',
    }}>

      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{
          width: '38px', height: '38px', backgroundColor: 'rgba(255,255,255,0.15)',
          borderRadius: '10px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0,
        }}>
          <HeartPulse size={18} />
        </div>
        {!collapsed && (
          <div>
            <p style={{ fontWeight: 700, fontSize: '14px', lineHeight: 1.3 }}>DentCare Pro</p>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '1px' }}>
              Phòng khám Nha khoa
            </p>
          </div>
        )}
      </div>

      {/* Role badge */}
      {!collapsed && activeRole && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
            backgroundColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.80)',
            letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>
            {ROLE_LABEL[activeRole] ?? activeRole}
          </span>
        </div>
      )}

      {/* Toggle button */}
      <button onClick={onToggle} style={{
        position: 'absolute', right: '-12px', top: '76px',
        width: '24px', height: '24px', backgroundColor: 'white',
        border: '1px solid #e5e7eb', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', zIndex: 10,
      }}>
        {collapsed
          ? <ChevronRight size={12} color="#6b7280" />
          : <ChevronLeft  size={12} color="#6b7280" />
        }
      </button>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
        {menu.map(group => (
          <div key={group.section}>
            {!collapsed && (
              <p style={{
                fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em',
                color: 'rgba(255,255,255,0.35)', padding: '8px 10px 6px',
                textTransform: 'uppercase',
              }}>
                {group.section}
              </p>
            )}

            {group.items.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px', borderRadius: '8px', fontSize: '13px',
                  textDecoration: 'none', marginBottom: '2px',
                  color:           isActive ? 'white'                        : 'rgba(255,255,255,0.70)',
                  backgroundColor: isActive ? 'rgba(255,255,255,0.15)'       : 'transparent',
                  fontWeight:      isActive ? 600                             : 400,
                })}
              >
                <item.icon size={17} style={{ flexShrink: 0 }} />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User section */}
      {!collapsed && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 10px' }}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px', borderRadius: '8px', border: 'none',
              background: 'none', cursor: 'pointer', marginBottom: '4px', color: 'white',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              backgroundColor: '#60a5fa', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontWeight: 700, fontSize: '14px', flexShrink: 0,
            }}>
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
              <p style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.fullName}
              </p>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '1px' }}>
                {activeRole ? ROLE_LABEL[activeRole] ?? activeRole : ''}
              </p>
            </div>
            <ChevronDown size={13} color="rgba(255,255,255,0.45)" style={{
              transform: showUserMenu ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s', flexShrink: 0,
            }} />
          </button>

          {showUserMenu && (
            <div style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: '8px', padding: '4px', marginBottom: '4px',
            }}>
              {[
                { icon: UserCog,  label: 'Hồ sơ cá nhân', path: '/staff/profile' },
                { icon: KeyRound, label: 'Đổi mật khẩu',  path: '/staff/change-password' },
              ].map(item => (
                <button key={item.label}
                  onClick={() => { navigate(item.path); setShowUserMenu(false) }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '9px 10px', borderRadius: '6px', border: 'none',
                    background: 'none', cursor: 'pointer',
                    color: 'rgba(255,255,255,0.75)', fontSize: '13px',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <item.icon size={15} />
                  {item.label}
                </button>
              ))}

              <button
                onClick={handleLogout}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 10px', borderRadius: '6px', border: 'none',
                  background: 'none', cursor: 'pointer', color: '#f87171', fontSize: '13px',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <LogOut size={15} />
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      )}

      {/* Collapsed user avatar */}
      {collapsed && (
        <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            backgroundColor: '#60a5fa', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontWeight: 700, fontSize: '14px', cursor: 'pointer',
          }}>
            {user?.fullName?.charAt(0) || 'U'}
          </div>
        </div>
      )}
    </div>
  )
}
