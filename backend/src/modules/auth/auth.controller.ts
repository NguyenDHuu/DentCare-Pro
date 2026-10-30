import { Request, Response } from 'express'
import * as authService from './auth.service'
import { sendPasswordResetEmail } from '../../utils/email'

const passwordPolicy = (pw: string) =>
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(pw)

const parseIdParam = (id: string | string[]) =>
  parseInt(Array.isArray(id) ? id[0] : id, 10)

const getIp = (req: Request) =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || ''

// UC01
export const checkSetup = async (_: Request, res: Response) => {
  const exists = await authService.checkAdminExists()
  res.json({ initialized: exists })
}

export const setupAdmin = async (req: Request, res: Response) => {
  try {
    const exists = await authService.checkAdminExists()
    if (exists) return res.status(403).json({ message: 'Hệ thống đã được khởi tạo' })

    const { fullName, username, email, password, confirmPassword } = req.body

    if (password !== confirmPassword)
      return res.status(400).json({ message: 'Mật khẩu xác nhận không khớp' })

    if (!passwordPolicy(password))
      return res.status(400).json({ message: 'Mật khẩu không đạt chính sách bảo mật' })

    await authService.setupAdmin({ fullName, username, email, password }, getIp(req))
    res.status(201).json({ message: 'Tạo tài khoản Admin thành công' })
  } catch (err: any) {
    if (err.code === 'P2002')
      return res.status(400).json({ message: 'Tên đăng nhập hoặc email đã tồn tại' })
    res.status(500).json({ message: 'Lỗi hệ thống' })
  }
}

// Đăng ký Admin tự do
export const registerAdmin = async (req: Request, res: Response) => {
  try {
    const { fullName, username, email, password, confirmPassword } = req.body

    if (password !== confirmPassword)
      return res.status(400).json({ message: 'Mật khẩu xác nhận không khớp' })

    if (!passwordPolicy(password))
      return res.status(400).json({ message: 'Mật khẩu không đạt chính sách bảo mật' })

    await authService.registerAdmin({ fullName, username, email, password }, getIp(req))
    res.status(201).json({ message: 'Đăng ký tài khoản Admin thành công' })
  } catch (err: any) {
    if (err.code === 'P2002')
      return res.status(400).json({ message: 'Tên đăng nhập hoặc email đã tồn tại' })
    res.status(500).json({ message: 'Lỗi hệ thống' })
  }
}

// Logout
export const logout = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId
    if (userId) {
      await authService.logoutUser(userId)
    }
    res.json({ message: 'Đăng xuất thành công' })
  } catch {
    res.json({ message: 'Đăng xuất thành công' })
  }
}

// UC02
export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body
    const result = await authService.login(username, password, getIp(req))
    res.json(result)
  } catch (err: any) {
    const messages: Record<string, [number, string]> = {
      INVALID_CREDENTIALS: [401, 'Tên đăng nhập hoặc mật khẩu không đúng'],
      ACCOUNT_LOCKED:      [403, 'Tài khoản bị khóa tạm thời 15 phút'],
      ACCOUNT_DISABLED:    [403, 'Tài khoản bị vô hiệu hóa, liên hệ Admin'],
    }
    const [status, message] = messages[err.message] || [500, 'Lỗi hệ thống']
    res.status(status).json({ message })
  }
}

// UC03
export const changePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body
    const userId = (req as any).user.userId

    if (newPassword !== confirmPassword)
      return res.status(400).json({ message: 'Mật khẩu xác nhận không khớp' })

    if (!passwordPolicy(newPassword))
      return res.status(400).json({ message: 'Mật khẩu không đạt chính sách bảo mật' })

    await authService.changePassword(userId, currentPassword, newPassword, getIp(req))
    res.json({ message: 'Đổi mật khẩu thành công, vui lòng đăng nhập lại' })
  } catch (err: any) {
    const messages: Record<string, [number, string]> = {
      WRONG_PASSWORD: [400, 'Mật khẩu hiện tại không đúng'],
      SAME_PASSWORD:  [400, 'Mật khẩu mới phải khác mật khẩu cũ'],
    }
    const [status, message] = messages[err.message] || [500, 'Lỗi hệ thống']
    res.status(status).json({ message })
  }
}

