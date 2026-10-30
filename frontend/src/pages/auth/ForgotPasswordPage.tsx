import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { authApi } from '../../api/auth.api'
import { Loader2, HeartPulse } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { register, handleSubmit } = useForm<{ email: string }>()

  const onSubmit = async (data: any) => {
    setLoading(true)
    setError('')
    try {
      await authApi.forgotPassword(data)
      setSent(true)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi hệ thống')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">

      {/* Brand */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-3">
          <HeartPulse className="text-white" size={28} />
        </div>
        <h1 className="text-xl font-bold text-gray-900">DentCare Pro</h1>
        <p className="text-sm text-gray-500">Hệ thống Quản lý Phòng khám</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Quên mật khẩu</h2>
          <p className="text-sm text-gray-500 mt-1">
            Nhập email đã đăng ký để nhận hướng dẫn đặt lại mật khẩu (UC04)
          </p>
        </div>

        {sent ? (
          <div className="text-center py-4 space-y-2">
            <div className="bg-green-50 text-green-700 px-4 py-4 rounded-xl text-sm">
              📧 Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu. Vui lòng kiểm tra hộp thư.
            </div>
            <p className="text-gray-400 text-xs mt-3">Đường dẫn có hiệu lực trong 30 phút</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
            )}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email đã đăng ký <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('email')}
                  type="email"
                  placeholder="email@nhakhoa.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                Gửi yêu cầu đặt lại mật khẩu
              </button>
            </form>
          </>
        )}

        <div className="text-center mt-5">
          <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700">
            Quay lại đăng nhập
          </Link>
        </div>
      </div>
    </div>
  )
}
