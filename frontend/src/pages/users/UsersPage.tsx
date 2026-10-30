import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Users, UserPlus, Search, UserCog, Mail, Lock, Unlock, ChevronDown } from 'lucide-react'
import { authApi } from '../../api/auth.api'
import CreateUserModal from './CreateUserModal'
import UserDetailModal from './UserDetailModal'
import LockDialog from './LockDialog'
import SendEmailModal from './SendEmailModal'

const ROLE_TABS = [
  { key: 'ALL',          label: 'Tất cả' },
  { key: 'RECEPTIONIST', label: 'Lễ tân' },
  { key: 'DOCTOR',       label: 'Bác sĩ' },
  { key: 'ACCOUNTANT',   label: 'Kế toán' },
  { key: 'ADMIN',        label: 'Admin' },
]

// URL param → role key
const PARAM_TO_ROLE: Record<string, string> = {
  receptionist: 'RECEPTIONIST',
  doctor:       'DOCTOR',
  accountant:   'ACCOUNTANT',
  admin:        'ADMIN',
}

const ROLE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  ADMIN:        { label: 'Admin',   color: '#2563eb', bg: '#eff6ff' },
  DOCTOR:       { label: 'Bác sĩ', color: '#16a34a', bg: '#f0fdf4' },
  RECEPTIONIST: { label: 'Lễ tân', color: '#7c3aed', bg: '#f5f3ff' },
  ACCOUNTANT:   { label: 'Kế toán',color: '#d97706', bg: '#fffbeb' },
}

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_BADGE[role] ?? { label: role, color: '#6b7280', bg: '#f3f4f6' }
  return (
    <span style={{
      fontSize: '12px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px',
      color: cfg.color, backgroundColor: cfg.bg, whiteSpace: 'nowrap',
    }}>{cfg.label}</span>
  )
}

