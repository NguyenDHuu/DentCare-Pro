import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// ─── Helpers ─────────────────────────────────────────────────

function pad2(n: number) { return String(n).padStart(2, '0') }

function todayRange() {
  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { start, end }
}

function dayRange(d: Date) {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
  const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
  return { start, end }
}

async function generateInvoiceCode(): Promise<string> {
  const now = new Date()
  const ds  = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`
  const { start, end } = todayRange()
  const count = await (prisma as any).invoice.count({
    where: { createdAt: { gte: start, lte: end } },
  })
  return `HĐ-${ds}-${String(count + 1).padStart(4, '0')}`
}

// ─── Auto-create invoice when doctor signs dental record ─────

export async function autoCreateInvoice(params: {
  dentalRecordId: number
  receptionId:    number
  patientId:      number
  doctorId:       number
  services: Array<{
    serviceId:   number
    serviceName: string
    toothNumber: string | null
    unitPrice:   number
    quantity:    number
    note:        string | null
  }>
}) {
  // Idempotent: skip if already exists
  const existing = await (prisma as any).invoice.findUnique({
    where: { dentalRecordId: params.dentalRecordId },
  })
  if (existing) return existing

  const code     = await generateInvoiceCode()
  const subtotal = params.services.reduce((s, sv) => s + sv.unitPrice * sv.quantity, 0)

  const invoice = await (prisma as any).invoice.create({
    data: {
      code,
      receptionId:    params.receptionId,
      dentalRecordId: params.dentalRecordId,
      patientId:      params.patientId,
      doctorId:       params.doctorId,
      subtotal,
      totalAmount:    subtotal,
      status:         'WAITING_PAYMENT',
      items: {
        create: params.services.map(s => ({
          serviceId:   s.serviceId,
          serviceName: s.serviceName,
          toothNumber: s.toothNumber,
          unitPrice:   s.unitPrice,
          quantity:    s.quantity,
          bhytCovered: false,
          amount:      s.unitPrice * s.quantity,
          note:        s.note,
        })),
      },
    },
    include: { items: true },
  })

  return invoice
}

// ─── List invoices ────────────────────────────────────────────

export async function listInvoices(params: {
  status?:    string
  search?:    string
  patientId?: number
  page?:      number
  limit?:     number
}) {
  const where: any = {}

  if (params.patientId) {
    where.patientId = params.patientId
  }

  if (params.status && params.status !== 'ALL') {
    where.status = params.status
  }

  if (params.search) {
    where.OR = [
      { code: { contains: params.search } },
      { patient: { fullName: { contains: params.search } } },
      { patient: { phone:    { contains: params.search } } },
    ]
  }

  const page  = params.page  ?? 1
  const limit = params.limit ?? 50

  const [items, total] = await Promise.all([
    (prisma as any).invoice.findMany({
      where,
      include: {
        patient:     { select: { id: true, code: true, fullName: true, phone: true, classification: true } },
        doctor:      { select: { id: true, fullName: true } },
        reception:   { select: { id: true, code: true, arrivedAt: true } },
        dentalRecord:{ select: { id: true, code: true, icd10Code: true, icd10Description: true } },
        items: {
          include: { service: { select: { id: true, name: true, code: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    (prisma as any).invoice.count({ where }),
  ])

  return { items, total, page, limit }
}

// ─── Get single invoice ───────────────────────────────────────

export async function getInvoice(id: number) {
  return (prisma as any).invoice.findUnique({
    where: { id },
    include: {
      patient:     { select: { id: true, code: true, fullName: true, phone: true, dateOfBirth: true, bhytCode: true, classification: true } },
      doctor:      { select: { id: true, fullName: true } },
      reception:   { select: { id: true, code: true, arrivedAt: true, chair: true } },
      dentalRecord:{ select: { id: true, code: true, icd10Code: true, icd10Description: true, signedAt: true } },
      confirmer:   { select: { id: true, fullName: true } },
      items: {
        include: { service: { select: { id: true, name: true, code: true } } },
      },
    },
  })
}

// ─── Apply discount / voucher ─────────────────────────────────

export async function applyDiscount(id: number, params: {
  discountPct:    number
  voucherCode?:   string
  discountAmount?: number
}) {
  const invoice = await (prisma as any).invoice.findUnique({ where: { id } })
  if (!invoice)                          return { notFound: true }
  if (invoice.status !== 'WAITING_PAYMENT') return { forbidden: 'Chỉ có thể áp dụng ưu đãi khi chờ thanh toán' }

  let discountAmount = params.discountAmount ?? 0
  if (params.discountPct > 0) {
    discountAmount = Math.round(invoice.subtotal * params.discountPct / 100)
  }
  const totalAmount = Math.max(0, invoice.subtotal - discountAmount)

  const updated = await (prisma as any).invoice.update({
    where: { id },
    data: {
      discountPct:    params.discountPct,
      discountAmount,
      voucherCode:    params.voucherCode ?? null,
      totalAmount,
    },
    include: { items: { include: { service: { select: { id: true, name: true } } } } },
  })
  return { invoice: updated }
}

// ─── Process payment (WAITING_PAYMENT → PAID) ────────────────

export async function payInvoice(id: number, params: {
  paymentMethod: string
  paymentNote?:  string
  confirmedBy:   number
}) {
  const invoice = await (prisma as any).invoice.findUnique({
    where: { id },
    include: {
      patient: { select: { fullName: true, code: true } },
      doctor:  { select: { fullName: true } },
    },
  })
  if (!invoice)                          return { notFound: true }
  if (invoice.status !== 'WAITING_PAYMENT') return { forbidden: 'Hóa đơn không ở trạng thái chờ thanh toán' }

  const now = new Date()
  const paid = await (prisma as any).invoice.update({
    where: { id },
    data: {
      status:        'PAID',
      paymentMethod: params.paymentMethod,
      paymentNote:   params.paymentNote ?? null,
      paidAt:        now,
      confirmedBy:   params.confirmedBy,
    },
    include: {
      patient:     { select: { id: true, fullName: true, phone: true, code: true } },
      doctor:      { select: { id: true, fullName: true } },
      items:       { include: { service: { select: { id: true, name: true } } } },
    },
  })

  // Log
  await (prisma as any).systemLog.create({
    data: {
      userId: params.confirmedBy,
      module: 'INVOICE',
      action: 'PAY_INVOICE',
      detail: `Thu tiền HĐ ${invoice.code} – BN ${invoice.patient.fullName} · ${invoice.totalAmount.toLocaleString('vi-VN')}đ · ${params.paymentMethod}`,
      status: 'SUCCESS',
    },
  })

  return { invoice: paid }
}

// ─── Cancel invoice (Admin only) ─────────────────────────────

export async function cancelInvoice(id: number, userId: number, reason: string) {
  const invoice = await (prisma as any).invoice.findUnique({ where: { id } })
  if (!invoice) return { notFound: true }
  if (invoice.status === 'PAID') return { forbidden: 'Hóa đơn đã thanh toán – liên hệ Admin để hoàn tiền' }

  const cancelled = await (prisma as any).invoice.update({
    where: { id },
    data: { status: 'CANCELLED', notes: reason },
  })
  await (prisma as any).systemLog.create({
    data: {
      userId,
      module: 'INVOICE',
      action: 'CANCEL_INVOICE',
      detail: `Hủy HĐ ${invoice.code} – lý do: ${reason}`,
      status: 'SUCCESS',
    },
  })
  return { invoice: cancelled }
}

// ─── Revenue stats ────────────────────────────────────────────

const DAYS_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const MONTHS_VI = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12']

export async function getStats(period: 'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR') {
  const now = new Date()

  // ── Period range ──────────────────────────────────────────
  let periodStart: Date
  let periodEnd:   Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  switch (period) {
    case 'TODAY':
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
      break
    case 'MONTH':
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
      break
    case 'QUARTER': {
      const q = Math.floor(now.getMonth() / 3)
      periodStart = new Date(now.getFullYear(), q * 3, 1, 0, 0, 0)
      break
    }
    case 'YEAR':
      periodStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0)
      break
    case 'WEEK':
    default: {
      const dow  = now.getDay()         // 0=Sun
      const diff = dow === 0 ? -6 : 1 - dow  // back to Monday
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff, 0, 0, 0)
      break
    }
  }

  // ── Previous period for comparison ───────────────────────
  const periodLen  = periodEnd.getTime() - periodStart.getTime()
  const prevEnd    = new Date(periodStart.getTime() - 1)
  const prevStart  = new Date(periodStart.getTime() - periodLen)

  // ── Paid invoices in current period ──────────────────────
  const [curRevAgg, curPatients, prevRevAgg, prevPatients] = await Promise.all([
    (prisma as any).invoice.aggregate({
      where:  { status: 'PAID', paidAt: { gte: periodStart, lte: periodEnd } },
      _sum:   { totalAmount: true },
    }),
    (prisma as any).invoice.count({
      where: { status: 'PAID', paidAt: { gte: periodStart, lte: periodEnd } },
    }),
    (prisma as any).invoice.aggregate({
      where:  { status: 'PAID', paidAt: { gte: prevStart, lte: prevEnd } },
      _sum:   { totalAmount: true },
    }),
    (prisma as any).invoice.count({
      where: { status: 'PAID', paidAt: { gte: prevStart, lte: prevEnd } },
    }),
  ])

  const totalRevenue  = curRevAgg._sum.totalAmount ?? 0
  const patientCount  = curPatients
  const prevRevenue   = prevRevAgg._sum.totalAmount ?? 0
  const prevPatientCt = prevPatients
  const avgRevenue    = patientCount > 0 ? Math.round(totalRevenue / patientCount) : 0

  const revenueGrowth  = prevRevenue  > 0 ? Math.round((totalRevenue - prevRevenue)  / prevRevenue  * 100) : 0
  const patientGrowth  = prevPatientCt > 0 ? Math.round((patientCount - prevPatientCt) / prevPatientCt * 100) : 0

  // ── Total debt (WAITING_PAYMENT invoices) ─────────────────
  const [debtAgg, overdueCount] = await Promise.all([
    (prisma as any).invoice.aggregate({
      where: { status: 'WAITING_PAYMENT' },
      _sum:  { totalAmount: true },
    }),
    (prisma as any).invoice.count({
      where: {
        status:    'WAITING_PAYMENT',
        createdAt: { lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ])

  // ── Last 7 days chart ─────────────────────────────────────
  const chartData: { label: string; revenue: number; patients: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d   = new Date(now)
    d.setDate(d.getDate() - i)
    const { start, end } = dayRange(d)

    const [rev, cnt] = await Promise.all([
      (prisma as any).invoice.aggregate({
        where: { status: 'PAID', paidAt: { gte: start, lte: end } },
        _sum:  { totalAmount: true },
      }),
      (prisma as any).invoice.count({
        where: { status: 'PAID', paidAt: { gte: start, lte: end } },
      }),
    ])

    chartData.push({
      label:    DAYS_VI[d.getDay()],
      revenue:  rev._sum.totalAmount ?? 0,
      patients: cnt,
    })
  }

  // ── Top services by revenue ───────────────────────────────
  const topItems = await (prisma as any).invoiceItem.groupBy({
    by:     ['serviceId', 'serviceName'],
    where:  { invoice: { status: 'PAID', paidAt: { gte: periodStart, lte: periodEnd } } },
    _sum:   { amount: true, quantity: true },
    orderBy:{ _sum: { amount: 'desc' } },
    take:   8,
  })

  const topServices = topItems.map((t: any) => ({
    name:       t.serviceName,
    count:      t._sum.quantity  ?? 0,
    revenue:    t._sum.amount    ?? 0,
    percentage: totalRevenue > 0 ? Math.round((t._sum.amount ?? 0) / totalRevenue * 1000) / 10 : 0,
  }))

  // ── Revenue by doctor ─────────────────────────────────────
  const byDoctor = await (prisma as any).invoice.groupBy({
    by:     ['doctorId'],
    where:  { status: 'PAID', paidAt: { gte: periodStart, lte: periodEnd } },
    _sum:   { totalAmount: true },
    _count: { id: true },
    orderBy:{ _sum: { totalAmount: 'desc' } },
    take:   5,
  })

  // Fetch doctor names
  const doctorIds  = byDoctor.map((d: any) => d.doctorId)
  const doctors    = await prisma.user.findMany({
    where:  { id: { in: doctorIds } },
    select: { id: true, fullName: true },
  })
  const doctorMap  = Object.fromEntries(doctors.map((d: any) => [d.id, d.fullName]))

  const revenueByDoctor = byDoctor.map((d: any) => ({
    doctorId:   d.doctorId,
    doctorName: doctorMap[d.doctorId] ?? 'N/A',
    revenue:    d._sum.totalAmount ?? 0,
    patients:   d._count.id,
  }))

  return {
    period,
    summary: {
      totalRevenue,
      patientCount,
      avgRevenue,
      totalDebt:   debtAgg._sum.totalAmount ?? 0,
      overdueCount,
      revenueGrowth,
      patientGrowth,
    },
    chartData,
    topServices,
    revenueByDoctor,
  }
}
