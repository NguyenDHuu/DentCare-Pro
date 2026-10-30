import { Request, Response } from 'express'
import * as svc from './sms.service'

const getIp = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
  req.socket.remoteAddress ||
  'unknown'
const uid = (req: Request): number => (req as any).user.id

export const getConfig = async (req: Request, res: Response) => {
  try { res.json(await svc.getConfig()) }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message }) }
}

export const updateConfig = async (req: Request, res: Response) => {
  try {
    await svc.updateConfig(req.body, uid(req), getIp(req))
    res.json({ message: 'Lưu cấu hình thành công' })
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message }) }
}

export const updateTemplate = async (req: Request, res: Response) => {
  try {
    await svc.updateTemplate(String(req.params.type), req.body, uid(req), getIp(req))
    res.json({ message: 'Cập nhật mẫu SMS thành công' })
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message }) }
}

export const getStats = async (req: Request, res: Response) => {
  try { res.json(await svc.getStats()) }
  catch (e: any) { res.status(e.status || 500).json({ message: e.message }) }
}

export const getLogs = async (req: Request, res: Response) => {
  try {
    const { page, limit, type, status, phone, recipientName, dateFrom, dateTo } = req.query as Record<string, string | undefined>
    res.json(await svc.getLogs({
      page:          page   ? Number(page)  : undefined,
      limit:         limit  ? Number(limit) : undefined,
      type:          type          || undefined,
      status:        status        || undefined,
      phone:         phone         || undefined,
      recipientName: recipientName || undefined,
      dateFrom:      dateFrom      || undefined,
      dateTo:        dateTo        || undefined,
    }))
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message }) }
}

export const sendTest = async (req: Request, res: Response) => {
  try {
    const result = await svc.sendTestSms(req.body, uid(req), getIp(req))
    res.status(201).json(result)
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message }) }
}
