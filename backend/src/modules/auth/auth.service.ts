import { PrismaClient } from '@prisma/client'
import { hashPassword, comparePassword } from '../../utils/hash'
import { signToken } from '../../utils/jwt'
import { logAction } from '../../utils/logger'
import {
  sendWelcomeEmail,
  sendAdminPasswordResetEmail,
  sendCustomEmail,
  EmailAttachment,
} from '../../utils/email'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

// ─── Logout: xóa refresh token ───────────────────────────────
export const logoutUser = async (userId: number) => {
  await prisma.refreshToken.deleteMany({ where: { userId } })
}

// ─── UC01: Kiểm tra đã có Admin chưa ───────────────────────
export const checkAdminExists = async () => {
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } })
  if (!adminRole) return false
  const count = await prisma.userRole.count({ where: { roleId: adminRole.id } })
  return count > 0
}

// ─── UC01: Tạo Admin lần đầu ────────────────────────────────
export const setupAdmin = async (data: {
  fullName: string
  username: string
  email: string
  password: string
}, ip: string) => {
  const hashedPw = await hashPassword(data.password)

  await prisma.role.createMany({
    data: [
      { name: 'ADMIN' },
      { name: 'DOCTOR' },
      { name: 'RECEPTIONIST' },
      { name: 'ACCOUNTANT' },
    ],
    skipDuplicates: true
  })

  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } })

  const user = await prisma.user.create({
    data: {
      fullName: data.fullName,
      username: data.username,
      email: data.email,
      password: hashedPw,
      roles: { create: { roleId: adminRole!.id } }
    }
  })

  await logAction('SETUP_ADMIN', `Admin đầu tiên được tạo: ${data.username}`, user.id, ip)
  return user
}

// ─── Đăng ký Admin tự do ────────────────────────────────────
export const registerAdmin = async (data: {
  fullName: string
  username: string
  email: string
  password: string
}, ip: string) => {
  const hashedPw = await hashPassword(data.password)

  await prisma.role.createMany({
    data: [
      { name: 'ADMIN' },
      { name: 'DOCTOR' },
      { name: 'RECEPTIONIST' },
      { name: 'ACCOUNTANT' },
    ],
    skipDuplicates: true
  })

  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } })

  const user = await prisma.user.create({
    data: {
      fullName: data.fullName,
      username: data.username,
      email: data.email,
      password: hashedPw,
      roles: { create: { roleId: adminRole!.id } }
    }
  })

  await logAction('REGISTER_ADMIN', `Admin tự đăng ký: ${data.username}`, user.id, ip)
  return user
}

// ─── UC02: Đăng nhập ────────────────────────────────────────
export const login = async (
  username: string,
  password: string,
  ip: string
) => {
  const user = await prisma.user.findUnique({
    where: { username },
    include: { roles: { include: { role: true } } }
  })

  if (!user) {
    await logAction('LOGIN_FAILED', `Sai tên đăng nhập: ${username}`, undefined, ip, 'FAILED')
    throw new Error('INVALID_CREDENTIALS')
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await logAction('LOGIN_FAILED', `Tài khoản bị khóa tạm thời: ${username}`, user.id, ip, 'FAILED')
    throw new Error('ACCOUNT_LOCKED')
  }

  if (!user.isActive) {
    await logAction('LOGIN_FAILED', `Tài khoản bị vô hiệu hóa: ${username}`, user.id, ip, 'FAILED')
    throw new Error('ACCOUNT_DISABLED')
  }

  const isValid = await comparePassword(password, user.password)

  if (!isValid) {
    const attempts = user.loginAttempts + 1
    const lockData = attempts >= 5
      ? { loginAttempts: 0, lockedUntil: new Date(Date.now() + 15 * 60 * 1000) }
      : { loginAttempts: attempts }

    await prisma.user.update({ where: { id: user.id }, data: lockData })
    await logAction('LOGIN_FAILED', `Sai mật khẩu lần ${attempts}/5`, user.id, ip, 'FAILED')
    throw new Error('INVALID_CREDENTIALS')
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { loginAttempts: 0, lockedUntil: null }
  })

  const roles = user.roles.map(r => r.role.name)
  const token = signToken({ userId: user.id, roles })

  await logAction('LOGIN', `Đăng nhập thành công`, user.id, ip)

  return {
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      roles
    }
  }
}

