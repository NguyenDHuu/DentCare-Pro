import { Request, Response } from 'express'
import * as svc from './reception.service'

export const getQueue = async (req: Request, res: Response) => {
  try {
    const result = await svc.getTodayQueue()
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Lỗi server' })
  }
}

export const searchPatients = async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q ?? '')
    const results = await svc.searchPatientsForCheckin(q)
    res.json(results)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Lỗi server' })
  }
}

export const getDoctors = async (req: Request, res: Response) => {
  try {
    const doctors = await svc.getAvailableDoctors()
    res.json(doctors)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Lỗi server' })
  }
}

export const getChairs = async (req: Request, res: Response) => {
  try {
    const chairs = await svc.getChairStatus()
    res.json(chairs)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Lỗi server' })
  }
}

export const checkIn = async (req: Request, res: Response) => {
  try {
    const userId: number = (req as any).user?.userId ?? (req as any).user?.id
    const result = await svc.checkIn(req.body, userId)

    if ('notFound'  in result) return res.status(404).json({ message: 'Không tìm thấy bệnh nhân' })
    if ('duplicate' in result) {
      const dup = result as { duplicate: { reception: any } }
      return res.status(409).json({
        message: 'Bệnh nhân đã có lượt check-in đang hoạt động hôm nay',
        reception: dup.duplicate.reception,
      })
    }

    res.status(201).json(result.reception)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Lỗi server' })
  }
}

export const updateStatus = async (req: Request, res: Response) => {
  try {
    const userId: number = (req as any).user?.userId ?? (req as any).user?.id
    const id = Number(req.params.id)
    const result = await svc.updateStatus(id, req.body, userId)

    if ('notFound'  in result) return res.status(404).json({ message: 'Không tìm thấy bản ghi tiếp đón' })
    if ('conflict'  in result) return res.status(409).json({ message: result.conflict })
    res.json(result.reception)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Lỗi server' })
  }
}

export const assignResources = async (req: Request, res: Response) => {
  try {
    const userId: number = (req as any).user?.userId ?? (req as any).user?.id
    const id = Number(req.params.id)
    const { chairId, doctorId } = req.body
    const result = await svc.assignResources(id, chairId ?? null, doctorId ?? null, userId)

    if ('notFound' in result) return res.status(404).json({ message: 'Không tìm thấy bản ghi tiếp đón' })
    res.json(result.reception)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Lỗi server' })
  }
}

export const getReception = async (req: Request, res: Response) => {
  try {
    const rec = await svc.getReception(Number(req.params.id))
    if (!rec) return res.status(404).json({ message: 'Không tìm thấy bản ghi tiếp đón' })
    res.json(rec)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Lỗi server' })
  }
}

export const getPatientHistory = async (req: Request, res: Response) => {
  try {
    const history = await svc.getPatientReceptionHistory(Number(req.params.patientId))
    res.json(history)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Lỗi server' })
  }
}

export const changeClassification = async (req: Request, res: Response) => {
  try {
    const userId: number   = (req as any).user?.id
    const userRoles: string[] = (req as any).user?.roles ?? []
    const userRole = userRoles[0] ?? 'RECEPTIONIST'
    const { classification, reason } = req.body
    const patientId = Number(req.params.patientId)

    const result = await svc.changeClassification(patientId, classification, reason ?? '', userId, userRole)

    if ('notFound'        in result) return res.status(404).json({ message: 'Không tìm thấy bệnh nhân' })
    if ('forbidden'       in result) return res.status(403).json({ message: result.forbidden })
    if ('validationError' in result) return res.status(422).json({ message: result.validationError })

    res.json(result.patient)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Lỗi server' })
  }
}
