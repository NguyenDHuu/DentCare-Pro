import { Request, Response } from 'express'
import * as svc from './holiday.service'

const getIp = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
  req.socket.remoteAddress ||
  'unknown'

const adminId = (req: Request): number => (req as any).user.id

export const getHolidays = async (req: Request, res: Response) => {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined
    res.json(await svc.getHolidays(year))
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' })
  }
}

export const createHoliday = async (req: Request, res: Response) => {
  try {
    const data = await svc.createHoliday(req.body, adminId(req), getIp(req))
    res.status(201).json(data)
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' })
  }
}

export const updateHoliday = async (req: Request, res: Response) => {
  try {
    await svc.updateHoliday(Number(req.params.id), req.body, adminId(req), getIp(req))
    res.json({ message: 'Cập nhật thành công' })
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' })
  }
}

export const deleteHoliday = async (req: Request, res: Response) => {
  try {
    await svc.deleteHoliday(Number(req.params.id), adminId(req), getIp(req))
    res.json({ message: 'Đã xóa ngày nghỉ' })
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' })
  }
}