// ─── UC03: Đổi mật khẩu ─────────────────────────────────────
export const changePassword = async (
  userId: number,
  currentPassword: string,
  newPassword: string,
  ip: string
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('USER_NOT_FOUND')

  const isValid = await comparePassword(currentPassword, user.password)
  if (!isValid) throw new Error('WRONG_PASSWORD')

  const isSame = await comparePassword(newPassword, user.password)
  if (isSame) throw new Error('SAME_PASSWORD')

  const hashed = await hashPassword(newPassword)
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } })
  await prisma.refreshToken.deleteMany({ where: { userId } })
  await logAction('CHANGE_PASSWORD', 'Đổi mật khẩu thành công', userId, ip)
}

// ─── UC04: Quên mật khẩu ────────────────────────────────────
export const requestPasswordReset = async (email: string, ip: string) => {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return null

  const recentRequests = await prisma.passwordResetToken.count({
    where: {
      userId: user.id,
      createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) }
    }
  })
  if (recentRequests >= 3) throw new Error('RATE_LIMIT')

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

  await prisma.passwordResetToken.create({
    data: { token, userId: user.id, expiresAt }
  })

  await logAction('REQUEST_RESET_PASSWORD', `Yêu cầu đặt lại mật khẩu`, user.id, ip)
  return { token, email: user.email }
}

export const resetPassword = async (token: string, newPassword: string) => {
  const record = await prisma.passwordResetToken.findUnique({ where: { token } })

  if (!record) throw new Error('INVALID_TOKEN')
  if (record.used) throw new Error('TOKEN_USED')
  if (record.expiresAt < new Date()) throw new Error('TOKEN_EXPIRED')

  const hashed = await hashPassword(newPassword)
  await prisma.user.update({ where: { id: record.userId }, data: { password: hashed } })
  await prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } })
  await prisma.refreshToken.deleteMany({ where: { userId: record.userId } })
  await logAction('RESET_PASSWORD', 'Đặt lại mật khẩu thành công', record.userId)
}

// ─── Lấy danh sách tài khoản ────────────────────────────────
export const getUsers = async () => {
  return prisma.user.findMany({
    include: {
      roles: { include: { role: true } },
      _count: { select: { logs: true } }
    },
    orderBy: { createdAt: 'desc' }
  })
}

// ─── UC05 D: Khóa / Mở tài khoản ───────────────────────────
export const toggleUserStatus = async (
  targetId: number,
  isActive: boolean,
  reason: string | undefined,
  operatorId: number,
  ip: string
) => {
  const user = await prisma.user.findUnique({
    where: { id: targetId },
    include: { roles: { include: { role: true } } },
  })
  if (!user) throw new Error('USER_NOT_FOUND')
  if (targetId === operatorId) throw new Error('CANNOT_SELF_LOCK')

  // A7: không khóa nếu là Admin hoạt động duy nhất
  if (!isActive) {
    const isAdmin = user.roles.some(ur => ur.role.name === 'ADMIN')
    if (isAdmin) {
      const activeAdminCount = await prisma.user.count({
        where: { isActive: true, roles: { some: { role: { name: 'ADMIN' } } } },
      })
      if (activeAdminCount <= 1) throw new Error('LAST_ADMIN')
    }
    // Hủy tất cả phiên làm việc ngay lập tức
    await prisma.refreshToken.deleteMany({ where: { userId: targetId } })
  }

  await prisma.user.update({
    where: { id: targetId },
    data: { isActive, lockReason: isActive ? null : (reason ?? null) },
  })
  await logAction(
    isActive ? 'UNLOCK_USER' : 'LOCK_USER',
    `${isActive ? 'Mở' : 'Khóa'} tài khoản: ${user.username}${reason ? ` — ${reason}` : ''}`,
    operatorId, ip
  )
}

// ─── UC05 A: Tạo tài khoản (mọi vai trò, kể cả ADMIN) ───────
const ALL_VALID_ROLES = ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'ACCOUNTANT']

