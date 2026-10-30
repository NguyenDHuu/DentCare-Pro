import { useLocation } from 'react-router-dom'
import { Clock } from 'lucide-react'

export default function StaffPlaceholderPage() {
  const location = useLocation()

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '360px',
    }}>
      <div style={{
        width: '56px', height: '56px', borderRadius: '14px', backgroundColor: '#eff6ff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px',
      }}>
        <Clock size={26} color="#2563eb" />
      </div>
      <p style={{ fontSize: '17px', fontWeight: 700, color: '#111827', margin: 0 }}>
        Đang phát triển
      </p>
      <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px', textAlign: 'center', lineHeight: 1.6 }}>
        Tính năng tại <code style={{ backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>{location.pathname}</code>
        <br />đang được xây dựng và sẽ sớm hoàn thành.
      </p>
    </div>
  )
}
