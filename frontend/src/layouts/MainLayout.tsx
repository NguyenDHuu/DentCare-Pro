import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

const pageTitles: Record<string, { title: string; subtitle?: string }> = {
  '/dashboard':           { title: 'Tổng quan hệ thống', subtitle: 'Thống kê nhanh và truy cập các chức năng quản lý hệ thống DentCare Pro.' },
  '/users':               { title: 'Quản lý người dùng', subtitle: 'Tạo, xem, cập nhật và quản lý vòng đời tài khoản nhân sự (UC05/UC06).' },
  '/users/receptionist':  { title: 'Quản lý Lễ tân',     subtitle: 'Quản lý tài khoản và thông tin bộ phận Lễ tân (UC05/UC06).' },
  '/users/doctor':        { title: 'Quản lý Bác sĩ',     subtitle: 'Quản lý tài khoản và thông tin bộ phận Bác sĩ (UC05/UC06).' },
  '/users/accountant':    { title: 'Quản lý Kế toán',    subtitle: 'Quản lý tài khoản và thông tin bộ phận Kế toán (UC05/UC06).' },
  '/users/admin':         { title: 'Quản lý Admin',       subtitle: 'Quản lý tài khoản và thông tin bộ phận Admin (UC05/UC06).' },
  '/services':            { title: 'Dịch vụ nha khoa' },
  '/pricing':             { title: 'Quản lý Bảng giá Dịch vụ', subtitle: 'Thiết lập, cập nhật và tra cứu bảng giá dịch vụ nha khoa (UC10).' },
  '/services':            { title: 'Quản lý Dịch vụ Nha khoa', subtitle: 'Quản lý nhóm dịch vụ (UC08) và các dịch vụ (UC09) của phòng khám.' },
  '/services/groups':     { title: 'Quản lý Dịch vụ Nha khoa', subtitle: 'Quản lý nhóm dịch vụ (UC08) và các dịch vụ (UC09) của phòng khám.' },
  '/logs':                { title: 'Nhật ký hoạt động hệ thống', subtitle: 'Giám sát và truy vết các hành động quan trọng (UC07). Chỉ Admin được xem.' },
  '/profile':             { title: 'Hồ sơ cá nhân', subtitle: 'Quản lý thông tin tài khoản và thiết lập cá nhân của bạn.' },
  '/settings':            { title: 'Cài đặt hệ thống' },
  '/shifts':              { title: 'Cấu hình Ca làm việc', subtitle: 'Thiết lập các ca khám và khung giờ hoạt động của phòng khám (UC06).' },
  '/schedules':           { title: 'Phân công Lịch trực Bác sĩ', subtitle: 'Lên lịch, phân công và quản lý lịch trực bác sĩ theo tuần (UC08).' },
  '/holidays':            { title: 'Quản lý Ngày nghỉ lễ', subtitle: 'Cấu hình ngày nghỉ, lễ tết và các ngày không tiếp bệnh nhân (UC07).' },
  '/sms':                 { title: 'Cấu hình Thông báo SMS', subtitle: 'Quản lý mẫu SMS, cài đặt gateway và lịch sử gửi thông báo tự động (UC10).' },
  '/salary/uc4.1': { title: 'Mức tiền cơ bản',     subtitle: 'Cấu hình đơn giá giờ công và lương cố định tháng (UC4.1).' },
  '/salary/uc4.2': { title: 'Hệ số ca làm việc',  subtitle: 'Cấu hình hệ số nhân lương theo loại ca làm việc (UC4.2).' },
  '/salary/uc4.3': { title: 'Hệ số ca phức tạp',  subtitle: 'Phê duyệt hệ số ca phức tạp cho bác sĩ (UC4.3).' },
  '/salary/uc4.5': { title: 'Báo cáo lương tháng', subtitle: 'Tổng hợp quỹ lương tất cả nhân sự trong tháng (UC4.5).' },
  '/salary/uc4.6': { title: 'Lương năm – 1 nhân sự', subtitle: 'Tra cứu lịch sử lương năm từng nhân sự (UC4.6).' },
  '/salary/uc4.7': { title: 'Lương năm – Toàn bộ',  subtitle: 'Báo cáo lương năm toàn phòng khám (UC4.7).' },
  '/salary':       { title: 'Quản lý lương' },
}

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const page = pageTitles[location.pathname] || { title: 'DentCare Pro' }

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header title={page.title} subtitle={page.subtitle} />
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: '#f9fafb' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}