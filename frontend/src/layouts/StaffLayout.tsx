import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import StaffSidebar from './StaffSidebar'
import Header from './Header'

const pageTitles: Record<string, { title: string; subtitle?: string }> = {
  // Lễ tân
  '/staff/dashboard':         { title: 'Bảng điều khiển',         subtitle: 'Tổng quan hoạt động và công việc trong ngày.' },
  '/staff/appointments':      { title: 'Danh sách lịch hẹn',      subtitle: 'Xem, tra cứu và quản lý toàn bộ lịch hẹn bệnh nhân.' },
  '/staff/appointments/new':  { title: 'Đặt lịch hẹn mới',        subtitle: 'Tạo lịch hẹn khám mới cho bệnh nhân.' },
  '/staff/emergency':         { title: 'Lịch cấp cứu',            subtitle: 'Tiếp nhận và xử lý ca cấp cứu ngoài giờ.' },
  '/staff/waitlist':          { title: 'Danh sách chờ',           subtitle: 'Quản lý hàng chờ bệnh nhân tại phòng khám.' },
  '/staff/service-groups':    { title: 'Nhóm dịch vụ',            subtitle: 'Tra cứu danh mục nhóm dịch vụ nha khoa.' },
  '/staff/shifts':            { title: 'Ca làm việc',             subtitle: 'Xem cấu hình các ca khám và khung giờ hoạt động.' },
  '/staff/schedules':         { title: 'Phân công lịch trực',     subtitle: 'Xem lịch phân công bác sĩ theo tuần.' },
  '/staff/doctor-schedule':   { title: 'Lịch trực bác sĩ',       subtitle: 'Tra cứu lịch trực của từng bác sĩ.' },
  '/staff/holidays':          { title: 'Ngày nghỉ lễ',            subtitle: 'Xem lịch nghỉ lễ và các ngày không tiếp bệnh nhân.' },
  '/staff/sms':               { title: 'Thông báo SMS',           subtitle: 'Xem lịch sử gửi thông báo SMS cho bệnh nhân.' },
  '/staff/profile':           { title: 'Hồ sơ cá nhân',          subtitle: 'Quản lý thông tin tài khoản cá nhân.' },
  '/staff/change-password':   { title: 'Đổi mật khẩu',           subtitle: 'Thay đổi mật khẩu đăng nhập.' },
  // Bác sĩ
  '/staff/today-schedule':    { title: 'Lịch khám hôm nay',      subtitle: 'Danh sách bệnh nhân và lịch khám trong ngày.' },
  '/staff/patients':          { title: 'Hồ sơ bệnh nhân',        subtitle: 'Tra cứu và quản lý hồ sơ điều trị bệnh nhân.' },
  '/staff/my-schedule':       { title: 'Lịch trực của tôi',      subtitle: 'Xem và quản lý lịch trực cá nhân.' },
  // Kế toán
  '/staff/invoices':          { title: 'Hóa đơn & Thanh toán',   subtitle: 'Quản lý hóa đơn và xử lý thanh toán bệnh nhân.' },
  '/staff/reports':           { title: 'Báo cáo doanh thu',      subtitle: 'Thống kê và xuất báo cáo tài chính theo kỳ.' },
  '/staff/salary/uc4.3':      { title: 'Hệ số ca phức tạp',              subtitle: 'Đề xuất hệ số mức độ khó cho ca bệnh nhân phức tạp trong ca trực (UC4.3).' },
  '/staff/salary/uc4.4':      { title: 'Lập phiếu lương tháng',          subtitle: 'Tạo và xác nhận phiếu lương hàng tháng cho toàn bộ nhân sự (UC4.4).' },
  '/staff/salary/uc4.5':      { title: 'Báo cáo lương tháng',            subtitle: 'Tổng hợp quỹ lương tất cả nhân sự trong tháng (UC4.5).' },
  '/staff/salary/uc4.6':      { title: 'Lương năm – 1 nhân sự',          subtitle: 'Tra cứu diễn biến lương 12 tháng của một nhân sự (UC4.6).' },
  '/staff/salary/uc4.7':      { title: 'Báo cáo quỹ lương năm',          subtitle: 'Tổng hợp quỹ lương toàn bộ nhân sự cả năm (UC4.7).' },
}

export default function StaffLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const page = pageTitles[location.pathname] || { title: 'DentCare Pro' }

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <StaffSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header title={page.title} subtitle={page.subtitle} />
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: '#f9fafb' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
