import { api } from './auth.api'

export interface AdminProfileData {
  // User
  id: number
  fullName: string
  username: string
  email: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  roles: { role: { name: string } }[]
  // AdminProfile (tất cả có thể null)
  adminProfile: {
    phone: string | null
    gender: string | null
    dateOfBirth: string | null
    address: string | null
    avatar: string | null
    nationalId: string | null
    issueDate: string | null
    issuePlace: string | null
    hometown: string | null
    maritalStatus: string | null
    emergencyContactName: string | null
    emergencyContactPhone: string | null
    notes: string | null
    specialization: string | null
    degree: string | null
    educationLevel: string | null
    graduatedSchool: string | null
    graduationYear: number | null
    certificateNumber: string | null
    certificateIssueDate: string | null
    certificateExpiryDate: string | null
    yearsOfExperience: number | null
    professionalSkills: string[] | null
    systemPermissions: string[] | null
    languages: string[] | null
    employmentStatus: string | null
    position: string | null
    department: string | null
    branch: string | null
    workType: string | null
    startDate: string | null
    endDate: string | null
    contractNumber: string | null
    workingNote: string | null
    qualificationFiles: string[] | null
    identityFiles: string[] | null
    contractFiles: string[] | null
    profileDocuments: string[] | null
    createdAt: string
    updatedAt: string
  } | null
  // Hoạt động gần đây
  logs: {
    action: string
    detail: string | null
    createdAt: string
    status: string
    ip: string | null
  }[]
}

export type UpdateProfilePayload = {
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
}

export const profileApi = {
  getMyProfile: () => api.get<AdminProfileData>('/profile'),
  updateMyProfile: (data: UpdateProfilePayload) => api.put('/profile', data),
}
