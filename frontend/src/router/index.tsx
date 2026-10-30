import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth.store'
import MainLayout from '../layouts/MainLayout'
import StaffLayout from '../layouts/StaffLayout'

// Auth pages
import SetupPage          from '../pages/auth/SetupPage'
import RegisterPage       from '../pages/auth/RegisterPage'
import LoginPage          from '../pages/auth/LoginPage'
import ChangePasswordPage from '../pages/auth/ChangePasswordPage'
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage'
import ResetPasswordPage  from '../pages/auth/ResetPasswordPage'

// Admin pages
import DashboardPage  from '../pages/dashboard/DashboardPage'
import UsersPage      from '../pages/users/UsersPage'
import LogsPage       from '../pages/logs/LogsPage'
import ServicesPage   from '../pages/services/ServicesPage'
import PricePage      from '../pages/pricing/PricePage'
import ProfilePage    from '../pages/profile/ProfilePage'
import ShiftsPage     from '../pages/shifts/ShiftsPage'
import SchedulesPage  from '../pages/schedules/SchedulesPage'
import HolidaysPage   from '../pages/holidays/HolidaysPage'
import SmsPage              from '../pages/sms/SmsPage'
import SalaryConfigPage         from '../pages/salary/SalaryConfigPage'
import SalaryPlaceholderPage    from '../pages/salary/SalaryPlaceholderPage'
import ShiftCoefficientPage       from '../pages/salary/ShiftCoefficientPage'
import MonthlySalaryReportPage   from '../pages/salary/MonthlySalaryReportPage'
import AnnualPersonalReportPage  from '../pages/salary/AnnualPersonalReportPage'
import AnnualFullReportPage      from '../pages/salary/AnnualFullReportPage'
import ShiftComplexityAdminPage  from '../pages/salary/ShiftComplexityAdminPage'
import DoctorComplexityPage      from '../pages/salary/DoctorComplexityPage'
import PayslipPage               from '../pages/salary/PayslipPage'

// Staff pages
import StaffDashboardPage        from '../pages/staff/StaffDashboardPage'
import NewAppointmentPage        from '../pages/staff/NewAppointmentPage'
import AppointmentListPage       from '../pages/staff/AppointmentListPage'
import DoctorScheduleViewPage    from '../pages/staff/DoctorScheduleViewPage'
import StaffPlaceholderPage      from '../pages/staff/StaffPlaceholderPage'
import DoctorMySchedulePage      from '../pages/staff/DoctorMySchedulePage'
import TodaySchedulePage         from '../pages/staff/TodaySchedulePage'
import StaffSmsPage             from '../pages/staff/StaffSmsPage'
import PatientListPage          from '../pages/patients/PatientListPage'
import NewPatientPage           from '../pages/patients/NewPatientPage'
import PatientDetailPage        from '../pages/patients/PatientDetailPage'
import ReceptionPage           from '../pages/reception/ReceptionPage'
import TreatmentPage          from '../pages/treatment/TreatmentPage'
import InvoicePage            from '../pages/invoice/InvoicePage'
import StatsPage              from '../pages/stats/StatsPage'

// ─── Route guards ─────────────────────────────────────────────

/** Đã đăng nhập mới vào được */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore(s => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

/** Chỉ Admin */
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { token, activeRole } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (activeRole !== 'ADMIN') return <Navigate to="/staff/dashboard" replace />
  return <>{children}</>
}