export const createStaff = async (
  data: { fullName: string; username: string; email: string; password: string; roles: string[] },
  operatorId: number,
  ip: string
) => {
  if (data.roles.length === 0) throw new Error('NO_ROLE')
  if (!data.roles.every(r => ALL_VALID_ROLES.includes(r))) throw new Error('INVALID_ROLE')

  const hashedPw = await hashPassword(data.password)
  const roleRecords = await prisma.role.findMany({ where: { name: { in: data.roles } } })

  const user = await prisma.user.create({
    data: {
      fullName: data.fullName,
      username: data.username,
      email: data.email,
      password: hashedPw,
      roles: { create: roleRecords.map(r => ({ roleId: r.id })) },
    },
  })

  // Tạo profile trống cho từng role
  if (data.roles.includes('ADMIN'))
    await prisma.adminProfile.create({ data: { userId: user.id } })
  if (data.roles.includes('DOCTOR'))
    await prisma.doctorProfile.create({ data: { userId: user.id } })
  if (data.roles.includes('RECEPTIONIST'))
    await prisma.receptionistProfile.create({ data: { userId: user.id } })
  if (data.roles.includes('ACCOUNTANT'))
    await prisma.accountantProfile.create({ data: { userId: user.id } })

  try {
    await sendWelcomeEmail(data.email, data.fullName, data.username, data.password)
  } catch {
    // E2: tài khoản vẫn tạo dù gửi mail thất bại
  }

  await logAction('CREATE_STAFF', `Tạo tài khoản: ${data.username} [${data.roles.join(', ')}]`, operatorId, ip)
  return user
}

// ─── UC05 C: Cập nhật vai trò (áp dụng cho mọi tài khoản) ───
export const updateUserRoles = async (
  targetId: number,
  roles: string[],
  operatorId: number,
  ip: string
) => {
  if (roles.length === 0) throw new Error('NO_ROLE')
  if (!roles.every(r => ALL_VALID_ROLES.includes(r))) throw new Error('INVALID_ROLE')

  const user = await prisma.user.findUnique({
    where: { id: targetId },
    include: { roles: { include: { role: true } } },
  })
  if (!user) throw new Error('USER_NOT_FOUND')

  // Nếu đang bỏ vai trò ADMIN: kiểm tra còn ít nhất 1 Admin hoạt động khác
  const currentlyAdmin = user.roles.some(ur => ur.role.name === 'ADMIN')
  const willStillAdmin = roles.includes('ADMIN')
  if (currentlyAdmin && !willStillAdmin) {
    const activeAdminCount = await prisma.user.count({
      where: { isActive: true, roles: { some: { role: { name: 'ADMIN' } } } },
    })
    if (activeAdminCount <= 1) throw new Error('LAST_ADMIN')
  }

  const roleRecords = await prisma.role.findMany({ where: { name: { in: roles } } })
  await prisma.userRole.deleteMany({ where: { userId: targetId } })
  await prisma.userRole.createMany({
    data: roleRecords.map(r => ({ userId: targetId, roleId: r.id })),
  })

  await logAction('UPDATE_ROLES', `Đổi vai trò ${user.username}: ${roles.join(', ')}`, operatorId, ip)
}

// ─── Dashboard stats ─────────────────────────────────────────
export const getDashboardStats = async () => {
  const now = new Date()
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)

  const [allUsers, activeServices, activePrices, todayLogs, lockedUsers, recentLogs] = await Promise.all([
    prisma.user.findMany({ include: { roles: { include: { role: true } } } }),
    prisma.service.count({ where: { status: 'ACTIVE' } }),
    prisma.servicePrice.count({
      where: {
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      },
    }),
    prisma.systemLog.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.user.count({ where: { isActive: false } }),
    prisma.systemLog.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { fullName: true, username: true } } },
    }),
  ])

  const roleCounts: Record<string, number> = { ADMIN: 0, DOCTOR: 0, RECEPTIONIST: 0, ACCOUNTANT: 0 }
  for (const u of allUsers) {
    for (const ur of u.roles) {
      const rn = ur.role.name
      if (rn in roleCounts) roleCounts[rn]++
    }
  }

  return {
    totalUsers: allUsers.length,
    byRole: roleCounts,
    activeServices,
    activePrices,
    todayLogs,
    lockedUsers,
    recentLogs,
  }
}

// ─── UC06: Lấy thông tin chi tiết user ───────────────────────
export const getUserById = async (id: number) => {
  return prisma.user.findUnique({
    where: { id },
    include: {
      roles: { include: { role: true } },
      adminProfile: true,
      receptionistProfile: true,
      accountantProfile: true,
      doctorProfile: true,
    },
  })
}

