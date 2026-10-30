import { Request, Response } from 'express'
import * as svc from './patient.service'

export const listPatients = async (req: Request, res: Response) => {
  try {
    const { q, page, limit } = req.query
    const userRoles: string[] = (req as any).user?.roles ?? []
    const includeInactive = userRoles.includes('ADMIN')
    const result = await svc.listPatients({
      q:              String(q  ?? ''),
      page:           Number(page  ?? 1),
      limit:          Number(limit ?? 20),
      includeInactive,
    })
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Lỗi server' })
  }
}

export const getPatient = async (req: Request, res: Response) => {
  try {
    const patient = await svc.getPatient(Number(req.params.id))
    if (!patient) return res.status(404).json({ message: 'Không tìm thấy bệnh nhân' })
    res.json(patient)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Lỗi server' })
  }
}

export const createPatient = async (req: Request, res: Response) => {
  try {
    const userId: number = (req as any).user?.id
    const result = await svc.createPatient(req.body, userId)

    if ('duplicate' in result) {
      const dup = result as { duplicate: { type: string; patient: any } }
      return res.status(409).json({
        message: dup.duplicate.type === 'NATIONAL_ID'
          ? 'Số CCCD đã tồn tại trong hệ thống'
          : 'Số điện thoại đã tồn tại trong hệ thống',
        duplicate: dup.duplicate,
      })
    }

    res.status(201).json((result as any).patient)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Lỗi server' })
  }
}

export const updatePatient = async (req: Request, res: Response) => {
  try {
    const userId: number = (req as any).user?.id
    const result = await svc.updatePatient(Number(req.params.id), req.body, userId)

    if ('notFound' in result)   return res.status(404).json({ message: 'Không tìm thấy bệnh nhân' })
    if ('duplicate' in result)  {
      const dup = result as { duplicate: { type: string; patient: any } }
      return res.status(409).json({
        message: dup.duplicate.type === 'NATIONAL_ID'
          ? 'Số CCCD đã tồn tại trong hệ thống'
          : 'Số điện thoại đã tồn tại trong hệ thống',
        duplicate: dup.duplicate,
      })
    }

    res.json((result as any).patient)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Lỗi server' })
  }
}

export const getPatientAppointments = async (req: Request, res: Response) => {
  try {
    const result = await svc.getPatientAppointments(Number(req.params.id))
    if (result === null) return res.status(404).json({ message: 'Không tìm thấy bệnh nhân' })
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Lỗi server' })
  }
}

export const deactivatePatient = async (req: Request, res: Response) => {
  try {
    const userId: number = (req as any).user?.id
    const result = await svc.deactivatePatient(Number(req.params.id), userId)

    if ('notFound'       in result) return res.status(404).json({ message: 'Không tìm thấy bệnh nhân' })
    if ('alreadyInactive' in result) return res.status(400).json({ message: 'Hồ sơ đã bị vô hiệu hóa trước đó' })

    res.json({ message: 'Đã vô hiệu hóa hồ sơ bệnh nhân' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Lỗi server' })
  }
}
