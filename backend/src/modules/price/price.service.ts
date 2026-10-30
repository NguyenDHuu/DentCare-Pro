import { PrismaClient } from '@prisma/client'
import { logAction } from '../../utils/logger'

const prisma = new PrismaClient()

// ─── Helpers ─────────────────────────────────────────────────

function computeStatus(startDate: Date, endDate: Date | null): string {
  const now = new Date()
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  if (startDate > now)                            return 'UPCOMING'
  if (!endDate || endDate > soon)                 return 'ACTIVE'
  if (endDate >= now)                             return 'EXPIRING_SOON'
  return 'EXPIRED'
}

function daysLeft(endDate: Date | null): number | null {
  if (!endDate) return null
  return Math.ceil((endDate.getTime() - Date.now()) / 86_400_000)
}

function effectivePrice(basePrice: number, discountPct: number): number {
  return Math.round(basePrice * (1 - discountPct / 100))
}

async function checkOverlap(serviceId: number, startDate: Date, endDate: Date | null, excludeId?: number) {
  const andConditions: object[] = [
    { OR: [{ endDate: null }, { endDate: { gt: startDate } }] },
  ]
  if (endDate) andConditions.push({ startDate: { lt: endDate } })

  return prisma.servicePrice.findFirst({
    where: {
      serviceId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      AND: andConditions,
    },
  })
}

// ─── UC10: List prices — one row per service ─────────────────
//
// Each row carries:
//   current  — the active (or expiring-soon) price config right now
//   upcoming — the next scheduled price that hasn't started yet
//
// If only an upcoming config exists, `current` is null and the UI shows
// the niêm yết (base price) without discount as the "applied" placeholder.

export const getPrices = async (filter: { search?: string; groupId?: number; status?: string }) => {
  const now = new Date()

  // Fetch all non-expired + upcoming configs for non-discontinued services
  const rows = await prisma.servicePrice.findMany({
    where: {
      service: {
        status: { not: 'DISCONTINUED' },
        ...(filter.search
          ? { OR: [{ name: { contains: filter.search } }, { code: { contains: filter.search } }] }
          : {}),
        ...(filter.groupId ? { serviceGroupId: filter.groupId } : {}),
      },
    },
    include: {
      service: { include: { serviceGroup: { select: { id: true, name: true } } } },
    },
    orderBy: [{ service: { serviceGroup: { name: 'asc' } } }, { service: { code: 'asc' } }, { startDate: 'asc' }],
  })

  // Group by service
  type PriceRow = typeof rows[0]
  const serviceMap = new Map<number, { meta: PriceRow['service']; current: PriceRow | null; upcoming: PriceRow | null }>()

  for (const p of rows) {
    if (!serviceMap.has(p.serviceId)) {
      serviceMap.set(p.serviceId, { meta: p.service, current: null, upcoming: null })
    }
    const entry = serviceMap.get(p.serviceId)!

    if (p.startDate <= now) {
      // Active or expired — keep the latest-starting one that hasn't expired yet
      if (!p.endDate || p.endDate >= now) {
        if (!entry.current || p.startDate > entry.current.startDate) entry.current = p
      }
    } else {
      // Future — keep the soonest upcoming
      if (!entry.upcoming || p.startDate < entry.upcoming.startDate) entry.upcoming = p
    }
  }

  const result = Array.from(serviceMap.values())
    .filter(e => e.current || e.upcoming)
    .map(({ meta, current, upcoming }) => {
      const st = current ? computeStatus(current.startDate, current.endDate) : null
      return {
        serviceId:   meta.id,
        serviceCode: meta.code,
        serviceName: meta.name,
        groupId:     meta.serviceGroup.id,
        groupName:   meta.serviceGroup.name,

        // Currently effective price — null means no price is active right now
        currentPrice: current ? {
          id:             current.id,
          basePrice:      current.basePrice,
          discountPct:    current.discountPct,
          effectivePrice: effectivePrice(current.basePrice, current.discountPct),
          startDate:      current.startDate,
          endDate:        current.endDate,
          status:         st!,
          daysLeft:       daysLeft(current.endDate),
        } : null,

        // Next scheduled price — null means no future price is planned
        upcomingPrice: upcoming ? {
          id:             upcoming.id,
          basePrice:      upcoming.basePrice,
          discountPct:    upcoming.discountPct,
          effectivePrice: effectivePrice(upcoming.basePrice, upcoming.discountPct),
          startDate:      upcoming.startDate,
          endDate:        upcoming.endDate,
        } : null,
      }
    })

  if (!filter.status) return result
  if (filter.status === 'UPCOMING') return result.filter(r => r.upcomingPrice !== null)
  return result.filter(r => r.currentPrice?.status === filter.status)
}