// UC04
export const requestReset = async (req: Request, res: Response) => {
  try {
    const { email } = req.body
    const result = await authService.requestPasswordReset(email, getIp(req))
    if (result) {
      await sendPasswordResetEmail(result.email, result.token)
    }
    res.json({ message: 'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.' })
  } catch (err: any) {
    if (err.message === 'RATE_LIMIT')
      return res.status(429).json({ message: 'Quá nhiều yêu cầu, thử lại sau 15 phút' })
    console.error('[requestReset ERROR]', err)
    res.status(500).json({ message: 'Lỗi hệ thống' })
  }
}

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword, confirmPassword } = req.body

    if (newPassword !== confirmPassword)
      return res.status(400).json({ message: 'Mật khẩu xác nhận không khớp' })

    if (!passwordPolicy(newPassword))
      return res.status(400).json({ message: 'Mật khẩu không đạt chính sách bảo mật' })

    await authService.resetPassword(token, newPassword)
    res.json({ message: 'Đặt lại mật khẩu thành công' })
  } catch (err: any) {
    const messages: Record<string, [number, string]> = {
      INVALID_TOKEN: [400, 'Đường dẫn không hợp lệ'],
      TOKEN_USED:    [400, 'Đường dẫn đã được sử dụng'],
      TOKEN_EXPIRED: [400, 'Đường dẫn đã hết hạn, vui lòng yêu cầu lại'],
    }
    const [status, message] = messages[err.message] || [500, 'Lỗi hệ thống']
    res.status(status).json({ message })
  }
}

// UC05 A: Tạo tài khoản nhân sự
export const createStaff = async (req: Request, res: Response) => {
  try {
    const { fullName, username, email, password, roles } = req.body
    const operatorId = (req as any).user.userId
    const ip = getIp(req)

    if (!passwordPolicy(password))
      return res.status(400).json({ message: 'Mật khẩu không đạt chính sách bảo mật' })

    const user = await authService.createStaff({ fullName, username, email, password, roles }, operatorId, ip)
    res.status(201).json({ message: 'Tạo tài khoản nhân sự thành công', userId: user.id })
  } catch (err: any) {
    const messages: Record<string, [number, string]> = {
      NO_ROLE:      [400, 'Phải chọn ít nhất một vai trò'],
      INVALID_ROLE: [400, 'Vai trò không hợp lệ (chỉ chấp nhận ADMIN, DOCTOR, RECEPTIONIST, ACCOUNTANT)'],
    }
    if (err.code === 'P2002')
      return res.status(400).json({ message: 'Tên đăng nhập hoặc email đã tồn tại' })
    const [status, message] = messages[err.message] || [500, 'Lỗi hệ thống']
    res.status(status).json({ message })
  }
}

// UC05 C: Cập nhật vai trò nhân sự
export const updateUserRoles = async (req: Request, res: Response) => {
  try {
    const targetId = parseIdParam(req.params.id)
    const { roles } = req.body
    const operatorId = (req as any).user.userId
    const ip = getIp(req)

    await authService.updateUserRoles(targetId, roles, operatorId, ip)
    res.json({ message: 'Cập nhật vai trò thành công' })
  } catch (err: any) {
    const messages: Record<string, [number, string]> = {
      NO_ROLE:        [400, 'Phải có ít nhất một vai trò'],
      INVALID_ROLE:   [400, 'Vai trò không hợp lệ'],
      USER_NOT_FOUND: [404, 'Không tìm thấy tài khoản'],
      LAST_ADMIN:     [400, 'Phải có ít nhất một Admin đang hoạt động trong hệ thống'],
    }
    const [status, message] = messages[err.message] || [500, 'Lỗi hệ thống']
    res.status(status).json({ message })
  }
}