// ─── UC06 A: Cập nhật thông tin cá nhân ──────────────────────
export const updateUserProfile = async (
  targetId: number,
  data: { fullName?: string; email?: string; phone?: string; address?: string; avatar?: string },
  operatorId: number,
  ip: string
) => {
  const user = await prisma.user.findUnique({
    where: { id: targetId },
    include: { roles: { include: { role: true } } },
  })
  if (!user) throw new Error('USER_NOT_FOUND')

  if (data.fullName || data.email) {
    await prisma.user.update({
      where: { id: targetId },
      data: { ...(data.fullName && { fullName: data.fullName }), ...(data.email && { email: data.email }) },
    })
  }

  const profileData = {
    ...(data.phone   !== undefined && { phone: data.phone }),
    ...(data.address !== undefined && { address: data.address }),
    ...(data.avatar  !== undefined && { avatar: data.avatar }),
  }

  const roles = user.roles.map(ur => ur.role.name)
  if (roles.includes('ADMIN'))
    await prisma.adminProfile.upsert({ where: { userId: targetId }, update: profileData, create: { userId: targetId, ...profileData } })
  if (roles.includes('DOCTOR'))
    await prisma.doctorProfile.upsert({ where: { userId: targetId }, update: profileData, create: { userId: targetId, ...profileData } })
  if (roles.includes('RECEPTIONIST'))
    await prisma.receptionistProfile.upsert({ where: { userId: targetId }, update: profileData, create: { userId: targetId, ...profileData } })
  if (roles.includes('ACCOUNTANT'))
    await prisma.accountantProfile.upsert({ where: { userId: targetId }, update: profileData, create: { userId: targetId, ...profileData } })

  await logAction('UPDATE_PROFILE', `Cập nhật thông tin: ${user.username}`, operatorId, ip)
}

// ─── UC06 B: Admin đặt lại mật khẩu cho nhân sự ─────────────
export const adminResetPassword = async (
  targetId: number,
  newPassword: string,
  operatorId: number,
  ip: string
) => {
  const user = await prisma.user.findUnique({ where: { id: targetId } })
  if (!user) throw new Error('USER_NOT_FOUND')
  if (targetId === operatorId) throw new Error('CANNOT_SELF_RESET')

  const hashed = await hashPassword(newPassword)
  await prisma.user.update({ where: { id: targetId }, data: { password: hashed } })
  await prisma.refreshToken.deleteMany({ where: { userId: targetId } })

  try {
    await sendAdminPasswordResetEmail(user.email, user.fullName, newPassword)
  } catch {
    // E2: mật khẩu vẫn được cập nhật dù gửi mail thất bại
  }

  await logAction('ADMIN_RESET_PASSWORD', `Đặt lại mật khẩu: ${user.username}`, operatorId, ip)
}

// ─── UC06: Gửi email tùy chỉnh đến nhân sự ───────────────────
export const sendEmailToUser = async (
  targetId: number,
  subject: string,
  content: string,
  attachments: EmailAttachment[],
  operatorId: number,
  ip: string
) => {
  const user = await prisma.user.findUnique({ where: { id: targetId } })
  if (!user) throw new Error('USER_NOT_FOUND')

  await sendCustomEmail(user.email, subject, content, attachments)
  await logAction('SEND_EMAIL', `Gửi email đến: ${user.username} — "${subject}" (${attachments.length} file đính kèm)`, operatorId, ip)
}


// ─── Xóa tài khoản (chỉ khi chưa có log) ───────────────────
export const deleteUser = async (
  targetId: number,
  operatorId: number,
  ip: string
) => {
  if (targetId === operatorId) throw new Error('CANNOT_SELF_DELETE')

  const logCount = await prisma.systemLog.count({ where: { userId: targetId } })
  if (logCount > 0) throw new Error('HAS_ACTIVITY_LOG')

  const user = await prisma.user.findUnique({ where: { id: targetId } })
  if (!user) throw new Error('USER_NOT_FOUND')

  await prisma.user.delete({ where: { id: targetId } })
  await logAction('DELETE_USER', `Xóa tài khoản: ${user.username}`, operatorId, ip)
}

// ─── UC07: Nhật ký hoạt động ─────────────────────────────────

export interface LogFilter {
  search?: string
  action?: string
  status?: string
  module?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}

