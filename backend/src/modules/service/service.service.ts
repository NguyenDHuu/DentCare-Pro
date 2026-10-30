import { PrismaClient } from '@prisma/client'
import { logAction } from '../../utils/logger'

const prisma = new PrismaClient()

// ─── Status helpers ──────────────────────────────────────────

export const STATUS_LABELS: Record<string, string> = {
  INACTIVE:     'Chưa hoạt động',
  ACTIVE:       'Hoạt động',
  SUSPENDED:    'Tạm dừng',
  DISCONTINUED: 'Ngừng sử dụng',
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  INACTIVE:     ['ACTIVE'],
  ACTIVE:       ['SUSPENDED', 'DISCONTINUED'],
  SUSPENDED:    ['ACTIVE', 'DISCONTINUED'],
  DISCONTINUED: [],
}

// ─── UC08: Doctor list ───────────────────────────────────────

export const getDoctors = async () => {
  return prisma.user.findMany({
    where: {
      isActive: true,
      roles: { some: { role: { name: 'DOCTOR' } } },
    },
    select: { id: true, fullName: true },
    orderBy: { fullName: 'asc' },
  })
}

// ─── UC08: Service groups ────────────────────────────────────

export const getServiceGroups = async (search?: string) => {
  const groups = await prisma.serviceGroup.findMany({
    where: search ? { name: { contains: search } } : undefined,
    include: {
      doctors: {
        include: { doctor: { select: { id: true, fullName: true } } },
      },
      _count: { select: { services: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return groups.map(g => ({
    id: g.id,
    name: g.name,
    description: g.description,
    serviceCount: g._count.services,
    doctors: g.doctors.map(d => ({ id: d.doctor.id, fullName: d.doctor.fullName })),
  }))
}

export const createServiceGroup = async (
  data: { name: string; description?: string; doctorIds: number[] },
  adminId: number,
  ip: string
) => {
  if (!data.name?.trim()) throw { status: 400, message: 'Tên nhóm không được để trống' }
  if (!data.doctorIds || data.doctorIds.length === 0)
    throw { status: 400, message: 'Phải chọn ít nhất một bác sĩ đảm nhiệm' }

  const existing = await prisma.serviceGroup.findUnique({ where: { name: data.name.trim() } })
  if (existing) throw { status: 409, message: 'Tên nhóm dịch vụ đã tồn tại' }

  const group = await prisma.serviceGroup.create({
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      doctors: { create: data.doctorIds.map(id => ({ doctorId: id })) },
    },
  })

  await logAction('CREATE_SERVICE_GROUP', `Tạo nhóm dịch vụ: ${group.name}`, adminId, ip)
  return group
}

export const updateServiceGroup = async (
  id: number,
  data: { name?: string; description?: string; doctorIds?: number[] },
  adminId: number,
  ip: string
) => {
  const group = await prisma.serviceGroup.findUnique({ where: { id } })
  if (!group) throw { status: 404, message: 'Không tìm thấy nhóm dịch vụ' }

  if (data.name && data.name.trim() !== group.name) {
    const dup = await prisma.serviceGroup.findUnique({ where: { name: data.name.trim() } })
    if (dup) throw { status: 409, message: 'Tên nhóm dịch vụ đã tồn tại' }
  }

  if (data.doctorIds !== undefined && data.doctorIds.length === 0)
    throw { status: 400, message: 'Phải chọn ít nhất một bác sĩ đảm nhiệm' }

  await prisma.$transaction(async tx => {
    await tx.serviceGroup.update({
      where: { id },
      data: {
        name: data.name?.trim() ?? group.name,
        description: data.description !== undefined ? (data.description?.trim() || null) : group.description,
      },
    })
    if (data.doctorIds !== undefined) {
      await tx.serviceGroupDoctor.deleteMany({ where: { serviceGroupId: id } })
      await tx.serviceGroupDoctor.createMany({
        data: data.doctorIds.map(dId => ({ serviceGroupId: id, doctorId: dId })),
      })
    }
  })

  await logAction('UPDATE_SERVICE_GROUP', `Cập nhật nhóm dịch vụ: ${group.name}`, adminId, ip)
}

export const deleteServiceGroup = async (id: number, adminId: number, ip: string) => {
  const group = await prisma.serviceGroup.findUnique({
    where: { id },
    include: { _count: { select: { services: true } } },
  })
  if (!group) throw { status: 404, message: 'Không tìm thấy nhóm dịch vụ' }

  if (group._count.services > 0)
    throw {
      status: 400,
      message: `Không thể xóa nhóm còn ${group._count.services} dịch vụ. Vui lòng chuyển hoặc ngừng tất cả dịch vụ trước.`,
    }

  await prisma.serviceGroup.delete({ where: { id } })
  await logAction('DELETE_SERVICE_GROUP', `Xóa nhóm dịch vụ: ${group.name}`, adminId, ip)
}

export const getGroupServices = async (id: number) => {
  const group = await prisma.serviceGroup.findUnique({ where: { id } })
  if (!group) throw { status: 404, message: 'Không tìm thấy nhóm dịch vụ' }

  const services = await prisma.service.findMany({
    where: { serviceGroupId: id },
    orderBy: { code: 'asc' },
    select: { id: true, code: true, name: true, status: true },
  })

  return { groupName: group.name, services }
}

// ─── UC09: Services CRUD ─────────────────────────────────────

export const getServices = async (filter: {
  search?: string
  groupId?: number
  status?: string
}) => {
  return prisma.service.findMany({
    where: {
      AND: [
        filter.search
          ? { OR: [{ code: { contains: filter.search } }, { name: { contains: filter.search } }] }
          : {},
        filter.groupId ? { serviceGroupId: filter.groupId } : {},
        filter.status  ? { status: filter.status }          : {},
      ],
    },
    include: { serviceGroup: { select: { id: true, name: true } } },
    orderBy: { code: 'asc' },
  })
}

export const getServiceById = async (id: number) => {
  const service = await prisma.service.findUnique({
    where: { id },
    include: { serviceGroup: { select: { id: true, name: true } } },
  })
  if (!service) throw { status: 404, message: 'Không tìm thấy dịch vụ' }
  return service
}

export const createService = async (
  data: { code: string; name: string; serviceGroupId: number; description?: string; duration?: number },
  adminId: number,
  ip: string
) => {
  if (!data.code?.trim()) throw { status: 400, message: 'Mã dịch vụ không được để trống' }
  if (!data.name?.trim()) throw { status: 400, message: 'Tên dịch vụ không được để trống' }
  if (data.duration !== undefined && (data.duration < 0 || !Number.isInteger(data.duration)))
    throw { status: 400, message: 'Thời lượng dịch vụ không hợp lệ' }

  const dupCode = await prisma.service.findUnique({ where: { code: data.code.trim() } })
  if (dupCode) throw { status: 409, message: 'Mã dịch vụ đã tồn tại' }

  const group = await prisma.serviceGroup.findUnique({ where: { id: data.serviceGroupId } })
  if (!group) throw { status: 404, message: 'Nhóm dịch vụ không tồn tại' }

  const service = await prisma.service.create({
    data: {
      code:          data.code.trim().toUpperCase(),
      name:          data.name.trim(),
      description:   data.description?.trim() || null,
      duration:      data.duration ?? 0,
      serviceGroupId: data.serviceGroupId,
      status: 'INACTIVE',
    },
  })

  await logAction('CREATE_SERVICE', `Tạo dịch vụ: ${service.code} – ${service.name} (${service.duration > 0 ? service.duration + ' phút' : 'chưa cấu hình thời lượng'})`, adminId, ip)
  return service
}

export const updateService = async (
  id: number,
  data: { code?: string; name?: string; serviceGroupId?: number; description?: string; duration?: number },
  adminId: number,
  ip: string
) => {
  const service = await prisma.service.findUnique({ where: { id } })
  if (!service) throw { status: 404, message: 'Không tìm thấy dịch vụ' }

  if (service.status === 'DISCONTINUED')
    throw { status: 400, message: 'Không thể chỉnh sửa dịch vụ đã ngừng sử dụng' }

  if (data.code && data.code.trim().toUpperCase() !== service.code) {
    const dup = await prisma.service.findUnique({ where: { code: data.code.trim().toUpperCase() } })
    if (dup) throw { status: 409, message: 'Mã dịch vụ đã tồn tại' }
  }

  if (data.serviceGroupId && data.serviceGroupId !== service.serviceGroupId) {
    const group = await prisma.serviceGroup.findUnique({ where: { id: data.serviceGroupId } })
    if (!group) throw { status: 404, message: 'Nhóm dịch vụ không tồn tại' }
  }

  await prisma.service.update({
    where: { id },
    data: {
      code:           data.code ? data.code.trim().toUpperCase() : service.code,
      name:           data.name?.trim() ?? service.name,
      description:    data.description !== undefined ? (data.description?.trim() || null) : service.description,
      duration:       data.duration !== undefined ? data.duration : service.duration,
      serviceGroupId: data.serviceGroupId ?? service.serviceGroupId,
    },
  })

  await logAction('UPDATE_SERVICE', `Cập nhật dịch vụ: ${service.code} – ${service.name}`, adminId, ip)
}

export const deleteService = async (id: number, adminId: number, ip: string) => {
  const service = await prisma.service.findUnique({ where: { id } })
  if (!service) throw { status: 404, message: 'Không tìm thấy dịch vụ' }

  if (service.usageCount > 0)
    throw {
      status: 400,
      message: `Không thể xóa dịch vụ đã có ${service.usageCount.toLocaleString('vi-VN')} lượt sử dụng. Hãy chuyển sang "Ngừng sử dụng" thay thế.`,
    }

  await prisma.service.delete({ where: { id } })
  await logAction('DELETE_SERVICE', `Xóa dịch vụ: ${service.code} – ${service.name}`, adminId, ip)
}

export const changeServiceStatus = async (
  id: number,
  newStatus: string,
  adminId: number,
  ip: string
) => {
  const service = await prisma.service.findUnique({ where: { id } })
  if (!service) throw { status: 404, message: 'Không tìm thấy dịch vụ' }

  const allowed = VALID_TRANSITIONS[service.status] ?? []
  if (!allowed.includes(newStatus))
    throw {
      status: 400,
      message: `Không thể chuyển từ "${STATUS_LABELS[service.status]}" sang "${STATUS_LABELS[newStatus]}"`,
    }

  const updateData: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'ACTIVE' && !service.activatedAt) updateData.activatedAt = new Date()

  await prisma.service.update({ where: { id }, data: updateData })
  await logAction(
    'CHANGE_SERVICE_STATUS',
    `${service.code}: ${STATUS_LABELS[service.status]} → ${STATUS_LABELS[newStatus]}`,
    adminId,
    ip
  )
}
