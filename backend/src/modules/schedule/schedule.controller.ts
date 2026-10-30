import { Request, Response } from 'express'
import * as svc from './schedule.service'

const getIp = (req: Request) =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
  req.socket.remoteAddress || ''

export const getWeekSchedules = async (req: Request, res: Response) => {
  try {
    const weekStart = (req.query.weekStart as string) || new Date().toISOString().slice(0, 10)
    res.json(await svc.getWeekSchedules(weekStart))
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const getFormData = async (_req: Request, res: Response) => {
  try { res.json(await svc.getFormData()) }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const createSchedule = async (req: Request, res: Response) => {
  try {
    res.status(201).json(
      await svc.createSchedule(req.body, (req as any).user.id, getIp(req))
    )
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const updateSchedule = async (req: Request, res: Response) => {
  try {
    await svc.updateSchedule(Number(req.params.id), req.body, (req as any).user.id, getIp(req))
    res.json({ message: 'Cập nhật thành công' })
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const deleteSchedule = async (req: Request, res: Response) => {
  try {
    await svc.deleteSchedule(
      Number(req.params.id),
      (req as any).user.id,
      getIp(req),
      req.body?.isOverride === true
    )
    res.json({ message: 'Hủy lịch trực thành công' })
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

// ── Phân công hàng loạt ───────────────────────────────────────

export const previewBatch = async (req: Request, res: Response) => {
  try {
    res.json(await svc.previewScheduleBatch(req.body))
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const createBatch = async (req: Request, res: Response) => {
  try {
    res.status(201).json(
      await svc.createScheduleBatch(req.body, (req as any).user.id, getIp(req))
    )
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}
