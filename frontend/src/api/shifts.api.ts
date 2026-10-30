import { api } from './auth.api'

export interface WorkShift {
  id:           number
  name:         string
  startTime:    string  // "HH:MM"
  endTime:      string  // "HH:MM"
  slotDuration: number  // phút / lịch hẹn (slot cơ bản)
  bufferTime:   number  // phút đệm giữa hai lịch hẹn (0/5/10/15)
  maxPatients:  number  // số BN tối đa / bác sĩ / ca
  reserveSlots: number  // slot dự phòng cấp cứu / bác sĩ / ca
  applyDays:    number[] // 2=T2…7=T7, 0=CN
  isActive:     boolean
  colorCode:    string
  createdAt:    string
  updatedAt:    string
}

export type ShiftInput = Pick<
  WorkShift,
  'name' | 'startTime' | 'endTime' | 'slotDuration' | 'bufferTime' |
  'maxPatients' | 'reserveSlots' | 'applyDays' | 'colorCode'
>

export const shiftApi = {
  getAll:  ()                        => api.get<WorkShift[]>('/shifts'),
  create:  (data: ShiftInput)        => api.post<WorkShift>('/shifts', data),
  update:  (id: number, data: ShiftInput) => api.put(`/shifts/${id}`, data),
  delete:  (id: number)              => api.delete(`/shifts/${id}`),
  toggle:  (id: number)              => api.patch<{ isActive: boolean }>(`/shifts/${id}/toggle`),
}
