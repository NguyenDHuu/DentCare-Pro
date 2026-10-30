import { Request, Response } from 'express'
import * as svc from './doctor.service'

const uid = (req: Request): number =>
  ((req as any).user?.userId ?? (req as any).user?.id) as number

function weekStartParam(req: Request): string {
  const ws = req.query.weekStart as string
  if (ws && /^\d{4}-\d{2}-\d{2}$/.test(ws)) return ws
  const d   = new Date()
  const dow = d.getDay()
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}

export const getMySchedule = async (req: Request, res: Response) => {
  try {
    res.json(await svc.getMySchedule(uid(req), weekStartParam(req)))
  } catch (err: any) {
    res.status(err.status ?? 500).json({ message: err.message ?? 'Lỗi server' })
  }
}

export const getGroupSchedule = async (req: Request, res: Response) => {
  try {
    res.json(await svc.getGroupSchedule(uid(req), weekStartParam(req)))
  } catch (err: any) {
    res.status(err.status ?? 500).json({ message: err.message ?? 'Lỗi server' })
  }
}

export const listMyAppointments = async (req: Request, res: Response) => {
  try {
    const data = await svc.listMyAppointments(uid(req), {
      view:   (req.query.view as svc.AptView) ?? 'day',
      date:   req.query.date   as string | undefined,
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      page:   req.query.page   ? Number(req.query.page)  : undefined,
      limit:  req.query.limit  ? Number(req.query.limit) : undefined,
    })
    res.json(data)
  } catch (err: any) {
    res.status(err.status ?? 500).json({ message: err.message ?? 'Lỗi server' })
  }
}

export const getTodayReceptions = async (req: Request, res: Response) => {
  try {
    res.json(await svc.getTodayReceptions(uid(req)))
  } catch (err: any) {
    res.status(err.status ?? 500).json({ message: err.message ?? 'Lỗi server' })
  }
}

export const patchMyAppointmentStatus = async (req: Request, res: Response) => {
  const id        = Number(req.params.id)
  const newStatus = req.body.status as string
  const doctorId  = uid(req)
  try {
    // Verify this appointment belongs to the doctor
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    const apt = await prisma.appointment.findUnique({ where: { id }, select: { doctorId: true } })
    if (!apt) return res.status(404).json({ message: 'Lịch hẹn không tồn tại' })
    if (apt.doctorId !== doctorId) return res.status(403).json({ message: 'Không có quyền cập nhật lịch hẹn này' })

    const updated = await svc.patchStatus(id, newStatus, doctorId)
    res.json(updated)
  } catch (err: any) {
    res.status(err.status ?? 500).json({ message: err.message ?? 'Lỗi server' })
  }
}
