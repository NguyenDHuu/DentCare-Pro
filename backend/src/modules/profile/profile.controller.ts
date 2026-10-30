import { Request, Response } from 'express'
import * as svc from './profile.service'

export const getMyProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId
    const data = await svc.getMyProfile(userId)
    res.json(data)
  } catch (e: any) {
    if (e.message === 'USER_NOT_FOUND')
      return res.status(404).json({ message: 'Không tìm thấy tài khoản' })
    res.status(500).json({ message: 'Lỗi server' })
  }
}

export const updateMyProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId
    const ip = req.ip ?? ''
    await svc.updateMyProfile(userId, req.body, ip)
    res.json({ message: 'Cập nhật hồ sơ thành công' })
  } catch (e: any) {
    if (e.message === 'USER_NOT_FOUND')
      return res.status(404).json({ message: 'Không tìm thấy tài khoản' })
    res.status(500).json({ message: 'Lỗi server' })
  }
}
