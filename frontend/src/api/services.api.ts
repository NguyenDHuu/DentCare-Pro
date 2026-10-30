import { api } from './auth.api'

export interface Doctor {
  id: number
  fullName: string
}

export interface ServiceGroup {
  id: number
  name: string
  description: string | null
  serviceCount: number
  doctors: Doctor[]
}

export interface GroupService {
  id: number
  code: string
  name: string
  status: string
}

export interface Service {
  id: number
  code: string
  name: string
  description: string | null
  duration: number        // phút, 0 = chưa cấu hình
  status: string
  usageCount: number
  activatedAt: string | null
  serviceGroupId: number
  serviceGroup: { id: number; name: string }
  createdAt: string
  updatedAt: string
}

export const serviceApi = {
  // UC08
  getDoctors:       () => api.get<Doctor[]>('/services/doctors'),
  getGroups:        (search?: string) =>
    api.get<ServiceGroup[]>('/services/groups', { params: search ? { search } : undefined }),
  createGroup:      (data: { name: string; description?: string; doctorIds: number[] }) =>
    api.post('/services/groups', data),
  updateGroup:      (id: number, data: { name?: string; description?: string; doctorIds?: number[] }) =>
    api.put(`/services/groups/${id}`, data),
  deleteGroup:      (id: number) => api.delete(`/services/groups/${id}`),
  getGroupServices: (id: number) =>
    api.get<{ groupName: string; services: GroupService[] }>(`/services/groups/${id}/services`),

  // UC09
  getServices:     (params?: { search?: string; groupId?: number; status?: string }) =>
    api.get<Service[]>('/services', { params }),
  getServiceById:  (id: number) => api.get<Service>(`/services/${id}`),
  createService:   (data: { code: string; name: string; serviceGroupId: number; description?: string; duration?: number }) =>
    api.post('/services', data),
  updateService:   (id: number, data: { code?: string; name?: string; serviceGroupId?: number; description?: string; duration?: number }) =>
    api.put(`/services/${id}`, data),
  changeStatus:    (id: number, status: string) =>
    api.patch(`/services/${id}/status`, { status }),
  deleteService:   (id: number) => api.delete(`/services/${id}`),
}