// ─── UC10: Price history for a service ───────────────────────

export const getPriceHistory = async (serviceId: number) => {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { name: true, code: true },
  })
  if (!service) throw { status: 404, message: 'Không tìm thấy dịch vụ' }

  const history = await prisma.servicePrice.findMany({
    where: { serviceId },
    orderBy: { startDate: 'desc' },
  })

  return {
    serviceName: service.name,
    serviceCode: service.code,
    history: history.map(p => ({
      id:            p.id,
      basePrice:     p.basePrice,
      discountPct:   p.discountPct,
      effectivePrice: effectivePrice(p.basePrice, p.discountPct),
      startDate:     p.startDate,
      endDate:       p.endDate,
      status:        computeStatus(p.startDate, p.endDate),
      daysLeft:      daysLeft(p.endDate),
      createdAt:     p.createdAt,
    })),
  }
}

// ─── UC10: Create price ───────────────────────────────────────

export const createPrice = async (
  data: { serviceId: number; basePrice: number; discountPct: number; startDate: string; endDate?: string },
  adminId: number,
  ip: string,
) => {
  if (data.basePrice < 0)
    throw { status: 400, message: 'Giá niêm yết phải ≥ 0' }
  if (data.discountPct < 0 || data.discountPct > 100)
    throw { status: 400, message: 'Mức giảm giá phải trong khoảng 0 – 100%' }

  const service = await prisma.service.findUnique({ where: { id: data.serviceId } })
  if (!service) throw { status: 404, message: 'Không tìm thấy dịch vụ' }
  if (service.status === 'DISCONTINUED')
    throw { status: 400, message: 'Dịch vụ đã ngừng sử dụng, không thể thiết lập giá' }

  const startDate = new Date(data.startDate)
  const endDate   = data.endDate ? new Date(data.endDate) : null

  if (endDate && endDate <= startDate)
    throw { status: 400, message: 'Ngày kết thúc phải sau ngày bắt đầu' }

  const overlap = await checkOverlap(data.serviceId, startDate, endDate)
  if (overlap) {
    const from = overlap.startDate.toLocaleDateString('vi-VN')
    const to   = overlap.endDate ? overlap.endDate.toLocaleDateString('vi-VN') : 'không giới hạn'
    throw { status: 409, message: `Xung đột thời gian với cấu hình giá hiện có (${from} – ${to})` }
  }

  const price = await prisma.servicePrice.create({
    data: { serviceId: data.serviceId, basePrice: data.basePrice, discountPct: data.discountPct, startDate, endDate, createdBy: adminId },
  })

  await logAction('CREATE_PRICE', `Thiết lập giá ${service.code}: ${data.basePrice.toLocaleString('vi-VN')}đ (-${data.discountPct}%)`, adminId, ip)
  return price
}

// ─── UC10: Update price ───────────────────────────────────────

export const updatePrice = async (
  id: number,
  data: { basePrice?: number; discountPct?: number; startDate?: string; endDate?: string | null },
  adminId: number,
  ip: string,
) => {
  const price = await prisma.servicePrice.findUnique({ where: { id }, include: { service: true } })
  if (!price) throw { status: 404, message: 'Không tìm thấy cấu hình giá' }

  const basePrice  = data.basePrice   ?? price.basePrice
  const discountPct = data.discountPct ?? price.discountPct
  const startDate  = data.startDate   ? new Date(data.startDate) : price.startDate
  const endDate    = data.endDate === null ? null : (data.endDate ? new Date(data.endDate) : price.endDate)

  if (basePrice < 0)
    throw { status: 400, message: 'Giá niêm yết phải ≥ 0' }
  if (discountPct < 0 || discountPct > 100)
    throw { status: 400, message: 'Mức giảm giá phải trong khoảng 0 – 100%' }
  if (endDate && endDate <= startDate)
    throw { status: 400, message: 'Ngày kết thúc phải sau ngày bắt đầu' }

  const overlap = await checkOverlap(price.serviceId, startDate, endDate, id)
  if (overlap) {
    const from = overlap.startDate.toLocaleDateString('vi-VN')
    const to   = overlap.endDate ? overlap.endDate.toLocaleDateString('vi-VN') : 'không giới hạn'
    throw { status: 409, message: `Xung đột thời gian với cấu hình giá hiện có (${from} – ${to})` }
  }

  await prisma.servicePrice.update({ where: { id }, data: { basePrice, discountPct, startDate, endDate } })
  await logAction('UPDATE_PRICE', `Cập nhật giá ${price.service.code}: ${basePrice.toLocaleString('vi-VN')}đ (-${discountPct}%)`, adminId, ip)
}
