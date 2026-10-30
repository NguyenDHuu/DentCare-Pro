import { Request, Response } from 'express'
import * as svc from './salary.service'

const getIp = (req: Request) =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
  req.socket.remoteAddress || ''

/** Lấy userId từ JWT — hỗ trợ cả payload dùng userId lẫn id */
const uid = (req: Request): number =>
  ((req as any).user?.userId ?? (req as any).user?.id) as number

export const getHourlyRates = async (req: Request, res: Response) => {
  try { res.json(await svc.getHourlyRates()) }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const getCurrentRate = async (req: Request, res: Response) => {
  try { res.json(await svc.getCurrentHourlyRate()) }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const createHourlyRate = async (req: Request, res: Response) => {
  try {
    res.status(201).json(await svc.createHourlyRate(req.body, uid(req), getIp(req)))
  }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const getEligibleStaff = async (req: Request, res: Response) => {
  try { res.json(await svc.getEligibleStaff()) }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const getFixedSalaries = async (req: Request, res: Response) => {
  try { res.json(await svc.getFixedSalaries()) }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const createFixedSalary = async (req: Request, res: Response) => {
  try {
    res.status(201).json(await svc.createFixedSalary(req.body, uid(req), getIp(req)))
  }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const getShiftMatrix = async (req: Request, res: Response) => {
  try { res.json(await svc.getShiftMatrix()) }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const saveShiftMatrix = async (req: Request, res: Response) => {
  try {
    res.json(await svc.saveShiftMatrix(req.body, uid(req), getIp(req)))
  }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const getMonthlySalaryReport = async (req: Request, res: Response) => {
  try {
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7)
    res.json(await svc.getMonthlySalaryReport(month))
  }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const getAllowances = async (req: Request, res: Response) => {
  try { res.json(await svc.getAllowances()) }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const createAllowance = async (req: Request, res: Response) => {
  try {
    res.status(201).json(await svc.createAllowance(req.body, uid(req), getIp(req)))
  }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

// ─── UC4.3 ────────────────────────────────────────────────────

export const getDoctorsForFilter = async (req: Request, res: Response) => {
  try { res.json(await svc.getDoctorsForFilter()) }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const getComplexityMatrix = async (req: Request, res: Response) => {
  try {
    const month    = (req.query.month as string) || new Date().toISOString().slice(0, 7)
    const doctorId = req.query.doctorId ? parseInt(req.query.doctorId as string) : undefined
    res.json(await svc.getComplexityMatrix(month, doctorId))
  }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const getDoctorComplexityCases = async (req: Request, res: Response) => {
  try {
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7)
    res.json(await svc.getDoctorComplexityCases(uid(req), month))
  }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const proposeComplexity = async (req: Request, res: Response) => {
  try {
    const { receptionId, proposedCoeff, proposedReason } = req.body
    res.json(await svc.proposeComplexity(receptionId, proposedCoeff, proposedReason ?? null, uid(req)))
  }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const saveComplexityCases = async (req: Request, res: Response) => {
  try {
    res.json(await svc.saveComplexityCases(req.body, uid(req), getIp(req)))
  }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

// ─── UC4.4 – Lập phiếu lương ─────────────────────────────────

export const getPayslipStaffList = async (req: Request, res: Response) => {
  try { res.json(await svc.getPayslipStaffList()) }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const getPayslipData = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.query.userId as string)
    const month  = (req.query.month as string) || new Date().toISOString().slice(0, 7)
    if (isNaN(userId)) return res.status(400).json({ message: 'userId không hợp lệ' })
    res.json(await svc.getPayslipData(userId, month))
  }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const savePayslip = async (req: Request, res: Response) => {
  try {
    const { userId, month, allowance, deduction, note } = req.body
    res.json(await svc.savePayslip(
      Number(userId), month,
      Number(allowance ?? 0), Number(deduction ?? 0),
      note ?? null, uid(req), getIp(req),
    ))
  }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const recalcPayslip = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id))
    res.json(await svc.recalcPayslip(id, uid(req), getIp(req)))
  }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const approvePayslip = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id))
    res.json(await svc.approvePayslip(id, uid(req), getIp(req)))
  }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const finalizePayslip = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id))
    res.json(await svc.finalizePayslip(id, uid(req), getIp(req)))
  }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const cancelPayslip = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id))
    res.json(await svc.cancelPayslip(id, uid(req), getIp(req)))
  }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

// ─── UC4.6 / UC4.7 ───────────────────────────────────────────

export const getAllStaffForReport = async (req: Request, res: Response) => {
  try { res.json(await svc.getAllStaffForReport()) }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const getAnnualPersonalReport = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.query.userId as string)
    const year   = parseInt(req.query.year   as string) || new Date().getFullYear()
    if (isNaN(userId)) return res.status(400).json({ message: 'userId không hợp lệ' })
    res.json(await svc.getAnnualPersonalReport(userId, year))
  }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const getAnnualFullReport = async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear()
    res.json(await svc.getAnnualFullReport(year))
  }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}
