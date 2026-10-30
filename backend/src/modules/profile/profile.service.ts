import { PrismaClient } from '@prisma/client'
import { logAction } from '../../utils/logger'

const prisma = new PrismaClient()

// ─── GET: Hồ sơ của chính mình ────────────────────────────────
export const getMyProfile = async (userId: number) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: { include: { role: true } },
      adminProfile: true,
      logs: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { action: true, detail: true, createdAt: true, status: true, ip: true },
      },
    },
  })
  if (!user) throw new Error('USER_NOT_FOUND')
  return user
}

// ─── PUT: Cập nhật hồ sơ cá nhân ─────────────────────────────
export const updateMyProfile = async (
  userId: number,
  data: {
    fullName?: string
    phone?: string
    gender?: string
    dateOfBirth?: string | null
    address?: string
    nationalId?: string
    issueDate?: string | null
    issuePlace?: string
    hometown?: string
    maritalStatus?: string
    emergencyContactName?: string
    emergencyContactPhone?: string
    notes?: string
    specialization?: string
    degree?: string
    educationLevel?: string
    graduatedSchool?: string
    graduationYear?: number | null
    certificateNumber?: string
    certificateIssueDate?: string | null
    certificateExpiryDate?: string | null
    yearsOfExperience?: number | null
    professionalSkills?: string[]
    systemPermissions?: string[]
    languages?: string[]
    employmentStatus?: string
    position?: string
    department?: string
    branch?: string
    workType?: string
    startDate?: string | null
    endDate?: string | null
    contractNumber?: string
    workingNote?: string
    qualificationFiles?: string[]
    identityFiles?: string[]
    contractFiles?: string[]
    profileDocuments?: string[]
  },
  ip: string
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('USER_NOT_FOUND')

  if (data.fullName !== undefined) {
    await prisma.user.update({ where: { id: userId }, data: { fullName: data.fullName } })
  }

  const profileData: Record<string, any> = {}

  const strFields = [
    'phone', 'gender', 'address', 'nationalId', 'issuePlace', 'hometown',
    'maritalStatus', 'emergencyContactName', 'emergencyContactPhone', 'notes',
    'specialization', 'degree', 'educationLevel', 'graduatedSchool',
    'certificateNumber', 'employmentStatus', 'position', 'department',
    'branch', 'workType', 'contractNumber', 'workingNote',
  ]
  for (const f of strFields) {
    if ((data as any)[f] !== undefined) profileData[f] = (data as any)[f]
  }

  const dateFields = [
    'dateOfBirth', 'issueDate', 'certificateIssueDate',
    'certificateExpiryDate', 'startDate', 'endDate',
  ]
  for (const f of dateFields) {
    if ((data as any)[f] !== undefined) {
      profileData[f] = (data as any)[f] ? new Date((data as any)[f]) : null
    }
  }

  const numFields = ['graduationYear', 'yearsOfExperience']
  for (const f of numFields) {
    if ((data as any)[f] !== undefined) profileData[f] = (data as any)[f]
  }

  const jsonFields = [
    'professionalSkills', 'systemPermissions', 'languages',
    'qualificationFiles', 'identityFiles', 'contractFiles', 'profileDocuments',
  ]
  for (const f of jsonFields) {
    if ((data as any)[f] !== undefined) profileData[f] = (data as any)[f]
  }

  await prisma.adminProfile.upsert({
    where: { userId },
    update: profileData,
    create: { userId, ...profileData },
  })

  await logAction('UPDATE_PROFILE', `Cập nhật hồ sơ cá nhân`, userId, ip)
}
