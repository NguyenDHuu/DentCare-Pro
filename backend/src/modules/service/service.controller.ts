import { Request, Response } from 'express'
import * as svc from './service.service'

const getIp = (req: Request) =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
  req.socket.remoteAddress || ''

// ─── UC08 ────────────────────────────────────────────────────

export const getDoctors = async (_req: Request, res: Response) => {
  try {
    res.json(await svc.getDoctors())
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const getServiceGroups = async (req: Request, res: Response) => {
  try {
    res.json(await svc.getServiceGroups(req.query.search as string | undefined))
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const createServiceGroup = async (req: Request, res: Response) => {
  try {
    res.status(201).json(await svc.createServiceGroup(req.body, (req as any).user.id, getIp(req)))
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const updateServiceGroup = async (req: Request, res: Response) => {
  try {
    await svc.updateServiceGroup(Number(req.params.id), req.body, (req as any).user.id, getIp(req))
    res.json({ message: 'Cập nhật thành công' })
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const deleteServiceGroup = async (req: Request, res: Response) => {
  try {
    await svc.deleteServiceGroup(Number(req.params.id), (req as any).user.id, getIp(req))
    res.json({ message: 'Xóa thành công' })
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const getGroupServices = async (req: Request, res: Response) => {
  try {
    res.json(await svc.getGroupServices(Number(req.params.id)))
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

// ─── UC09 ────────────────────────────────────────────────────

export const getServices = async (req: Request, res: Response) => {
  try {
    const { search, groupId, status } = req.query
    res.json(await svc.getServices({
      search: search as string | undefined,
      groupId: groupId ? Number(groupId) : undefined,
      status: status as string | undefined,
    }))
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const getServiceById = async (req: Request, res: Response) => {
  try {
    res.json(await svc.getServiceById(Number(req.params.id)))
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const createService = async (req: Request, res: Response) => {
  try {
    res.status(201).json(await svc.createService(req.body, (req as any).user.id, getIp(req)))
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const updateService = async (req: Request, res: Response) => {
  try {
    await svc.updateService(Number(req.params.id), req.body, (req as any).user.id, getIp(req))
    res.json({ message: 'Cập nhật thành công' })
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const deleteService = async (req: Request, res: Response) => {
  try {
    await svc.deleteService(Number(req.params.id), (req as any).user.id, getIp(req))
    res.json({ message: 'Xóa dịch vụ thành công' })
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}

export const changeServiceStatus = async (req: Request, res: Response) => {
  try {
    await svc.changeServiceStatus(Number(req.params.id), req.body.status, (req as any).user.id, getIp(req))
    res.json({ message: 'Đổi trạng thái thành công' })
  } catch (e: any) { res.status(e.status || 500).json({ message: e.message || 'Lỗi hệ thống' }) }
}
