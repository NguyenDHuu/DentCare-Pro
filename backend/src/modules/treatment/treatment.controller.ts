import { Request, Response } from 'express'
import * as svc from './treatment.service'

const uid  = (req: Request): number  => (req as any).user?.userId ?? (req as any).user?.id
const roles = (req: Request): string[] => (req as any).user?.roles ?? []

export const getQueue = async (req: Request, res: Response) => {
  try {
    // Nếu query truyền doctorId thì dùng, nếu không và user là DOCTOR thì tự lọc theo bản thân
    let doctorId: number | undefined = req.query.doctorId ? Number(req.query.doctorId) : undefined
    if (!doctorId && roles(req).includes('DOCTOR')) doctorId = uid(req)
    const queue = await svc.getTreatmentQueue(doctorId)
    res.json(queue)
  } catch (err) { console.error(err); res.status(500).json({ message: 'Lỗi server' }) }
}

export const getOrCreate = async (req: Request, res: Response) => {
  try {
    const result = await svc.getOrCreateDraft(Number(req.params.receptionId), uid(req))
    if ('notFound' in result) return res.status(404).json({ message: 'Không tìm thấy tiếp đón' })
    res.json(result.record)
  } catch (err) { console.error(err); res.status(500).json({ message: 'Lỗi server' }) }
}

export const getRecord = async (req: Request, res: Response) => {
  try {
    const rec = await svc.getRecord(Number(req.params.id))
    if (!rec) return res.status(404).json({ message: 'Không tìm thấy hồ sơ' })
    res.json(rec)
  } catch (err) { console.error(err); res.status(500).json({ message: 'Lỗi server' }) }
}

export const saveDraft = async (req: Request, res: Response) => {
  try {
    const result = await svc.saveDraft(Number(req.params.id), req.body, uid(req))
    if ('notFound'      in result) return res.status(404).json({ message: 'Không tìm thấy hồ sơ' })
    if ('alreadySigned' in result) return res.status(409).json({ message: 'Hồ sơ đã được ký số, không thể sửa' })
    res.json(result.record)
  } catch (err) { console.error(err); res.status(500).json({ message: 'Lỗi server' }) }
}

export const signRecord = async (req: Request, res: Response) => {
  try {
    const result = await svc.signRecord(Number(req.params.id), uid(req))
    if ('notFound'        in result) return res.status(404).json({ message: 'Không tìm thấy hồ sơ' })
    if ('alreadySigned'   in result) return res.status(409).json({ message: 'Hồ sơ đã được ký số' })
    if ('validationError' in result) return res.status(422).json({ message: (result as any).validationError })
    res.json(result.record)
  } catch (err) { console.error(err); res.status(500).json({ message: 'Lỗi server' }) }
}

export const getPatientHistory = async (req: Request, res: Response) => {
  try {
    const history = await svc.getPatientHistory(Number(req.params.patientId))
    res.json(history)
  } catch (err) { console.error(err); res.status(500).json({ message: 'Lỗi server' }) }
}

export const getServices = async (req: Request, res: Response) => {
  try {
    const services = await svc.getActiveServices()
    res.json(services)
  } catch (err) { console.error(err); res.status(500).json({ message: 'Lỗi server' }) }
}
