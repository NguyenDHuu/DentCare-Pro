import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { authApi } from '../../api/auth.api'
import { useAuthStore } from '../../stores/auth.store'
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'

const schema = z.object({
  currentPassword: z.string().min(1, 'Nhập mật khẩu hiện tại'),
  newPassword: z.string()
    .min(8, 'Tối thiểu 8 ký tự')
    .regex(/[A-Z]/, 'Cần ít nhất 1 chữ HOA')
    .regex(/[a-z]/, 'Cần ít nhất 1 chữ thường')
    .regex(/[0-9]/, 'Cần ít nhất 1 chữ số')
    .regex(/[^A-Za-z0-9]/, 'Cần ít nhất 1 ký tự đặc biệt'),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword'],
})

type FormData = z.infer<typeof schema>

const policies = [
  { label: '≥ 8 ký tự',                 regex: /.{8,}/ },
  { label: 'Ít nhất 1 chữ HOA (A–Z)',    regex: /[A-Z]/ },
  { label: 'Ít nhất 1 chữ thường (a–z)', regex: /[a-z]/ },
  { label: 'Ít nhất 1 chữ số (0–9)',     regex: /[0-9]/ },
  { label: 'Ít nhất 1 ký tự đặc biệt',  regex: /[^A-Za-z0-9]/ },
]

const fields = [
  { name: 'currentPassword', label: 'Mật khẩu hiện tại',     key: 'cur' as const },
  { name: 'newPassword',     label: 'Mật khẩu mới',          key: 'new' as const },
  { name: 'confirmPassword', label: 'Xác nhận mật khẩu mới', key: 'con' as const },
]

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const logout = useAuthStore(s => s.logout)
  const [show, setShow] = useState({ cur: false, new: false, con: false })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors }, watch } = useForm<FormData>({
    resolver: zodResolver(schema)
  })

  const watchedNew = watch('newPassword', '')

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError('')
    try {
      await authApi.changePassword(data)
      setSuccess(true)
      setTimeout(() => { logout(); navigate('/login') }, 2000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi hệ thống')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', maxWidth: '900px' }}>

      {/* Left — Policy */}
      <div style={{
        backgroundColor: 'white', borderRadius: '12px',
        border: '1px solid #f1f5f9', padding: '24px', height: 'fit-content'
      }}>
        <p style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '16px' }}>
          Chính sách mật khẩu
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {policies.map(p => {
            const passed = p.regex.test(watchedNew)
            return (
              <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={16} color={passed ? '#22c55e' : '#d1d5db'} fill={passed ? '#dcfce7' : 'none'} />
                <span style={{ fontSize: '13px', color: passed ? '#16a34a' : '#6b7280' }}>{p.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right — Form */}
      <div style={{
        backgroundColor: 'white', borderRadius: '12px',
        border: '1px solid #f1f5f9', padding: '28px'
      }}>
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>Đổi mật khẩu của bạn</p>
          <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
            Sau khi đổi thành công, hệ thống bắt buộc đăng xuất và đăng nhập lại bằng mật khẩu mới (UC03).
          </p>
        </div>

        {success && (
          <div style={{
            backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px',
            padding: '12px 16px', marginBottom: '16px', color: '#16a34a', fontSize: '13px', textAlign: 'center'
          }}>
            ✅ Đổi mật khẩu thành công! Đang chuyển về trang đăng nhập...
          </div>
        )}

        {error && (
          <div style={{
            backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px',
            padding: '12px 16px', marginBottom: '16px', color: '#dc2626', fontSize: '13px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {fields.map(f => (
              <div key={f.name}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                  {f.label} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    {...register(f.name as any)}
                    type={show[f.key] ? 'text' : 'password'}
                    placeholder="••••••••"
                    style={{
                      width: '100%', padding: '10px 40px 10px 14px',
                      border: `1px solid ${errors[f.name as keyof FormData] ? '#fca5a5' : '#e5e7eb'}`,
                      borderRadius: '8px', fontSize: '14px', outline: 'none',
                      boxSizing: 'border-box', color: '#111827'
                    }}
                  />
                  <button type="button"
                    onClick={() => setShow(s => ({ ...s, [f.key]: !s[f.key] }))}
                    style={{
                      position: 'absolute', right: '12px', top: '50%',
                      transform: 'translateY(-50%)', background: 'none',
                      border: 'none', cursor: 'pointer', padding: 0
                    }}>
                    {show[f.key] ? <EyeOff size={16} color="#9ca3af" /> : <Eye size={16} color="#9ca3af" />}
                  </button>
                </div>
                {errors[f.name as keyof FormData] && (
                  <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                    {errors[f.name as keyof FormData]?.message}
                  </p>
                )}
              </div>
            ))}

            <button type="submit" disabled={loading} style={{
              width: 'fit-content', padding: '10px 24px',
              backgroundColor: loading ? '#93c5fd' : '#3b82f6',
              color: 'white', border: 'none', borderRadius: '8px',
              fontSize: '14px', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px'
            }}>
              {loading && <Loader2 size={15} />}
              Cập nhật mật khẩu
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}