export const getLogs = async (filter: LogFilter) => {
  const page  = Math.max(1, filter.page  ?? 1)
  const limit = Math.min(50, Math.max(1, filter.limit ?? 10))
  const skip  = (page - 1) * limit

  const where: any = {}

  if (filter.status) where.status = filter.status
  if (filter.module) where.module = filter.module
  if (filter.action) where.action = filter.action

  if (filter.startDate || filter.endDate) {
    where.createdAt = {}
    if (filter.startDate) where.createdAt.gte = new Date(filter.startDate)
    if (filter.endDate)   where.createdAt.lte = new Date(new Date(filter.endDate).setHours(23, 59, 59, 999))
  }

  if (filter.search) {
    where.OR = [
      { action: { contains: filter.search } },
      { detail: { contains: filter.search } },
      { ip:     { contains: filter.search } },
      { user:   { OR: [
        { fullName: { contains: filter.search } },
        { username: { contains: filter.search } },
        { email:    { contains: filter.search } },
      ]}},
    ]
  }

  const [total, logs] = await Promise.all([
    prisma.systemLog.count({ where }),
    prisma.systemLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { user: { select: { id: true, fullName: true, username: true, email: true } } },
    }),
  ])

  return { total, page, limit, totalPages: Math.ceil(total / limit), logs }
}

export const exportLogsCSV = async (filter: Omit<LogFilter, 'page' | 'limit'>) => {
  const where: any = {}
  if (filter.status) where.status = filter.status
  if (filter.module) where.module = filter.module
  if (filter.action) where.action = filter.action
  if (filter.startDate || filter.endDate) {
    where.createdAt = {}
    if (filter.startDate) where.createdAt.gte = new Date(filter.startDate)
    if (filter.endDate)   where.createdAt.lte = new Date(new Date(filter.endDate).setHours(23, 59, 59, 999))
  }
  if (filter.search) {
    where.OR = [
      { action: { contains: filter.search } },
      { detail: { contains: filter.search } },
      { user: { OR: [{ fullName: { contains: filter.search } }, { email: { contains: filter.search } }] } },
    ]
  }

  const logs = await prisma.systemLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 5000,
    include: { user: { select: { fullName: true, email: true } } },
  })

  const escape = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`
  const header = ['Thời gian', 'Hành động', 'Người dùng', 'Email', 'Module', 'Trạng thái', 'Chi tiết', 'IP']
  const rows = logs.map(l => [
    new Date(l.createdAt).toLocaleString('vi-VN'),
    l.action,
    l.user?.fullName ?? '',
    l.user?.email ?? '',
    l.module ?? '',
    l.status,
    l.detail ?? '',
    l.ip ?? '',
  ].map(escape))

  return [header.map(escape), ...rows].map(r => r.join(',')).join('\n')
}

// ─── Bằng cấp & Chứng chỉ ────────────────────────────────────

const certDir = (userId: number) =>
  path.join(process.cwd(), 'uploads', 'certificates', String(userId))

export const uploadCertificate = async (
  targetId: number,
  file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  operatorId: number,
  ip: string
) => {
  const user = await prisma.user.findUnique({ where: { id: targetId } })
  if (!user) throw new Error('USER_NOT_FOUND')

  const ext = path.extname(file.originalname) || ''
  const filename = `${crypto.randomUUID()}${ext}`
  const dir = certDir(targetId)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, filename), file.buffer)

  const cert = await prisma.userCertificate.create({
    data: {
      userId: targetId,
      filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    },
  })

  await logAction('UPLOAD_CERTIFICATE', `Tải lên chứng chỉ: ${file.originalname} (user ${user.username})`, operatorId, ip)
  return cert
}

export const getCertificates = async (targetId: number) => {
  const user = await prisma.user.findUnique({ where: { id: targetId } })
  if (!user) throw new Error('USER_NOT_FOUND')
  return prisma.userCertificate.findMany({
    where: { userId: targetId },
    orderBy: { uploadedAt: 'desc' },
  })
}

export const deleteCertificate = async (
  targetId: number,
  certId: number,
  operatorId: number,
  ip: string
) => {
  const cert = await prisma.userCertificate.findFirst({
    where: { id: certId, userId: targetId },
  })
  if (!cert) throw new Error('CERT_NOT_FOUND')

  const filePath = path.join(certDir(targetId), cert.filename)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

  await prisma.userCertificate.delete({ where: { id: certId } })
  await logAction('DELETE_CERTIFICATE', `Xóa chứng chỉ: ${cert.originalName} (userId ${targetId})`, operatorId, ip)
}