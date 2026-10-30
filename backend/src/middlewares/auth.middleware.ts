import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/jwt'

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ message: 'Chưa đăng nhập' })

  try {
    const payload = verifyToken(token)
    ;(req as any).user = payload
    next()
  } catch {
    res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' })
  }
}

export const requireRole = (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    const userRoles: string[] = (req as any).user?.roles || []
    if (!roles.some(r => userRoles.includes(r)))
      return res.status(403).json({ message: 'Không có quyền truy cập' })
    next()
  }