// UC06: Lấy thông tin chi tiết user
export const getUserById = async (req: Request, res: Response) => {
  try {
    const id = parseIdParam(req.params.id)
    const user = await authService.getUserById(id)
    if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản' })
    res.json(user)
  } catch {
    res.status(500).json({ message: 'Lỗi hệ thống' })
  }
}

// UC06 A: Cập nhật thông tin cá nhân
export const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const targetId = parseIdParam(req.params.id)
    const { fullName, email, phone, address, avatar } = req.body
    const operatorId = (req as any).user.userId
    const ip = getIp(req)

    await authService.updateUserProfile(targetId, { fullName, email, phone, address, avatar }, operatorId, ip)
    res.json({ message: 'Cập nhật thông tin thành công' })
  } catch (err: any) {
    if (err.code === 'P2002')
      return res.status(400).json({ message: 'Email đã tồn tại ở tài khoản khác' })
    const [status, message] = err.message === 'USER_NOT_FOUND'
      ? [404, 'Không tìm thấy tài khoản'] : [500, 'Lỗi hệ thống']
    res.status(status).json({ message })
  }
}

// UC06 B: Admin đặt lại mật khẩu cho nhân sự
export const adminResetPassword = async (req: Request, res: Response) => {
  try {
    const targetId = parseIdParam(req.params.id)
    const { newPassword } = req.body
    const operatorId = (req as any).user.userId
    const ip = getIp(req)

    if (!passwordPolicy(newPassword))
      return res.status(400).json({ message: 'Mật khẩu không đạt chính sách bảo mật' })

    await authService.adminResetPassword(targetId, newPassword, operatorId, ip)
    res.json({ message: 'Đặt lại mật khẩu thành công, mật khẩu mới đã gửi qua email' })
  } catch (err: any) {
    const messages: Record<string, [number, string]> = {
      USER_NOT_FOUND:    [404, 'Không tìm thấy tài khoản'],
      CANNOT_SELF_RESET: [400, 'Dùng chức năng Đổi mật khẩu cho tài khoản của chính mình'],
    }
    const [status, message] = messages[err.message] || [500, 'Lỗi hệ thống']
    res.status(status).json({ message })
  }
}

// UC06: Gửi email tùy chỉnh
export const sendEmailToUser = async (req: Request, res: Response) => {
  try {
    const targetId = parseIdParam(req.params.id)
    const { subject, content } = req.body
    const operatorId = (req as any).user.userId
    const ip = getIp(req)

    const files = (req.files as Express.Multer.File[]) ?? []
    const attachments = files.map(f => ({
      filename: Buffer.from(f.originalname, 'latin1').toString('utf8'),
      buffer: f.buffer,
      mimetype: f.mimetype,
    }))

    await authService.sendEmailToUser(targetId, subject, content, attachments, operatorId, ip)
    res.json({ message: 'Gửi email thành công' })
  } catch (err: any) {
    const [status, message] = err.message === 'USER_NOT_FOUND'
      ? [404, 'Không tìm thấy tài khoản'] : [500, 'Lỗi hệ thống']
    res.status(status).json({ message })
  }
}

// UC07: Nhật ký hoạt động
export const getLogs = async (req: Request, res: Response) => {
  try {
    const { search, action, status, module, startDate, endDate, page, limit } = req.query as Record<string, string>
    const result = await authService.getLogs({
      search, action, status, module, startDate, endDate,
      page:  page  ? parseInt(page,  10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    })
    res.json(result)
  } catch {
    res.status(500).json({ message: 'Lỗi hệ thống' })
  }
}

export const exportLogs = async (req: Request, res: Response) => {
  try {
    const { search, action, status, module, startDate, endDate } = req.query as Record<string, string>
    const csv = await authService.exportLogsCSV({ search, action, status, module, startDate, endDate })
    const filename = `nhat-ky-${new Date().toISOString().slice(0, 10)}.csv`
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send('﻿' + csv) // BOM cho Excel đọc được UTF-8
  } catch {
    res.status(500).json({ message: 'Lỗi xuất file' })
  }
}

// Dashboard stats
export const getDashboardStats = async (_: Request, res: Response) => {
  try {
    const stats = await authService.getDashboardStats()
    res.json(stats)
  } catch {
    res.status(500).json({ message: 'Lỗi hệ thống' })
  }
}


// Danh sách tài khoản
export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await authService.getUsers()
    res.json(users)
  } catch {
    res.status(500).json({ message: 'Lỗi hệ thống' })
  }
}