function Avatar({ name }: { name: string }) {
  const colors = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div style={{
      width: '36px', height: '36px', borderRadius: '50%', backgroundColor: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: 700, fontSize: '14px', flexShrink: 0,
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

export default function UsersPage() {
  const { role: roleParam } = useParams<{ role?: string }>()
  const roleFilter = roleParam ? PARAM_TO_ROLE[roleParam] ?? null : null
  const isRolePage = roleFilter !== null

  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('ALL')
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('ALL')

  const [showCreate, setShowCreate]   = useState(false)
  const [detailId, setDetailId]       = useState<number | null>(null)
  const [lockTarget, setLockTarget]   = useState<any>(null)
  const [emailTarget, setEmailTarget] = useState<any>(null)

  const { data: users = [], isLoading, isError } = useQuery({
    queryKey: ['users'],
    queryFn: () => authApi.getUsers().then(r => r.data),
  })

  const effectiveRole = isRolePage ? roleFilter : (activeTab !== 'ALL' ? activeTab : null)

  const filtered = useMemo(() => {
    return users.filter((u: any) => {
      const roles: string[] = u.roles?.map((r: any) => r.role.name) ?? []
      if (effectiveRole && !roles.includes(effectiveRole)) return false
      if (statusFilter === 'ACTIVE' && !u.isActive) return false
      if (statusFilter === 'LOCKED' &&  u.isActive) return false
      const q = search.toLowerCase()
      if (q && !u.fullName.toLowerCase().includes(q) &&
               !u.username.toLowerCase().includes(q) &&
               !u.email.toLowerCase().includes(q)) return false
      return true
    })
  }, [users, effectiveRole, search, statusFilter])

  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] })

  const iconBtn = (onClick: () => void, Icon: any, title: string, color = '#6b7280') => (
    <button title={title} onClick={onClick} style={{
      width: '32px', height: '32px', display: 'flex', alignItems: 'center',
      justifyContent: 'center', borderRadius: '6px', border: '1px solid #e5e7eb',
      backgroundColor: 'white', cursor: 'pointer', color,
    }}
    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f9fafb')}
    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'white')}>
      <Icon size={15} />
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div />
        <button onClick={() => setShowCreate(true)} style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 18px', backgroundColor: '#2563eb', color: 'white',
          border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
        }}>
          <UserPlus size={15} /> Tạo tài khoản mới
        </button>
      </div>

      {/* Card */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

        {/* Tabs (chỉ hiện ở trang /users tổng) */}
        {!isRolePage && (
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #f1f5f9', padding: '0 20px' }}>
            {ROLE_TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                padding: '14px 16px', fontSize: '13px',
                fontWeight: activeTab === tab.key ? 600 : 400,
                color: activeTab === tab.key ? '#2563eb' : '#6b7280',
                border: 'none', borderBottom: activeTab === tab.key ? '2px solid #2563eb' : '2px solid transparent',
                background: 'none', cursor: 'pointer', marginBottom: '-1px',
              }}>
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Toolbar: status filter + search */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: '10px', padding: '14px 20px',
          borderBottom: isRolePage ? '1px solid #f1f5f9' : 'none',
        }}>
          {/* Status dropdown */}
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <select
              value={statusFilter}
              onChange={e => setStatus(e.target.value)}
              style={{
                appearance: 'none', padding: '8px 36px 8px 14px',
                borderRadius: '8px', border: '1px solid #e5e7eb',
                fontSize: '13px', color: '#374151', backgroundColor: 'white',
                cursor: 'pointer', outline: 'none', fontWeight: 500,
              }}
            >
              <option value="ALL">Mọi trạng thái</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="LOCKED">Bị khóa</option>
            </select>
            <ChevronDown size={14} color="#9ca3af" style={{ position: 'absolute', right: '10px', pointerEvents: 'none' }} />
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{
              position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af',
            }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm theo tên, email, tài khoản..."
              style={{
                paddingLeft: '32px', paddingRight: '12px', height: '36px', width: '240px',
                borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px',
                outline: 'none', color: '#374151',
              }}
            />
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
            <Users size={32} style={{ marginBottom: '8px', opacity: 0.3 }} />
            <p>Đang tải...</p>
          </div>
        ) : isError ? (
          <div style={{ padding: '48px', textAlign: 'center', fontSize: '13px' }}>
            <p style={{ color: '#dc2626', fontWeight: 600 }}>Không thể tải danh sách tài khoản.</p>
            <p style={{ color: '#9ca3af', marginTop: '4px' }}>Vui lòng kiểm tra kết nối và thử lại.</p>
            <button onClick={() => window.location.reload()} style={{
              marginTop: '12px', padding: '7px 16px', borderRadius: '8px',
              border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer',
              fontSize: '13px', color: '#374151',
            }}>Tải lại</button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                {['Người dùng', 'Tên đăng nhập', 'Vai trò', 'Ngày tạo', 'Trạng thái', 'Thao tác'].map(h => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: 'left', fontSize: '12px',
                    fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u: any) => {
                const roles: string[] = u.roles?.map((r: any) => r.role.name) ?? []
                return (
                  <tr key={u.id}
                    style={{ borderTop: '1px solid #f1f5f9', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#fafafa')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'white')}>

                    {/* Người dùng */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Avatar name={u.fullName} />
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{u.fullName}</p>
                          <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{u.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Tên đăng nhập */}
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#374151' }}>{u.username}</td>

                    {/* Vai trò */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {roles.map(r => <RoleBadge key={r} role={r} />)}
                      </div>
                    </td>

                    {/* Ngày tạo */}
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                    </td>

                    {/* Trạng thái */}
                    <td style={{ padding: '14px 16px' }}>
                      {u.isActive ? (
                        <span style={{
                          display: 'inline-block', fontSize: '12px', fontWeight: 600,
                          color: '#16a34a', backgroundColor: '#dcfce7',
                          padding: '4px 12px', borderRadius: '20px',
                        }}>
                          Hoạt động
                        </span>
                      ) : (
                        <div>
                          <span style={{
                            display: 'inline-block', fontSize: '12px', fontWeight: 600,
                            color: '#d97706', backgroundColor: '#fef9c3',
                            padding: '4px 12px', borderRadius: '20px',
                          }}>
                            Bị khóa
                          </span>
                          {u.lockReason && (
                            <p style={{
                              fontSize: '11px', color: '#9ca3af', marginTop: '3px',
                              maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {u.lockReason}
                            </p>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Thao tác */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {iconBtn(() => setDetailId(u.id), UserCog, 'Xem / Chỉnh sửa')}
                        {iconBtn(() => setEmailTarget(u), Mail, 'Gửi email')}
                        {u.isActive
                          ? iconBtn(() => setLockTarget(u), Lock,   'Khóa tài khoản', '#ef4444')
                          : iconBtn(() => setLockTarget(u), Unlock, 'Mở khóa',        '#16a34a')}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                    Không tìm thấy tài khoản nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Footer */}
        {!isLoading && filtered.length > 0 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9' }}>
            <p style={{ fontSize: '12px', color: '#6b7280' }}>
              Hiển thị <strong>{filtered.length}</strong> / {users.length} tài khoản
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); refresh() }}
        />
      )}
      {detailId !== null && (
        <UserDetailModal
          userId={detailId}
          onClose={() => setDetailId(null)}
          onSuccess={() => { setDetailId(null); refresh() }}
        />
      )}
      {lockTarget && (
        <LockDialog
          user={lockTarget}
          onClose={() => setLockTarget(null)}
          onSuccess={() => { setLockTarget(null); refresh() }}
        />
      )}
      {emailTarget && (
        <SendEmailModal user={emailTarget} onClose={() => setEmailTarget(null)} />
      )}
    </div>
  )
}
