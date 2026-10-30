import { useAuthStore } from '../stores/auth.store'
import { Bell } from 'lucide-react'
import { useEffect, useState } from 'react'

interface Props { title: string; subtitle?: string }

function getGreeting() {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12)  return 'Chào buổi sáng'
  if (hour >= 12 && hour < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

export default function Header({ title, subtitle }: Props) {
  const { user, activeRole } = useAuthStore()
  const [greeting, setGreeting] = useState(getGreeting())

  // Cập nhật lời chào theo thời gian thực
  useEffect(() => {
    const interval = setInterval(() => {
      setGreeting(getGreeting())
    }, 60000) // cập nhật mỗi phút
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 24px', backgroundColor: 'white',
      borderBottom: '1px solid #f1f5f9', flexShrink: 0
    }}>
      <div>
        <h1 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{subtitle}</p>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Bell */}
        <button style={{
          position: 'relative', width: '36px', height: '36px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '10px', border: 'none', background: 'none', cursor: 'pointer'
        }}>
          <Bell size={18} color="#6b7280" />
          <span style={{
            position: 'absolute', top: '6px', right: '6px',
            width: '8px', height: '8px', backgroundColor: '#ef4444', borderRadius: '50%'
          }} />
        </button>

        {/* User info — không có mũi tên, thêm lời chào */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '13px', color: '#6b7280' }}>
              {greeting},{' '}
              <span style={{ fontWeight: 600, color: '#111827' }}>{user?.fullName}</span>
            </p>
            <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px', textTransform: 'capitalize' }}>
              {activeRole?.toLowerCase()}
            </p>
          </div>
          <div style={{
            width: '36px', height: '36px', backgroundColor: '#3b82f6',
            borderRadius: '50%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'white', fontWeight: 700,
            fontSize: '14px', flexShrink: 0
          }}>
            {user?.fullName?.charAt(0) || 'U'}
          </div>
        </div>
      </div>
    </div>
  )
}