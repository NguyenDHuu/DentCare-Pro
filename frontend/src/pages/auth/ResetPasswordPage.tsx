import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { authApi } from '../../api/auth.api'
import { Eye, EyeOff, Loader2, CheckCircle2, HeartPulse, ShieldCheck, Lock, ArrowLeft } from 'lucide-react'

const schema = z.object({
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
  { label: 'Tối thiểu 8 ký tự',           regex: /.{8,}/ },
  { label: 'Ít nhất 1 chữ HOA (A–Z)',      regex: /[A-Z]/ },
  { label: 'Ít nhất 1 chữ thường (a–z)',   regex: /[a-z]/ },
  { label: 'Ít nhất 1 chữ số (0–9)',       regex: /[0-9]/ },
  { label: 'Ít nhất 1 ký tự đặc biệt',    regex: /[^A-Za-z0-9]/ },
]

function getStrength(pw: string): number {
  return policies.filter(p => p.regex.test(pw)).length
}

const strengthConfig = [
  { label: 'Rất yếu',  color: '#ef4444' },
  { label: 'Yếu',      color: '#f97316' },
  { label: 'Trung bình', color: '#eab308' },
  { label: 'Tốt',      color: '#22c55e' },
  { label: 'Mạnh',     color: '#16a34a' },
]

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [showNew, setShowNew] = useState(false)
  const [showCon, setShowCon] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    if (!token) navigate('/forgot-password', { replace: true })
  }, [token, navigate])

  useEffect(() => {
    if (!success) return
    const id = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(id); navigate('/login'); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [success, navigate])

  const { register, handleSubmit, formState: { errors }, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const watchedNew = watch('newPassword', '')
  const strength = getStrength(watchedNew)

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError('')
    try {
      await authApi.resetPassword({ token, newPassword: data.newPassword, confirmPassword: data.confirmPassword })
      setSuccess(true)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi hệ thống')
    } finally {
      setLoading(false)
    }
  }

  if (!token) return null

  /* ───────── Success screen ───────── */
  if (success) {
    return (
      <div style={{
        minHeight: '100vh', background: 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      }}>
        <div style={{
          backgroundColor: 'white', borderRadius: '24px', padding: '56px 48px',
          maxWidth: '440px', width: '100%', textAlign: 'center',
          boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
        }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <CheckCircle2 size={40} color="white" />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', marginBottom: '10px' }}>
            Đặt lại mật khẩu thành công!
          </h2>
          <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.7, marginBottom: '28px' }}>
            Mật khẩu của bạn đã được cập nhật. Hệ thống sẽ tự động chuyển về trang đăng nhập sau{' '}
            <span style={{ fontWeight: 700, color: '#2563eb' }}>{countdown}s</span>.
          </p>
          <Link to="/login" style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '11px 28px', backgroundColor: '#2563eb', color: 'white',
            borderRadius: '10px', fontSize: '14px', fontWeight: 600, textDecoration: 'none',
          }}>
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    )
  }

  /* ───────── Main form ───────── */
  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>

      {/* Left panel */}
      <div style={{
        width: '44%', background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 60%, #1e3a8a 100%)',
        color: 'white', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', padding: '40px 48px',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <HeartPulse size={20} />
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: '15px' }}>DentCare Pro</p>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Hệ thống Quản lý Phòng khám</p>
          </div>
        </div>

        {/* Center content */}
        <div>
          <div style={{
            width: '72px', height: '72px', backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '28px',
          }}>
            <Lock size={34} />
          </div>

          <h2 style={{ fontSize: '32px', fontWeight: 800, lineHeight: 1.3, marginBottom: '16px' }}>
            Bảo vệ tài khoản<br />của bạn
          </h2>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, marginBottom: '36px' }}>
            Hãy tạo một mật khẩu mạnh để bảo vệ tài khoản DentCare Pro. Mật khẩu tốt giúp ngăn chặn truy cập trái phép vào dữ liệu phòng khám.
          </p>

          {/* Tips */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { icon: '🔐', tip: 'Không dùng lại mật khẩu từ tài khoản khác' },
              { icon: '🔀', tip: 'Kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt' },
              { icon: '🚫', tip: 'Tránh dùng tên, ngày sinh hoặc thông tin cá nhân' },
              { icon: '🔒', tip: 'Không chia sẻ mật khẩu với bất kỳ ai' },
            ].map(item => (
              <div key={item.tip} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                  width: '34px', height: '34px', backgroundColor: 'rgba(255,255,255,0.15)',
                  borderRadius: '8px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '16px', flexShrink: 0,
                }}>
                  {item.icon}
                </div>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, marginTop: '7px' }}>
                  {item.tip}
                </p>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>© 2026 DentCare Pro. Phiên bản 1.0</p>
      </div>

      {/* Right panel */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px', backgroundColor: '#ffffff', overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>

          {/* Header */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '48px', height: '48px', backgroundColor: '#eff6ff',
              borderRadius: '14px', marginBottom: '20px',
            }}>
              <ShieldCheck size={24} color="#2563eb" />
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', marginBottom: '6px' }}>
              Đặt lại mật khẩu
            </h2>
            <p style={{ fontSize: '13px', color: '#6b7280' }}>
              Tạo mật khẩu mới an toàn cho tài khoản của bạn
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px',
              padding: '12px 16px', marginBottom: '20px', color: '#dc2626',
              fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span style={{ fontSize: '16px' }}>⚠️</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* New password */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                  Mật khẩu mới <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    {...register('newPassword')}
                    type={showNew ? 'text' : 'password'}
                    placeholder="Nhập mật khẩu mới"
                    style={{
                      width: '100%', padding: '11px 42px 11px 14px',
                      border: `1.5px solid ${errors.newPassword ? '#fca5a5' : '#e5e7eb'}`,
                      borderRadius: '10px', fontSize: '14px', outline: 'none',
                      boxSizing: 'border-box', color: '#111827',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6' }}
                    onBlur={e => { e.currentTarget.style.borderColor = errors.newPassword ? '#fca5a5' : '#e5e7eb' }}
                  />
                  <button type="button" onClick={() => setShowNew(v => !v)}
                    style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9ca3af' }}>
                    {showNew ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>

                {/* Strength bar */}
                {watchedNew.length > 0 && (
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} style={{
                          flex: 1, height: '4px', borderRadius: '99px',
                          backgroundColor: i <= strength ? strengthConfig[strength - 1]?.color : '#e5e7eb',
                          transition: 'background-color 0.3s',
                        }} />
                      ))}
                    </div>
                    {strength > 0 && (
                      <p style={{ fontSize: '12px', color: strengthConfig[strength - 1]?.color, fontWeight: 600 }}>
                        {strengthConfig[strength - 1]?.label}
                      </p>
                    )}
                  </div>
                )}

                {/* Policy checklist */}
                <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {policies.map(p => {
                    const ok = p.regex.test(watchedNew)
                    return (
                      <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{
                          width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backgroundColor: ok ? '#dcfce7' : '#f3f4f6',
                          transition: 'background-color 0.2s',
                        }}>
                          <CheckCircle2 size={11} color={ok ? '#16a34a' : '#d1d5db'} />
                        </div>
                        <span style={{ fontSize: '11.5px', color: ok ? '#15803d' : '#9ca3af', fontWeight: ok ? 500 : 400 }}>
                          {p.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Confirm password */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                  Xác nhận mật khẩu mới <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    {...register('confirmPassword')}
                    type={showCon ? 'text' : 'password'}
                    placeholder="Nhập lại mật khẩu mới"
                    style={{
                      width: '100%', padding: '11px 42px 11px 14px',
                      border: `1.5px solid ${errors.confirmPassword ? '#fca5a5' : '#e5e7eb'}`,
                      borderRadius: '10px', fontSize: '14px', outline: 'none',
                      boxSizing: 'border-box', color: '#111827',
                      transition: 'border-color 0.15s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6' }}
                    onBlur={e => { e.currentTarget.style.borderColor = errors.confirmPassword ? '#fca5a5' : '#e5e7eb' }}
                  />
                  <button type="button" onClick={() => setShowCon(v => !v)}
                    style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#9ca3af' }}>
                    {showCon ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' } as React.CSSProperties}>
                    ⚠ {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '12px',
                  backgroundColor: loading ? '#93c5fd' : '#2563eb',
                  color: 'white', border: 'none', borderRadius: '10px',
                  fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  marginTop: '4px', transition: 'background-color 0.15s',
                }}
                onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = '#1d4ed8' }}
                onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.backgroundColor = '#2563eb' }}
              >
                {loading ? <Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> : <ShieldCheck size={17} />}
                {loading ? 'Đang xử lý...' : 'Xác nhận đặt lại mật khẩu'}
              </button>

            </div>
          </form>

          {/* Back to login */}
          <div style={{ marginTop: '28px', textAlign: 'center' }}>
            <Link to="/login" style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontSize: '13px', color: '#6b7280', textDecoration: 'none',
              transition: 'color 0.15s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#374151' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#6b7280' }}
            >
              <ArrowLeft size={14} />
              Quay lại đăng nhập
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
