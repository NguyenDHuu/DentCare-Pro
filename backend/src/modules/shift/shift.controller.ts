import { Request, Response } from 'express'
import * as svc from './shift.service'

const getIp = (req: Request) =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
  req.socket.remoteAddress || ''

export const getShifts = async (_req: Request, res: Response) => {
  try {
    res.json(await svc.getShifts())
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' })
  }
}

export const createShift = async (req: Request, res: Response) => {
  try {
    res.status(201).json(
      await svc.createShift(req.body, (req as any).user.id, getIp(req))
    )
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' })
  }
}

export const updateShift = async (req: Request, res: Response) => {
  try {
    await svc.updateShift(
      Number(req.params.id), req.body, (req as any).user.id, getIp(req)
    )
    res.json({ message: 'Cập nhật ca thành công' })
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' })
  }
}

export const deleteShift = async (req: Request, res: Response) => {
  try {
    await svc.deleteShift(
      Number(req.params.id), (req as any).user.id, getIp(req)
    )
    res.json({ message: 'Xóa ca thành công' })
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' })
  }
}

export const toggleShift = async (req: Request, res: Response) => {
  try {
    res.json(
      await svc.toggleShift(
        Number(req.params.id), (req as any).user.id, getIp(req)
      )
    )
  } catch (e: any) {
    res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' })
  }
}
