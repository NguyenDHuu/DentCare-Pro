import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  HeartPulse, LayoutDashboard, Users, Stethoscope, Tag, ScrollText,
  ChevronRight, ChevronLeft, ChevronDown, UserCog, KeyRound, LogOut, Clock, CalendarDays, CalendarOff, MessageSquare,
  BarChart3, Receipt, Settings, Grid2x2, RefreshCw, BarChart2, TrendingUp, FileText,
} from 'lucide-react'
import { useAuthStore } from '../stores/auth.store'

const menuItems = [
  {
    section: 'MENU CHÍNH',
    items: [
      { label: 'Tổng quan', icon: LayoutDashboard, path: '/dashboard' },
      {
        label: 'Quản lý người dùng', icon: Users, path: '/users',
        children: [
          { label: 'Tất cả người dùng', path: '/users' },
          { label: 'Lễ tân',            path: '/users/receptionist' },
          { label: 'Bác sĩ',            path: '/users/doctor' },
          { label: 'Kế toán',           path: '/users/accountant' },
        ]
      },
      {
        label: 'Dịch vụ nha khoa', icon: Stethoscope, path: '/services',
        children: [
          { label: 'Nhóm dịch vụ',  path: '/services/groups' },
          { label: 'Các dịch vụ',   path: '/services' },
        ]
      },
      { label: 'Bảng giá dịch vụ', icon: Tag,        path: '/pricing' },
      { label: 'Nhật ký hệ thống', icon: ScrollText, path: '/logs' },
    ]
  },
  {
    section: 'CẤU HÌNH LỊCH LÀM VIỆC',
    items: [
      { label: 'Ca làm việc',          icon: Clock,        path: '/shifts' },
      { label: 'Phân công lịch trực', icon: CalendarDays, path: '/schedules' },
      { label: 'Ngày nghỉ lễ',        icon: CalendarOff,  path: '/holidays' },
    ]
  },
  {
    section: 'BÁO CÁO',
    items: [
      { label: 'Thống kê doanh thu', icon: BarChart3, path: '/stats' },
    ]
  },
  {
    section: 'QUẢN LÝ LƯƠNG',
    items: [
      { label: 'Mức tiền cơ bản',    icon: Settings,   path: '/salary/uc4.1' },
      { label: 'Hệ số ca làm việc',  icon: Grid2x2,    path: '/salary/uc4.2' },
      { label: 'Hệ số ca phức tạp',  icon: RefreshCw,  path: '/salary/uc4.3' },
      { label: 'Lập phiếu lương',    icon: FileText,   path: '/salary/uc4.4' },
      { label: 'Báo cáo lương tháng',icon: BarChart2,  path: '/salary/uc4.5' },
      { label: 'Lương năm (1 nhân)', icon: TrendingUp, path: '/salary/uc4.6' },
      { label: 'Lương năm (toàn bộ)',icon: BarChart3,  path: '/salary/uc4.7' },
    ]
  },
  {
    section: 'CÀI ĐẶT',
    items: [
      { label: 'Thông báo SMS', icon: MessageSquare, path: '/sms' },
    ]
  }
]

interface Props { collapsed: boolean; onToggle: () => void }

