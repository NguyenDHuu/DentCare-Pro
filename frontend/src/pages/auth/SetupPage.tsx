import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { authApi } from '../../api/auth.api'
import { HeartPulse, Eye, EyeOff, Loader2 } from 'lucide-react'

const schema = z.object({
  fullName: z.string().min(2, 'Họ tên tối thiểu 2 ký tự'),
  username: z.string().min(3, 'Tên đăng nhập tối thiểu 3 ký tự'),
  email: z.string().email('Email không hợp lệ'),
  password: z.string()
    .min(8, 'Tối thiểu 8 ký tự')
    .regex(/[A-Z]/, 'Phải có ít nhất 1 chữ hoa')
    .regex(/[a-z]/, 'Phải có ít nhất 1 chữ thường')
    .regex(/[0-9]/, 'Phải có ít nhất 1 số')
    .regex(/[^A-Za-z0-9]/, 'Phải có ít nhất 1 ký tự đặc biệt'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword'],
})

type FormData = z.infer<typeof schema>

export default function SetupPage() {
  const navigate = useNavigate()
  const [showPw, setShowPw] = useState(false)
  const [showCpw, setShowCpw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema)
  })

  // Nếu đã có admin → chuyển về login
  useEffect(() => {
    authApi.checkSetup().then(res => {
      if (res.data.initialized) navigate('/login')
    })
  }, [])

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setError('')
    try {
      await authApi.setup(data)
      navigate('/login')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi hệ thống')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4">
            <HeartPulse className="text-white" size={28} />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Nha Khoa Smile</h1>
          <p className="text-gray-500 text-sm">Hệ thống Quản lý Phòng khám</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full mb-3">
              <HeartPulse size={12} /> Khởi tạo hệ thống lần đầu (UC01)
            </span>
            <h2 className="text-xl font-bold text-gray-900">Tạo tài khoản Admin</h2>
            <p className="text-gray-500 text-sm mt-1">Chỉ thực hiện một lần khi hệ thống chưa có Admin nào</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Họ tên */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Họ và tên <span className="text-red-500">*</span>
              </label>
              <input
                {...register('fullName')}
                placeholder="Nguyễn Văn A"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
            </div>

            {/* Tên đăng nhập */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tên đăng nhập <span className="text-red-500">*</span>
              </label>
              <input
                {...register('username')}
                placeholder="admin"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                {...register('email')}
                placeholder="admin@nhakhoa.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            {/* Mật khẩu */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mật khẩu <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            {/* Xác nhận mật khẩu */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Xác nhận mật khẩu <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  {...register('confirmPassword')}
                  type={showCpw ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                />
                <button type="button" onClick={() => setShowCpw(!showCpw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showCpw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Tạo tài khoản Admin
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            Đã có tài khoản?{' '}
            <a href="/login" className="text-blue-600 hover:underline font-medium">Đăng nhập</a>
          </p>
        </div>
      </div>
    </div>
  )
}