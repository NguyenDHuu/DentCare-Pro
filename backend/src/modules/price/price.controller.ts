import { Request, Response } from 'express'
import * as svc from './price.service'

const getIp = (req: Request) =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
  req.socket.remoteAddress || ''

export const getPrices = async (req: Request, res: Response) => {
  try {
    const { search, groupId, status } = req.query
    res.json(await svc.getPrices({
      search:  search  as string | undefined,
      groupId: groupId ? Number(groupId) : undefined,
      status:  status  as string | undefined,
    }))
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const getPriceHistory = async (req: Request, res: Response) => {
  try {
    res.json(await svc.getPriceHistory(Number(req.params.serviceId)))
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const createPrice = async (req: Request, res: Response) => {
  try {
    res.status(201).json(await svc.createPrice(req.body, (req as any).user.id, getIp(req)))
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const updatePrice = async (req: Request, res: Response) => {
  try {
    await svc.updatePrice(Number(req.params.id), req.body, (req as any).user.id, getIp(req))
    res.json({ message: 'Cập nhật giá thành công' })
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}