/** Nhân sự (non-admin) */
const StaffRoute = ({ children }: { children: React.ReactNode }) => {
  const { token, activeRole } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (activeRole === 'ADMIN') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

// ─── Router ───────────────────────────────────────────────────

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public ── */}
        <Route path="/setup"           element={<SetupPage />} />
        <Route path="/register"        element={<RegisterPage />} />
        <Route path="/login"           element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password"  element={<ResetPasswordPage />} />

        {/* ── Giao diện Nhân sự — StaffLayout ── */}
        <Route element={<StaffRoute><StaffLayout /></StaffRoute>}>
          {/* Dashboard */}
          <Route path="/staff/dashboard"        element={<StaffDashboardPage />} />

          {/* Lễ tân — Quản lý lịch hẹn */}
          <Route path="/staff/appointments"     element={<AppointmentListPage />} />
          <Route path="/staff/appointments/new" element={<NewAppointmentPage />} />
          <Route path="/staff/emergency"        element={<StaffPlaceholderPage />} />
          <Route path="/staff/waitlist"         element={<StaffPlaceholderPage />} />
          <Route path="/staff/service-groups"   element={<StaffPlaceholderPage />} />

          {/* Lễ tân — Cấu hình lịch làm việc (read-only view) */}
          <Route path="/staff/shifts"           element={<StaffPlaceholderPage />} />
          <Route path="/staff/schedules"        element={<StaffPlaceholderPage />} />
          <Route path="/staff/doctor-schedule"  element={<DoctorScheduleViewPage />} />
          <Route path="/staff/holidays"         element={<StaffPlaceholderPage />} />
          <Route path="/staff/sms"              element={<StaffSmsPage />} />

          {/* Tiếp đón & Hàng chờ (CN3.5 – CN3.6) */}
          <Route path="/staff/reception"        element={<ReceptionPage />} />

          {/* Bệnh nhân (CN3.1 – CN3.3) */}
          <Route path="/staff/patients"         element={<PatientListPage />} />
          <Route path="/staff/patients/new"     element={<NewPatientPage />} />
          <Route path="/staff/patients/:id"     element={<PatientDetailPage />} />

          {/* Bác sĩ — Khám & Điều trị (UC CN3.7) */}
          <Route path="/staff/treatment"        element={<TreatmentPage />} />
          <Route path="/staff/today-schedule"   element={<TodaySchedulePage />} />
          <Route path="/staff/my-schedule"      element={<DoctorMySchedulePage />} />

          {/* Kế toán — Hóa đơn & Thống kê (UC CN3.8–3.10) */}
          <Route path="/staff/invoices"         element={<InvoicePage />} />
          <Route path="/staff/stats"            element={<StatsPage />} />

          {/* Lương (UC4.3 – Bác sĩ & Admin; UC4.4/4.5/4.6/4.7 – Kế toán) */}
          <Route path="/staff/salary/uc4.3"     element={<DoctorComplexityPage />} />
          <Route path="/staff/salary/uc4.4"     element={<PayslipPage />} />
          <Route path="/staff/salary/uc4.5"     element={<MonthlySalaryReportPage />} />
          <Route path="/staff/salary/uc4.6"     element={<AnnualPersonalReportPage />} />
          <Route path="/staff/salary/uc4.7"     element={<AnnualFullReportPage />} />

          {/* Tài khoản */}
          <Route path="/staff/profile"          element={<StaffPlaceholderPage />} />
          <Route path="/staff/change-password"  element={<ChangePasswordPage />} />
        </Route>

        {/* ── Giao diện Admin — MainLayout ── */}
        <Route element={<AdminRoute><MainLayout /></AdminRoute>}>
          <Route path="/dashboard"        element={<DashboardPage />} />
          <Route path="/users"            element={<UsersPage />} />
          <Route path="/users/:role"      element={<UsersPage />} />
          <Route path="/change-password"  element={<ChangePasswordPage />} />
          <Route path="/logs"             element={<LogsPage />} />
          <Route path="/services"         element={<ServicesPage />} />
          <Route path="/services/groups"  element={<ServicesPage />} />
          <Route path="/pricing"          element={<PricePage />} />
          <Route path="/profile"          element={<ProfilePage />} />
          <Route path="/shifts"           element={<ShiftsPage />} />
          <Route path="/schedules"        element={<SchedulesPage />} />
          <Route path="/holidays"         element={<HolidaysPage />} />
          <Route path="/sms"              element={<SmsPage />} />
          <Route path="/stats"            element={<StatsPage />} />
          <Route path="/invoices"         element={<InvoicePage />} />
          {/* ── UC4: Quản lý lương (Admin) ── */}
          <Route path="/salary/uc4.1" element={<SalaryConfigPage />} />
          <Route path="/salary/uc4.2" element={<ShiftCoefficientPage />} />
          <Route path="/salary/uc4.3" element={<ShiftComplexityAdminPage />} />
          <Route path="/salary/uc4.4" element={<PayslipPage />} />
          <Route path="/salary/uc4.5" element={<MonthlySalaryReportPage />} />
          <Route path="/salary/uc4.6" element={<AnnualPersonalReportPage />} />
          <Route path="/salary/uc4.7" element={<AnnualFullReportPage />} />
          <Route path="/salary"       element={<Navigate to="/salary/uc4.1" replace />} />
        </Route>

        {/* ── Legacy redirect ── */}
        <Route path="/staff-portal" element={
          <StaffRoute><Navigate to="/staff/dashboard" replace /></StaffRoute>
        } />

        {/* ── Fallback ── */}
        <Route path="/" element={
          <ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
