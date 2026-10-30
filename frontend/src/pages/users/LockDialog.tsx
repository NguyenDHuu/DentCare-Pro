import { useState } from 'react'
import { Lock, Unlock, AlertTriangle } from 'lucide-react'
import { authApi } from '../../api/auth.api'

interface Props {
  user: { id: number; fullName: string; username: string; isActive: boolean }
  onClose: () => void
  onSuccess: () => void
}

export default function LockDialog({ user, onClose, onSuccess }: Props) {
  const [reason, setReason]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const isLocking = user.isActive

  const handleConfirm = async () => {
    if (isLocking && !reason.trim())
      return setError('Vui lòng nhập lý do khóa tài khoản.')

    setLoading(true); setError('')
    try {
      await authApi.toggleStatus(user.id, !isLocking, reason.trim() || undefined)
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi hệ thống')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '14px', width: '380px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden',
      }}>
        {/* Icon header */}
        <div style={{
          backgroundColor: isLocking ? '#fef2f2' : '#f0fdf4',
          padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            backgroundColor: isLocking ? '#fee2e2' : '#dcfce7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isLocking
              ? <Lock size={22} color="#ef4444" />
              : <Unlock size={22} color="#16a34a" />}
          </div>
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: 0 }}>
              {isLocking ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
            </h3>
            <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
              <strong>{user.fullName}</strong> ({user.username})
            </p>
          </div>
        </div>

        <div style={{ padding: '20px' }}>
          {/* Warning */}
          {isLocking && (
            <div style={{
              display: 'flex', gap: '10px', padding: '12px', borderRadius: '8px',
              backgroundColor: '#fffbeb', border: '1px solid #fcd34d', marginBottom: '16px',
            }}>
              <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '1px' }} />
              <p style={{ fontSize: '12px', color: '#92400e', lineHeight: 1.5 }}>
                Tài khoản sẽ bị đăng xuất ngay lập tức và không thể đăng nhập cho đến khi được mở khóa.
              </p>
            </div>
          )}

          {/* Reason */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
              Lý do {isLocking ? <span style={{ color: '#ef4444' }}>*</span> : <span style={{ color: '#9ca3af' }}>(tùy chọn)</span>}
            </label>
            <textarea
              value={reason}
              onChange={e => { setReason(e.target.value); setError('') }}
              placeholder={isLocking ? 'Nhập lý do khóa tài khoản...' : 'Nhập ghi chú (nếu có)...'}
              rows={3}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: '8px',
                border: `1px solid ${error ? '#fca5a5' : '#e5e7eb'}`,
                fontSize: '13px', resize: 'none', outline: 'none',
                color: '#111827', boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '6px' }}>{error}</p>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button onClick={onClose} style={{
              flex: 1, padding: '9px', borderRadius: '8px', border: '1px solid #e5e7eb',
              background: 'white', fontSize: '13px', cursor: 'pointer', color: '#374151',
            }}>Hủy</button>
            <button onClick={handleConfirm} disabled={loading} style={{
              flex: 1, padding: '9px', borderRadius: '8px', border: 'none',
              backgroundColor: loading ? '#d1d5db' : (isLocking ? '#ef4444' : '#16a34a'),
              color: 'white', fontSize: '13px', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}>
              {loading ? 'Đang xử lý...' : (isLocking ? 'Xác nhận khóa' : 'Xác nhận mở khóa')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