// Khóa / Mở tài khoản
export const toggleUserStatus = async (req: Request, res: Response) => {
  try {
    const targetId = parseIdParam(req.params.id)
    const { isActive, reason } = req.body
    const operatorId = (req as any).user.userId
    const ip = getIp(req)

    await authService.toggleUserStatus(targetId, isActive, reason, operatorId, ip)
    res.json({ message: isActive ? 'Đã mở tài khoản' : 'Đã khóa tài khoản' })
  } catch (err: any) {
    const messages: Record<string, [number, string]> = {
      USER_NOT_FOUND:   [404, 'Không tìm thấy tài khoản'],
      CANNOT_SELF_LOCK: [400, 'Không thể khóa tài khoản của chính mình'],
      LAST_ADMIN:       [400, 'Phải có ít nhất một Admin đang hoạt động trong hệ thống'],
    }
    const [status, message] = messages[err.message] || [500, 'Lỗi hệ thống']
    res.status(status).json({ message })
  }
}

// Bằng cấp & Chứng chỉ

export const uploadCertificate = async (req: Request, res: Response) => {
  try {
    const targetId = parseIdParam(req.params.id)
    const file = req.file
    if (!file) return res.status(400).json({ message: 'Không có file được tải lên' })
    const operatorId = (req as any).user.userId
    const ip = getIp(req)
    const cert = await authService.uploadCertificate(targetId, file, operatorId, ip)
    res.status(201).json(cert)
  } catch (err: any) {
    const [status, message] = err.message === 'USER_NOT_FOUND'
      ? [404, 'Không tìm thấy tài khoản'] : [500, 'Lỗi hệ thống']
    res.status(status).json({ message })
  }
}

export const getCertificates = async (req: Request, res: Response) => {
  try {
    const targetId = parseIdParam(req.params.id)
    const certs = await authService.getCertificates(targetId)
    res.json(certs)
  } catch (err: any) {
    const [status, message] = err.message === 'USER_NOT_FOUND'
      ? [404, 'Không tìm thấy tài khoản'] : [500, 'Lỗi hệ thống']
    res.status(status).json({ message })
  }
}

export const deleteCertificate = async (req: Request, res: Response) => {
  try {
    const targetId  = parseIdParam(req.params.id)
    const certId    = parseIdParam(req.params.certId)
    const operatorId = (req as any).user.userId
    const ip = getIp(req)
    await authService.deleteCertificate(targetId, certId, operatorId, ip)
    res.json({ message: 'Đã xóa chứng chỉ' })
  } catch (err: any) {
    const [status, message] = err.message === 'CERT_NOT_FOUND'
      ? [404, 'Không tìm thấy chứng chỉ'] : [500, 'Lỗi hệ thống']
    res.status(status).json({ message })
  }
}

// Xóa tài khoản
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const targetId = parseIdParam(req.params.id)
    const operatorId = (req as any).user.userId
    const ip = getIp(req)

    await authService.deleteUser(targetId, operatorId, ip)
    res.json({ message: 'Đã xóa tài khoản' })
  } catch (err: any) {
    const messages: Record<string, [number, string]> = {
      USER_NOT_FOUND:     [404, 'Không tìm thấy tài khoản'],
      CANNOT_SELF_DELETE: [400, 'Không thể xóa tài khoản của chính mình'],
      HAS_ACTIVITY_LOG:   [400, 'Không thể xóa tài khoản đã có lịch sử hoạt động'],
    }
    const [status, message] = messages[err.message] || [500, 'Lỗi hệ thống']
    res.status(status).json({ message })
  }
}