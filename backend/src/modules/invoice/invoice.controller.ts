import { Request, Response } from 'express'
import * as svc from './invoice.service'

function uid(req: Request): number {
  return (req as any).user?.userId ?? (req as any).user?.id ?? 0
}

export const listInvoices = async (req: Request, res: Response) => {
  const { status, search, page, limit, patientId } = req.query
  const result = await svc.listInvoices({
    status:    status    as string | undefined,
    search:    search    as string | undefined,
    patientId: patientId ? Number(patientId) : undefined,
    page:      page      ? Number(page)   : 1,
    limit:     limit     ? Number(limit)  : 50,
  })
  res.json(result)
}

export const getInvoice = async (req: Request, res: Response) => {
  const id   = Number(req.params.id)
  const data = await svc.getInvoice(id)
  if (!data) return res.status(404).json({ message: 'Không tìm thấy hóa đơn' })
  res.json(data)
}

export const applyDiscount = async (req: Request, res: Response) => {
  const id   = Number(req.params.id)
  const { discountPct, voucherCode, discountAmount } = req.body
  const result = await svc.applyDiscount(id, { discountPct: discountPct ?? 0, voucherCode, discountAmount })
  if (result.notFound)  return res.status(404).json({ message: 'Không tìm thấy hóa đơn' })
  if (result.forbidden) return res.status(403).json({ message: result.forbidden })
  res.json(result.invoice)
}

export const payInvoice = async (req: Request, res: Response) => {
  const id                          = Number(req.params.id)
  const { paymentMethod, paymentNote } = req.body
  if (!paymentMethod) return res.status(400).json({ message: 'Thiếu phương thức thanh toán' })
  const result = await svc.payInvoice(id, { paymentMethod, paymentNote, confirmedBy: uid(req) })
  if (result.notFound)  return res.status(404).json({ message: 'Không tìm thấy hóa đơn' })
  if (result.forbidden) return res.status(403).json({ message: result.forbidden })
  res.json(result.invoice)
}

export const cancelInvoice = async (req: Request, res: Response) => {
  const id     = Number(req.params.id)
  const { reason } = req.body
  const result = await svc.cancelInvoice(id, uid(req), reason ?? 'Không rõ lý do')
  if (result.notFound)  return res.status(404).json({ message: 'Không tìm thấy hóa đơn' })
  if (result.forbidden) return res.status(403).json({ message: result.forbidden })
  res.json(result.invoice)
}

export const getStats = async (req: Request, res: Response) => {
  const period = (req.query.period as any) || 'WEEK'
  const data   = await svc.getStats(period)
  res.json(data)
}
