import {
  Users, Stethoscope, Tag, ScrollText, KeyRound, UserCog,
  ArrowRight, CheckCircle, AlertTriangle, Lock,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '../../api/auth.api'

// ─── Constants ────────────────────────────────────────────────

const quickAccess = [
  { label: 'Quản lý người dùng', desc: 'Tạo, xem, cập nhật và khóa/mở tài khoản nhân sự.',    icon: Users,       path: '/users',          tag: 'UC05/06' },
  { label: 'Dịch vụ nha khoa',   desc: 'Quản lý nhóm dịch vụ và các dịch vụ của phòng khám.', icon: Stethoscope, path: '/services',        tag: 'UC08/09' },
  { label: 'Bảng giá dịch vụ',   desc: 'Thiết lập, cập nhật bảng giá với lịch sử thay đổi.',  icon: Tag,         path: '/pricing',         tag: 'UC10'    },
  { label: 'Nhật ký hệ thống',   desc: 'Giám sát, lọc và xuất nhật ký hoạt động hệ thống.',   icon: ScrollText,  path: '/logs',            tag: 'UC07'    },
  { label: 'Hồ sơ cá nhân',      desc: 'Xem và chỉnh sửa thông tin tài khoản Admin.',          icon: UserCog,     path: '/profile',         tag: ''        },
  { label: 'Đổi mật khẩu',       desc: 'Cập nhật mật khẩu bảo mật tài khoản hiện tại.',       icon: KeyRound,    path: '/change-password', tag: 'UC03'    },
]

const ACTION_LABELS: Record<string, string> = {
  LOGIN:               'Đăng nhập',
  LOGIN_FAILED:        'Đăng nhập thất bại',
  LOGOUT:              'Đăng xuất',
  SETUP_ADMIN:         'Khởi tạo hệ thống',
  CREATE_STAFF:        'Tạo tài khoản',
  UPDATE_PROFILE:      'Cập nhật hồ sơ',
  UPDATE_ROLES:        'Cập nhật vai trò',
  LOCK_USER:           'Khóa tài khoản',
  UNLOCK_USER:         'Mở khóa tài khoản',
  DELETE_USER:         'Xóa tài khoản',
  CHANGE_PASSWORD:     'Đổi mật khẩu',
  RESET_PASSWORD:      'Đặt lại mật khẩu',
  ADMIN_RESET_PASSWORD:'Admin đặt lại mật khẩu',
  REQUEST_RESET_PASSWORD: 'Yêu cầu đặt lại mật khẩu',
  UPLOAD_CERTIFICATE:  'Tải lên chứng chỉ',
  DELETE_CERTIFICATE:  'Xóa chứng chỉ',
  SEND_EMAIL:          'Gửi email',
}

function fmtTime(d: string) {
  const date = new Date(d)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1)   return 'Vừa xong'
  if (diffMin < 60)  return `${diffMin} phút trước`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24)    return `${diffH} giờ trước`
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Component ────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate()

  const { data: statsData, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => authApi.getStats().then(r => r.data),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const byRole = statsData?.byRole ?? {}
  const roleDesc = [
    byRole.ADMIN        ? `${byRole.ADMIN} Admin`       : '',
    byRole.RECEPTIONIST ? `${byRole.RECEPTIONIST} Lễ tân` : '',
    byRole.DOCTOR       ? `${byRole.DOCTOR} Bác sĩ`    : '',
    byRole.ACCOUNTANT   ? `${byRole.ACCOUNTANT} Kế toán` : '',
  ].filter(Boolean).join(', ')

  const val = (v: number | undefined) => isLoading ? '...' : (v !== undefined ? String(v) : '0')

  const stats = [
    {
      label: 'Tổng tài khoản',
      value: val(statsData?.totalUsers),
      desc:  roleDesc || (isLoading ? '' : 'Chưa có tài khoản nào'),
      icon: Users, color: '#3b82f6', bg: '#eff6ff',
    },
    {
      label: 'Dịch vụ đang hoạt động',
      value: val(statsData?.activeServices),
      desc:  statsData?.activeServices
               ? `trong tổng số các dịch vụ`
               : (isLoading ? '' : 'Chưa có dịch vụ nào'),
      icon: Stethoscope, color: '#22c55e', bg: '#f0fdf4',
    },
    {
      label: 'Bảng giá đang hiệu lực',
      value: val(statsData?.activePrices),
      desc:  statsData?.activePrices
               ? 'mức giá đang áp dụng'
               : (isLoading ? '' : 'Chưa có bảng giá nào'),
      icon: Tag, color: '#f59e0b', bg: '#fffbeb',
    },
    {
      label: 'Nhật ký hôm nay',
      value: val(statsData?.todayLogs),
      desc:  'hoạt động trong ngày',
      icon: ScrollText, color: '#a855f7', bg: '#faf5ff',
    },
  ]

  // Xây dựng cảnh báo động
  const alerts: { bg: string; border: string; dot: string; icon: any; iconColor: string; text: string }[] = []

  if (!isLoading) {
    if ((statsData?.lockedUsers ?? 0) > 0) {
      alerts.push({
        bg: '#fef9c3', border: '#fde68a', dot: '#f59e0b',
        icon: Lock, iconColor: '#d97706',
        text: `Có ${statsData!.lockedUsers} tài khoản đang bị khóa`,
      })
    }
    if ((statsData?.activeServices ?? 0) === 0) {
      alerts.push({
        bg: '#fef3c7', border: '#fde68a', dot: '#f59e0b',
        icon: AlertTriangle, iconColor: '#d97706',
        text: 'Chưa có dịch vụ nào đang hoạt động',
      })
    }
    if ((statsData?.activePrices ?? 0) === 0) {
      alerts.push({
        bg: '#fef3c7', border: '#fde68a', dot: '#f59e0b',
        icon: AlertTriangle, iconColor: '#d97706',
        text: 'Chưa có bảng giá nào được thiết lập',
      })
    }
    if (alerts.length === 0) {
      alerts.push({
        bg: '#f0fdf4', border: '#86efac', dot: '#22c55e',
        icon: CheckCircle, iconColor: '#16a34a',
        text: 'Hệ thống hoạt động bình thường',
      })
    }
  }

  const recentLogs: any[] = statsData?.recentLogs ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        {stats.map(s => (
          <div key={s.label} style={{
            backgroundColor: 'white', borderRadius: '12px',
            border: '1px solid #f1f5f9', padding: '20px',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div>
              <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '6px' }}>{s.label}</p>
              <p style={{ fontSize: '32px', fontWeight: 700, color: '#111827', lineHeight: 1, marginBottom: '6px' }}>
                {s.value}
              </p>
              <p style={{ fontSize: '12px', color: '#9ca3af' }}>{s.desc}</p>
            </div>
            <div style={{
              width: '44px', height: '44px', borderRadius: '10px',
              backgroundColor: s.bg, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
            }}>
              <s.icon size={20} color={s.color} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Quick Access ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {quickAccess.map(q => (
          <button key={q.label} onClick={() => navigate(q.path)} style={{
            backgroundColor: 'white', borderRadius: '12px',
            border: '1px solid #f1f5f9', padding: '18px 20px',
            display: 'flex', alignItems: 'center', gap: '16px',
            cursor: 'pointer', textAlign: 'left',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#bfdbfe'
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(59,130,246,0.08)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = '#f1f5f9'
            e.currentTarget.style.boxShadow = 'none'
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
            }}>
              <q.icon size={18} color="#3b82f6" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{q.label}</span>
                {q.tag && (
                  <span style={{ fontSize: '11px', color: '#9ca3af', backgroundColor: '#f3f4f6', padding: '1px 8px', borderRadius: '20px' }}>
                    {q.tag}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.5 }}>{q.desc}</p>
            </div>
            <ArrowRight size={14} color="#d1d5db" style={{ flexShrink: 0 }} />
          </button>
        ))}
      </div>

      {/* ── Activity + Alerts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Hoạt động gần đây */}
        <div style={{
          backgroundColor: 'white', borderRadius: '12px',
          border: '1px solid #f1f5f9', padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <p style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>Hoạt động gần đây</p>
            <button onClick={() => navigate('/logs')} style={{
              fontSize: '12px', color: '#3b82f6', background: 'none',
              border: 'none', cursor: 'pointer', fontWeight: 500,
            }}>
              Xem tất cả →
            </button>
          </div>

          {isLoading ? (
            <p style={{ fontSize: '13px', color: '#9ca3af' }}>Đang tải...</p>
          ) : recentLogs.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#9ca3af' }}>Chưa có hoạt động nào.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {recentLogs.map((log: any, i: number) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  padding: '10px 0',
                  borderBottom: i < recentLogs.length - 1 ? '1px solid #f9fafb' : 'none',
                }}>
                  {/* dot */}
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%', marginTop: '5px', flexShrink: 0,
                    backgroundColor: log.status === 'SUCCESS' ? '#22c55e' : '#f87171',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>
                      {ACTION_LABELS[log.action] ?? log.action.replace(/_/g, ' ')}
                    </p>
                    <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.user?.fullName ?? 'Hệ thống'}
                      {log.detail ? ` · ${log.detail}` : ''}
                    </p>
                  </div>
                  <span style={{ fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {fmtTime(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cảnh báo & Thông báo */}
        <div style={{
          backgroundColor: 'white', borderRadius: '12px',
          border: '1px solid #f1f5f9', padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <p style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '16px' }}>
            Cảnh báo & Thông báo
          </p>

          {isLoading ? (
            <p style={{ fontSize: '13px', color: '#9ca3af' }}>Đang tải...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {alerts.map((a, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 14px', borderRadius: '8px',
                  backgroundColor: a.bg, border: `1px solid ${a.border}`,
                }}>
                  <a.icon size={15} color={a.iconColor} style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: '13px', color: '#374151' }}>{a.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
