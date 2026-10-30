import { useLocation } from 'react-router-dom'
import { Clock } from 'lucide-react'

const UC_META: Record<string, { title: string; desc: string }> = {
  'uc4.2': { title: 'UC4.2 – Hệ số ca làm việc',   desc: 'Cấu hình hệ số nhân lương theo loại ca làm việc của bác sĩ.' },
  'uc4.3': { title: 'UC4.3 – Hệ số ca phức tạp',   desc: 'Phê duyệt và cấu hình hệ số ca phức tạp cho bác sĩ.' },
  'uc4.4': { title: 'UC4.4 – Lập phiếu lương tháng', desc: 'Tạo và xác nhận phiếu lương hàng tháng cho toàn bộ nhân sự.' },
  'uc4.5': { title: 'UC4.5 – Báo cáo lương tháng', desc: 'Xem báo cáo tổng hợp lương theo tháng.' },
  'uc4.6': { title: 'UC4.6 – Lương năm (1 nhân sự)', desc: 'Tra cứu lịch sử lương năm của từng nhân sự.' },
  'uc4.7': { title: 'UC4.7 – Lương năm (toàn bộ)', desc: 'Báo cáo lương năm toàn bộ nhân sự phòng khám.' },
}

export default function SalaryPlaceholderPage() {
  const location = useLocation()
  // Extract the UC key from the path (e.g. /salary/uc4.2 → uc4.2)
  const ucKey = location.pathname.split('/').pop() ?? ''
  const meta  = UC_META[ucKey] ?? { title: ucKey.toUpperCase(), desc: 'Chức năng đang phát triển.' }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: 0 }}>{meta.title}</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{meta.desc}</p>
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
        padding: '80px 40px', color: '#9ca3af',
      }}>
        <Clock size={48} style={{ marginBottom: 16, opacity: 0.35 }} />
        <p style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#6b7280' }}>Chức năng đang phát triển</p>
        <p style={{ fontSize: 13, marginTop: 8 }}>Tính năng này sẽ sớm được ra mắt trong phiên bản tiếp theo.</p>
      </div>
    </div>
  )
}
