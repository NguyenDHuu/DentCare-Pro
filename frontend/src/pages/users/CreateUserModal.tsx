import { useState } from 'react'
import { X, RefreshCw, Eye, EyeOff } from 'lucide-react'
import { authApi } from '../../api/auth.api'

const STAFF_ROLES = [
  { key: 'RECEPTIONIST', label: 'Lễ tân',  color: '#7c3aed', bg: '#f5f3ff' },
  { key: 'DOCTOR',       label: 'Bác sĩ',  color: '#16a34a', bg: '#f0fdf4' },
  { key: 'ACCOUNTANT',   label: 'Kế toán', color: '#d97706', bg: '#fffbeb' },
  { key: 'ADMIN',        label: 'Admin',   color: '#2563eb', bg: '#eff6ff' },
]

const generatePassword = () => {
  const upper   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lower   = 'abcdefghijklmnopqrstuvwxyz'
  const digits  = '0123456789'
  const special = '!@#$%&*'
  const all     = upper + lower + digits + special
  let pw = upper[Math.floor(Math.random() * upper.length)]
         + lower[Math.floor(Math.random() * lower.length)]
         + digits[Math.floor(Math.random() * digits.length)]
         + special[Math.floor(Math.random() * special.length)]
  for (let i = 4; i < 12; i++) pw += all[Math.floor(Math.random() * all.length)]
  return pw.split('').sort(() => Math.random() - 0.5).join('')
}

interface Props { onClose: () => void; onSuccess: () => void }

export default function CreateUserModal({ onClose, onSuccess }: Props) {
  const [form, setForm] = useState({ fullName: '', email: '', username: '', password: '' })
  const [roles, setRoles]     = useState<string[]>([])
  const [showPw, setShowPw]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const toggleRole = (key: string) => {
    if (key === 'ADMIN') {
      setRoles(roles.includes('ADMIN') ? [] : ['ADMIN'])
    } else {
      setRoles(prev => {
        const without = prev.filter(r => r !== 'ADMIN')
        return without.includes(key) ? without.filter(r => r !== key) : [...without, key]
      })
    }
  }

  const handleSubmit = async () => {
    if (!form.fullName || !form.email || !form.username || !form.password)
      return setError('Vui lòng điền đầy đủ thông tin.')
    if (roles.length === 0)
      return setError('Vui lòng chọn ít nhất một vai trò.')

    setError(''); setLoading(true)
    try {
      await authApi.createStaff({ ...form, roles })
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi hệ thống')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: '8px',
    border: '1px solid #e5e7eb', fontSize: '13px', color: '#111827',
    outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '16px', width: '480px',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '24px 24px 0' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>Tạo tài khoản mới</h2>
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              Hệ thống sẽ gửi thông tin đăng nhập qua email sau khi tạo.
            </p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Họ và tên */}
          <div>
            <label style={labelStyle}>Họ và tên <span style={{ color: '#ef4444' }}>*</span></label>
            <input style={inputStyle} placeholder="Nguyễn Văn A" value={form.fullName} onChange={set('fullName')} />
          </div>

          {/* Email */}
          <div>
            <label style={labelStyle}>Email <span style={{ color: '#ef4444' }}>*</span></label>
            <input style={inputStyle} type="email" placeholder="email@nhakhoa.com" value={form.email} onChange={set('email')} />
          </div>

          {/* Tên đăng nhập */}
          <div>
            <label style={labelStyle}>Tên đăng nhập <span style={{ color: '#ef4444' }}>*</span></label>
            <input style={inputStyle} placeholder="ten_dang_nhap" value={form.username} onChange={set('username')} />
          </div>

          {/* Mật khẩu */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Mật khẩu ban đầu <span style={{ color: '#ef4444' }}>*</span></label>
              <button onClick={() => setForm(f => ({ ...f, password: generatePassword() }))}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#2563eb', border: 'none', background: 'none', cursor: 'pointer' }}>
                <RefreshCw size={12} /> Tạo tự động
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <input style={{ ...inputStyle, paddingRight: '36px' }}
                type={showPw ? 'text' : 'password'} placeholder="••••••••"
                value={form.password} onChange={set('password')} />
              <button onClick={() => setShowPw(!showPw)} style={{
                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af',
              }}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Vai trò */}
          <div>
            <label style={labelStyle}>Vai trò <span style={{ color: '#ef4444' }}>*</span></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {STAFF_ROLES.map(r => {
                const checked = roles.includes(r.key)
                const disabled = r.key !== 'ADMIN' && roles.includes('ADMIN')
                return (
                  <label key={r.key} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 12px', borderRadius: '8px', cursor: disabled ? 'not-allowed' : 'pointer',
                    border: `1px solid ${checked ? r.color : '#e5e7eb'}`,
                    backgroundColor: checked ? r.bg : 'white',
                    opacity: disabled ? 0.4 : 1,
                  }}>
                    <input type="checkbox" checked={checked} disabled={disabled}
                      onChange={() => toggleRole(r.key)}
                      style={{ width: '14px', height: '14px', accentColor: r.color }} />
                    <span style={{ fontSize: '13px', fontWeight: checked ? 600 : 400, color: checked ? r.color : '#374151' }}>
                      {r.label}
                    </span>
                  </label>
                )
              })}
            </div>
            {roles.includes('ADMIN') && (
              <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                ⓘ Tài khoản Admin chỉ có duy nhất vai trò Admin.
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: '10px 12px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '13px', color: '#dc2626' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', padding: '0 24px 24px' }}>
          <button onClick={onClose} style={{
            padding: '9px 16px', borderRadius: '8px', border: '1px solid #e5e7eb',
            background: 'white', fontSize: '13px', cursor: 'pointer', color: '#374151',
          }}>Hủy</button>
          <button onClick={handleSubmit} disabled={loading} style={{
            padding: '9px 18px', borderRadius: '8px', border: 'none',
            backgroundColor: loading ? '#93c5fd' : '#2563eb', color: 'white',
            fontSize: '13px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? 'Đang tạo...' : '+ Tạo tài khoản'}
          </button>
        </div>
      </div>
    </div>
  )
}
