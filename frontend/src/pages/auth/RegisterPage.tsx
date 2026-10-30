import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { authApi } from '../../api/auth.api'
import { HeartPulse, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'

const schema = z.object({
  fullName:        z.string().min(2, 'Họ tên tối thiểu 2 ký tự'),
  username:        z.string().min(3, 'Tên đăng nhập tối thiểu 3 ký tự'),
  email:           z.string().email('Email không hợp lệ'),
  password:        z.string()
    .min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
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

export default function RegisterPage() {
  const navigate = useNavigate()
  const [showPw, setShowPw]   = useState(false)
  const [showCpw, setShowCpw] = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema)
  })

  const watchedPw = watch('password', '')

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError('')
    try {
      await authApi.register(data)
      navigate('/login')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi hệ thống')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>

      {/* Left — Giới thiệu + Policy */}
      <div style={{
        width: '38%',
        background: 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)',
        color: 'white', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', padding: '40px'
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
          <h2 style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1.3, marginBottom: '12px' }}>
            Tạo tài khoản Admin
          </h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, marginBottom: '32px' }}>
            Tài khoản Admin có toàn quyền quản trị hệ thống. Vui lòng đảm bảo thông tin chính xác và mật khẩu bảo mật.
          </p>

          {/* Policy checklist */}
          <p style={{ fontSize: '13px', fontWeight: 700, marginBottom: '14px' }}>Chính sách mật khẩu</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {policies.map(p => {
              const passed = p.regex.test(watchedPw)
              return (
                <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle2
                    size={16}
                    color={passed ? '#4ade80' : 'rgba(255,255,255,0.3)'}
                    fill={passed ? 'rgba(74,222,128,0.2)' : 'none'}
                  />
                  <span style={{ fontSize: '13px', color: passed ? '#4ade80' : 'rgba(255,255,255,0.6)' }}>
                    {p.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>© 2025 DentCare Pro</p>
      </div>

      {/* Right — Form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', backgroundColor: '#ffffff' }}>
        <div style={{ width: '100%', maxWidth: '440px' }}>
          <div style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#111827' }}>Đăng ký tài khoản Admin</h2>
            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '6px' }}>Điền đầy đủ thông tin để tạo tài khoản</p>
          </div>

          {error && (
            <div style={{
              backgroundColor: '#fef2f2', border: '1px solid #fca5a5',
              borderRadius: '8px', padding: '10px 14px',
              marginBottom: '16px', color: '#dc2626', fontSize: '13px'
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Text fields */}
              {[
                { name: 'fullName', label: 'Họ và tên',     placeholder: 'Nguyễn Văn A',      type: 'text'  },
                { name: 'username', label: 'Tên đăng nhập', placeholder: 'admin',             type: 'text'  },
                { name: 'email',    label: 'Email',          placeholder: 'admin@nhakhoa.com', type: 'email' },
              ].map(f => (
                <div key={f.name}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                    {f.label} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    {...register(f.name as any)}
                    type={f.type}
                    placeholder={f.placeholder}
                    style={{
                      width: '100%', padding: '10px 14px',
                      border: `1px solid ${errors[f.name as keyof FormData] ? '#fca5a5' : '#e5e7eb'}`,
                      borderRadius: '8px', fontSize: '14px', outline: 'none',
                      boxSizing: 'border-box', color: '#111827'
                    }}
                  />
                  {errors[f.name as keyof FormData] && (
                    <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                      {errors[f.name as keyof FormData]?.message}
                    </p>
                  )}
                </div>
              ))}

              {/* Password fields */}
              {[
                { name: 'password',        label: 'Mật khẩu',          show: showPw,  toggle: () => setShowPw(!showPw)   },
                { name: 'confirmPassword', label: 'Xác nhận mật khẩu', show: showCpw, toggle: () => setShowCpw(!showCpw) },
              ].map(f => (
                <div key={f.name}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
                    {f.label} <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      {...register(f.name as any)}
                      type={f.show ? 'text' : 'password'}
                      placeholder="••••••••"
                      style={{
                        width: '100%', padding: '10px 40px 10px 14px',
                        border: `1px solid ${errors[f.name as keyof FormData] ? '#fca5a5' : '#e5e7eb'}`,
                        borderRadius: '8px', fontSize: '14px', outline: 'none',
                        boxSizing: 'border-box', color: '#111827'
                      }}
                    />
                    <button type="button" onClick={f.toggle} style={{
                      position: 'absolute', right: '12px', top: '50%',
                      transform: 'translateY(-50%)', background: 'none',
                      border: 'none', cursor: 'pointer', padding: 0
                    }}>
                      {f.show ? <EyeOff size={16} color="#9ca3af" /> : <Eye size={16} color="#9ca3af" />}
                    </button>
                  </div>
                  {errors[f.name as keyof FormData] && (
                    <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                      {errors[f.name as keyof FormData]?.message}
                    </p>
                  )}
                </div>
              ))}

              {/* Submit */}
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '11px',
                backgroundColor: loading ? '#93c5fd' : '#2563eb',
                color: 'white', border: 'none', borderRadius: '8px',
                fontSize: '14px', fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '8px', marginTop: '4px'
              }}>
                {loading && <Loader2 size={16} />}
                Tạo tài khoản Admin
              </button>

              <p style={{ textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>
                Đã có tài khoản?{' '}
                <a href="/login" style={{ color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>
                  Đăng nhập
                </a>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}