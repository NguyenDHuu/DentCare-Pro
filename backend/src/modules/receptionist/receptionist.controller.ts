import { Request, Response } from 'express'
import * as svc from './receptionist.service'

const uid = (req: Request): number => (req as any).user.id

export const getDashboard = async (req: Request, res: Response) => {
  try { res.json(await svc.getDashboard()) }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message }) }
}

export const lookupPatient = async (req: Request, res: Response) => {
  try { res.json(await svc.lookupPatient(String(req.query.phone ?? ''))) }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message }) }
}

export const getServices = async (req: Request, res: Response) => {
  try { res.json(await svc.getBookingServices()) }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message }) }
}

// GET /doctors?serviceId=X&weekStart=YYYY-MM-DD
export const getDoctors = async (req: Request, res: Response) => {
  try {
    const serviceId = Number(req.query.serviceId)
    const weekStart = String(req.query.weekStart ?? new Date().toISOString().slice(0, 10))
    if (!serviceId) throw { status: 400, message: 'serviceId là bắt buộc' }
    res.json(await svc.getDoctorsWeekAvailability(serviceId, weekStart))
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message }) }
}

// GET /doctor-week?doctorId=X&weekStart=YYYY-MM-DD
export const getDoctorWeek = async (req: Request, res: Response) => {
  try {
    const doctorId  = Number(req.query.doctorId)
    const weekStart = String(req.query.weekStart ?? new Date().toISOString().slice(0, 10))
    if (!doctorId) throw { status: 400, message: 'doctorId là bắt buộc' }
    res.json(await svc.getDoctorWeekTimeline(doctorId, weekStart))
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message }) }
}

// GET /slots?doctorId=X&date=YYYY-MM-DD  (still available for simple use)
export const getSlots = async (req: Request, res: Response) => {
  try {
    const doctorId = Number(req.query.doctorId)
    const date     = String(req.query.date ?? new Date().toISOString().slice(0, 10))
    if (!doctorId) throw { status: 400, message: 'doctorId là bắt buộc' }
    res.json(await svc.getDoctorSlots(doctorId, date))
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message }) }
}

export const createAppointment = async (req: Request, res: Response) => {
  try {
    const result = await svc.createAppointment(req.body, uid(req))
    res.status(201).json(result)
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message }) }
}

// ── UC05 – List / detail ──────────────────────────────────────
export const listAppointments = async (req: Request, res: Response) => {
  try {
    res.json(await svc.listAppointments({
      tab:      String(req.query.tab      ?? 'all'),
      status:   String(req.query.status   ?? ''),
      doctorId: req.query.doctorId ? Number(req.query.doctorId) : undefined,
      search:   String(req.query.search   ?? ''),
      page:     Number(req.query.page     ?? 1),
      limit:    Number(req.query.limit    ?? 20),
    }))
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message }) }
}

export const getAppointment = async (req: Request, res: Response) => {
  try { res.json(await svc.getAppointmentById(Number(req.params.id))) }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message }) }
}

// ── UC02 – Update ─────────────────────────────────────────────
export const updateAppointment = async (req: Request, res: Response) => {
  try { res.json(await svc.updateAppointment(Number(req.params.id), req.body, uid(req))) }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message }) }
}

// ── UC04 – Status transition ──────────────────────────────────
export const patchStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.body
    if (!status) return void res.status(400).json({ message: 'status là bắt buộc' })
    res.json(await svc.updateAppointmentStatus(Number(req.params.id), status, uid(req)))
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message }) }
}

// ── UC03 – Cancel ─────────────────────────────────────────────
export const cancelAppointment = async (req: Request, res: Response) => {
  try { res.json(await svc.cancelAppointment(Number(req.params.id), req.body.reason, uid(req))) }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message }) }
}

// ── Doctors dropdown ──────────────────────────────────────────
export const listDoctors = async (req: Request, res: Response) => {
  try { res.json(await svc.getDoctorsList()) }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message }) }
}

// ── Schedule overview (read-only, receptionist) ───────────────
export const getScheduleOverview = async (req: Request, res: Response) => {
  try {
    const weekStart = String(req.query.weekStart ?? new Date().toISOString().slice(0, 10))
    res.json(await svc.getScheduleOverview(weekStart))
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message }) }
}
