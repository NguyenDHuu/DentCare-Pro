import { Router } from 'express'
import * as ctrl from './salary.controller'
import { authenticate, requireRole } from '../../middlewares/auth.middleware'

const router = Router()

const admin    = [authenticate, requireRole('ADMIN')] as const
const readOnly = [authenticate, requireRole('ADMIN', 'ACCOUNTANT')] as const

// ─── Đơn giá giờ (UC4.1a) ────────────────────────────────────
router.get('/hourly-rates/current', ...readOnly, ctrl.getCurrentRate)
router.get('/hourly-rates',         ...readOnly, ctrl.getHourlyRates)
router.post('/hourly-rates',        ...admin,    ctrl.createHourlyRate)

// ─── Lương cố định tháng theo nhân viên (UC4.1b) ─────────────
router.get('/staff',                ...admin,    ctrl.getEligibleStaff)
router.get('/fixed-salaries',       ...readOnly, ctrl.getFixedSalaries)
router.post('/fixed-salaries',      ...admin,    ctrl.createFixedSalary)

// ─── Hệ số ca phức tạp (UC4.3) ───────────────────────────────
const doctorRole = [authenticate, requireRole('DOCTOR')] as const
router.get('/complexity/doctors',  ...readOnly,  ctrl.getDoctorsForFilter)
router.get('/complexity/matrix',   ...readOnly,  ctrl.getComplexityMatrix)
router.get('/complexity/my-cases', ...doctorRole, ctrl.getDoctorComplexityCases)
router.post('/complexity/propose', ...doctorRole, ctrl.proposeComplexity)
router.post('/complexity/save',    ...admin,      ctrl.saveComplexityCases)

// ─── Lập phiếu lương (UC4.4) ─────────────────────────────────
const acctOrAdmin = [authenticate, requireRole('ADMIN', 'ACCOUNTANT')] as const
router.get('/payslip/staff-list',        ...acctOrAdmin, ctrl.getPayslipStaffList)
router.get('/payslip/data',              ...acctOrAdmin, ctrl.getPayslipData)
router.post('/payslip/save',             ...acctOrAdmin, ctrl.savePayslip)
router.post('/payslip/:id/recalc',       ...acctOrAdmin, ctrl.recalcPayslip)
router.post('/payslip/:id/approve',      ...acctOrAdmin, ctrl.approvePayslip)
router.post('/payslip/:id/finalize',     ...acctOrAdmin, ctrl.finalizePayslip)
router.post('/payslip/:id/cancel',       ...acctOrAdmin, ctrl.cancelPayslip)

// ─── Báo cáo lương tháng (UC4.5) ─────────────────────────────
router.get('/report/monthly',      ...readOnly, ctrl.getMonthlySalaryReport)

// ─── Hệ số ca làm việc (UC4.2) ───────────────────────────────
router.get('/shift-coefficients',  ...readOnly, ctrl.getShiftMatrix)
router.post('/shift-coefficients', ...admin,    ctrl.saveShiftMatrix)

// ─── Phụ cấp chung (UC4.1c) ──────────────────────────────────
router.get('/allowances',           ...readOnly, ctrl.getAllowances)
router.post('/allowances',          ...admin,    ctrl.createAllowance)

// ─── Báo cáo lương năm (UC4.6 / UC4.7) ───────────────────────
router.get('/report/staff',         ...readOnly, ctrl.getAllStaffForReport)
router.get('/report/annual/personal', ...readOnly, ctrl.getAnnualPersonalReport)
router.get('/report/annual/full',     ...readOnly, ctrl.getAnnualFullReport)

export default router
