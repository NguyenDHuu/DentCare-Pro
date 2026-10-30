import { PrismaClient } from '@prisma/client'
import { logAction } from '../../utils/logger'
import { sendSmsEsms } from './sms.gateway'

const prisma = new PrismaClient()

// ─── Default template seeds ───────────────────────────────────

const DEFAULT_TEMPLATES = [
  {
    type:      'CONFIRM_BOOKING',
    name:      'Xác nhận đặt lịch',
    content:   'Phòng khám DentCare xác nhận lịch hẹn của bạn vào [Ngày] lúc [Giờ] với [Bác sĩ]. Mọi thắc mắc vui lòng gọi 028.1234.5678',
    isEnabled: true,
    sortOrder: 1,
  },
  {
    type:      'REMINDER_24H',
    name:      'Nhắc lịch hẹn trước 1 ngày',
    content:   'Nhắc lịch: Bạn đã hẹn khám tại DentCare vào [Ngày] lúc [Giờ] với [Bác sĩ]. Vui lòng đến đúng giờ. Liên hệ: 028.1234.5678',
    isEnabled: true,
    sortOrder: 2,
  },
  {
    type:      'REMINDER_2H',
    name:      'Nhắc lịch hẹn trước 2 tiếng',
    content:   'Nhắc lịch: Bạn sắp tới lượt hẹn vào lúc [Giờ] nữa. Vui lòng đến đúng giờ. Liên hệ: 028.1234.5678',
    isEnabled: true,
    sortOrder: 3,
  },
  {
    type:      'CANCEL',
    name:      'Thông báo hủy lịch',
    content:   'DentCare thông báo lịch hẹn ngày [Ngày] lúc [Giờ] của bạn đã bị hủy. Liên hệ 028.1234.5678 để đặt lịch mới.',
    isEnabled: true,
    sortOrder: 4,
  },
  {
    type:      'RESCHEDULE',
    name:      'Thông báo thay đổi lịch',
    content:   'Lịch hẹn của bạn đã được thay đổi sang [Ngày] lúc [Giờ] với [Bác sĩ]. Liên hệ 028.1234.5678 nếu cần hỗ trợ.',
    isEnabled: true,
    sortOrder: 5,
  },
]

// ─── Config & templates ──────────────────────────────────────

/** Get (or initialise) the singleton SMS config and all templates */
export const getConfig = async () => {
  const config = await prisma.smsConfig.upsert({
    where:  { id: 1 },
    update: {},
    create: {
      id:         1,
      isEnabled:  true,
      provider:   'VIETTEL',
      brandname:  'DentCare',
      dailyLimit: 500,
      quietStart: '21:00',
      quietEnd:   '07:00',
    },
  })

  // Seed default templates once
  if ((await prisma.smsTemplate.count()) === 0) {
    await prisma.smsTemplate.createMany({ data: DEFAULT_TEMPLATES })
  }

  const templates = await prisma.smsTemplate.findMany({ orderBy: { sortOrder: 'asc' } })
  return { config, templates }
}

export const updateConfig = async (
  data: {
    isEnabled?:  boolean
    provider?:   string
    apiKey?:     string | null
    secretKey?:  string | null
    brandname?:  string
    dailyLimit?: number
    quietStart?: string
    quietEnd?:   string
  },
  adminId: number,
  ip:      string
) => {
  if (data.dailyLimit !== undefined && (data.dailyLimit < 1 || data.dailyLimit > 50000))
    throw { status: 400, message: 'Giới hạn SMS/ngày phải từ 1 đến 50.000' }

  if (data.brandname !== undefined && !data.brandname.trim())
    throw { status: 400, message: 'Tên người gửi không được để trống' }

  const payload: Record<string, unknown> = { ...data }
  if (data.brandname) payload.brandname = data.brandname.trim()

  await prisma.smsConfig.upsert({
    where:  { id: 1 },
    update: payload,
    create: { id: 1, ...payload },
  })

  await logAction('UPDATE_SMS_CONFIG', 'Cập nhật cấu hình SMS Gateway', adminId, ip)
}

// ─── Templates ───────────────────────────────────────────────

export const updateTemplate = async (
  type:    string,
  data:    { content?: string; isEnabled?: boolean; name?: string },
  adminId: number,
  ip:      string
) => {
  const tpl = await prisma.smsTemplate.findUnique({ where: { type } })
  if (!tpl) throw { status: 404, message: 'Không tìm thấy mẫu SMS' }

  if (data.content !== undefined && !data.content.trim())
    throw { status: 400, message: 'Nội dung mẫu không được để trống' }

  await prisma.smsTemplate.update({
    where: { type },
    data: {
      content:   data.content?.trim()              ?? tpl.content,
      isEnabled: data.isEnabled !== undefined       ? data.isEnabled : tpl.isEnabled,
      name:      data.name?.trim()                 ?? tpl.name,
    },
  })

  await logAction('UPDATE_SMS_TEMPLATE', `Cập nhật mẫu SMS: ${tpl.name}`, adminId, ip)
}