export default function Sidebar({ collapsed, onToggle }: Props) {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [openMenus, setOpenMenus] = useState<string[]>([])
  const [showUserMenu, setShowUserMenu] = useState(false)

  const toggleMenu = (label: string) => {
    setOpenMenus(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    )
  }

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
        padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}>
        <div style={{
          width: '38px', height: '38px', backgroundColor: 'rgba(255,255,255,0.15)',
          borderRadius: '10px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0
        }}>
          <HeartPulse size={18} />
        </div>
        {!collapsed && (
          <div>
            <p style={{ fontWeight: 700, fontSize: '14px', lineHeight: 1.3 }}>DentCare Pro</p>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '1px' }}>Phòng khám Nha khoa</p>
          </div>
        )}
      </div>

      {/* Toggle */}
      <button onClick={onToggle} style={{
        position: 'absolute', right: '-12px', top: '76px',
        width: '24px', height: '24px', backgroundColor: 'white',
        border: '1px solid #e5e7eb', borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', zIndex: 10
      }}>
        {collapsed ? <ChevronRight size={12} color="#6b7280" /> : <ChevronLeft size={12} color="#6b7280" />}
      </button>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
        {menuItems.map(group => (
          <div key={group.section}>
            {!collapsed && (
              <p style={{
                fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em',
                color: 'rgba(255,255,255,0.35)', padding: '8px 10px 6px',
                textTransform: 'uppercase'
              }}>
                {group.section}
              </p>
            )}
            {group.items.map(item => (
              <div key={item.label} style={{ marginBottom: '2px' }}>
                {(item as any).children ? (
                  <>
                    <button
                      onClick={() => toggleMenu(item.label)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center',
                        gap: '10px', padding: '10px', borderRadius: '8px',
                        border: 'none', background: 'none', cursor: 'pointer',
                        color: 'rgba(255,255,255,0.70)', fontSize: '13px',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <item.icon size={17} style={{ flexShrink: 0 }} />
                      {!collapsed && (
                        <>
                          <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                          <ChevronDown size={13} style={{
                            transform: openMenus.includes(item.label) ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s'
                          }} />
                        </>
                      )}
                    </button>
                    {!collapsed && openMenus.includes(item.label) && (
                      <div style={{ marginLeft: '36px', marginTop: '2px', marginBottom: '4px' }}>
                        {(item as any).children.map((child: any) => (
                          <NavLink key={child.path} to={child.path} end style={({ isActive }) => ({
                            display: 'block', padding: '7px 10px', borderRadius: '6px',
                            fontSize: '12px', textDecoration: 'none', marginBottom: '1px',
                            color: isActive ? 'white' : 'rgba(255,255,255,0.55)',
                            backgroundColor: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                            fontWeight: isActive ? 600 : 400,
                          })}>
                            {child.label}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <NavLink to={item.path} style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px', borderRadius: '8px', fontSize: '13px',
                    textDecoration: 'none', marginBottom: '2px',
                    color: isActive ? 'white' : 'rgba(255,255,255,0.70)',
                    backgroundColor: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                    fontWeight: isActive ? 600 : 400,
                  })}>
                    <item.icon size={17} style={{ flexShrink: 0 }} />
                    {!collapsed && <span>{item.label}</span>}
                  </NavLink>
                )}
              </div>
            ))}
          </div>
        ))}
      </nav>

      {/* User section */}
      {!collapsed && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 10px' }}>
          {/* User info */}
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px', borderRadius: '8px', border: 'none',
              background: 'none', cursor: 'pointer', marginBottom: '4px',
              color: 'white',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              backgroundColor: '#60a5fa', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontWeight: 700, fontSize: '14px', flexShrink: 0
            }}>
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
              <p style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.fullName}
              </p>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '1px' }}>
                {user?.email}
              </p>
            </div>
            <ChevronDown size={13} color="rgba(255,255,255,0.45)" style={{
              transform: showUserMenu ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s', flexShrink: 0
            }} />
          </button>

          {/* Dropdown menu */}
          {showUserMenu && (
            <div style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderRadius: '8px', padding: '4px', marginBottom: '4px'
            }}>
              {[
                { icon: UserCog, label: 'Hồ sơ cá nhân',  path: '/profile',          color: 'rgba(255,255,255,0.75)' },
                { icon: KeyRound, label: 'Đổi mật khẩu',  path: '/change-password',  color: 'rgba(255,255,255,0.75)' },
              ].map(item => (
                <button key={item.label}
                  onClick={() => { navigate(item.path); setShowUserMenu(false) }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '9px 10px', borderRadius: '6px', border: 'none',
                    background: 'none', cursor: 'pointer', color: item.color,
                    fontSize: '13px',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <item.icon size={15} />
                  {item.label}
                </button>
              ))}

              {/* Logout */}
              <button
                onClick={handleLogout}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 10px', borderRadius: '6px', border: 'none',
                  background: 'none', cursor: 'pointer', color: '#f87171',
                  fontSize: '13px',
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

      {/* Collapsed user */}
      {collapsed && (
        <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            backgroundColor: '#60a5fa', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontWeight: 700, fontSize: '14px', cursor: 'pointer'
          }}>
            {user?.fullName?.charAt(0) || 'U'}
          </div>
        </div>
      )}
    </div>
  )
}