// ─── Stats ───────────────────────────────────────────────────

export const getStats = async () => {
  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)

  const [total, failed, scheduled, recent] = await Promise.all([
    prisma.smsLog.count({ where: { createdAt: { gte: start } } }),
    prisma.smsLog.count({ where: { status: 'FAILED',  createdAt: { gte: start } } }),
    prisma.smsLog.count({ where: { status: 'PENDING' } }),
    prisma.smsLog.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
  ])

  const successRate = total > 0
    ? Math.round(((total - failed) / total) * 1000) / 10
    : 0

  return { sentThisMonth: total, successRate, failed, scheduled, recent }
}

// ─── Logs ────────────────────────────────────────────────────

export const getLogs = async (opts: {
  page?:         number
  limit?:        number
  type?:         string
  status?:       string
  phone?:        string
  recipientName?: string
  dateFrom?:     string   // YYYY-MM-DD
  dateTo?:       string   // YYYY-MM-DD
}) => {
  const page  = Math.max(1, opts.page  ?? 1)
  const limit = Math.min(100, opts.limit ?? 20)
  const skip  = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (opts.type)   where.type   = opts.type
  if (opts.status) where.status = opts.status

  if (opts.phone?.trim()) {
    where.phone = { contains: opts.phone.replace(/\D/g, '') }
  }
  if (opts.recipientName?.trim()) {
    where.recipientName = { contains: opts.recipientName.trim() }
  }

  if (opts.dateFrom || opts.dateTo) {
    const createdAt: Record<string, Date> = {}
    if (opts.dateFrom) createdAt.gte = new Date(opts.dateFrom + 'T00:00:00')
    if (opts.dateTo)   createdAt.lte = new Date(opts.dateTo   + 'T23:59:59')
    where.createdAt = createdAt
  }

  const [logs, total] = await Promise.all([
    prisma.smsLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.smsLog.count({ where }),
  ])

  return { logs, total, page, limit, pages: Math.ceil(total / limit) }
}

// ─── Test SMS ────────────────────────────────────────────────

export const sendTestSms = async (
  data:    { phone: string; type: string },
  adminId: number,
  ip:      string
) => {
  if (!data.phone?.trim())
    throw { status: 400, message: 'Vui lòng nhập số điện thoại thử nghiệm' }

  const digits = data.phone.replace(/\D/g, '')
  if (digits.length < 9 || digits.length > 11)
    throw { status: 400, message: 'Số điện thoại không hợp lệ (9–11 chữ số)' }

  const tpl = await prisma.smsTemplate.findUnique({ where: { type: data.type } })
  if (!tpl) throw { status: 404, message: 'Không tìm thấy mẫu SMS' }

  const content = tpl.content
    .replace(/\[Ngày\]/g,   '01/06/2026')
    .replace(/\[Giờ\]/g,    '09:00')
    .replace(/\[Bác sĩ\]/g, 'Bác sĩ A')
    .replace(/\[Tên BN\]/g, 'Bệnh nhân')

  // ── Try real gateway when credentials are present ──────────
  const cfg = await prisma.smsConfig.findUnique({ where: { id: 1 } })

  let status:    'SUCCESS' | 'FAILED' = 'FAILED'
  let errorMsg:  string | undefined
  let sentAt:    Date | undefined
  let retryCount = 0

  const hasCredentials = cfg?.isEnabled && cfg.apiKey && cfg.secretKey

  if (hasCredentials) {
    const result = await sendSmsEsms(
      digits,
      content,
      {
        apiKey:    cfg!.apiKey!,
        secretKey: cfg!.secretKey!,
        brandname: cfg!.brandname,
      },
    )

    status     = result.success ? 'SUCCESS' : 'FAILED'
    errorMsg   = result.success ? undefined : result.message
    sentAt     = result.success ? new Date() : undefined
    retryCount = result.success ? 0 : 1
  } else {
    // No credentials → simulate (mark as success so UI can be tested)
    status     = 'SUCCESS'
    sentAt     = new Date()
    retryCount = 0
  }

  const log = await prisma.smsLog.create({
    data: {
      recipientName: 'SMS thử nghiệm',
      phone:         digits,
      type:          data.type,
      status,
      content,
      sentAt,
      retryCount,
      errorMsg,
    },
  })

  await logAction(
    'SEND_TEST_SMS',
    `SMS thử: ${tpl.name} → ${digits} [${hasCredentials ? 'real' : 'simulated'}] ${status}`,
    adminId,
    ip,
  )
  return { ...log, templateName: tpl.name, simulated: !hasCredentials }
}
