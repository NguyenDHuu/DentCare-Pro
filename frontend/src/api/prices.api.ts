import { api } from './auth.api'

export interface CurrentPrice {
  id:             number
  basePrice:      number
  discountPct:    number
  effectivePrice: number
  startDate:      string
  endDate:        string | null
  status:         'ACTIVE' | 'EXPIRING_SOON'
  daysLeft:       number | null
}

export interface UpcomingPrice {
  id:             number
  basePrice:      number
  discountPct:    number
  effectivePrice: number
  startDate:      string   // date it will become active
  endDate:        string | null
}

/** One row per service: current active price + optional upcoming price */
export interface PriceEntry {
  serviceId:    number
  serviceCode:  string
  serviceName:  string
  groupId:      number
  groupName:    string
  currentPrice:  CurrentPrice  | null   // null = no price in effect right now
  upcomingPrice: UpcomingPrice | null   // null = no future price planned
}

export interface PriceHistoryItem {
  id:             number
  basePrice:      number
  discountPct:    number
  effectivePrice: number
  startDate:      string
  endDate:        string | null
  status:         string
  daysLeft:       number | null
  createdAt:      string
}

export interface PriceHistory {
  serviceName: string
  serviceCode: string
  history:     PriceHistoryItem[]
}

export const priceApi = {
  getPrices:   (params?: { search?: string; groupId?: number; status?: string }) =>
    api.get<PriceEntry[]>('/prices', { params }),
  getHistory:  (serviceId: number) =>
    api.get<PriceHistory>(`/prices/${serviceId}/history`),
  createPrice: (data: { serviceId: number; basePrice: number; discountPct: number; startDate: string; endDate?: string }) =>
    api.post('/prices', data),
  updatePrice: (id: number, data: { basePrice?: number; discountPct?: number; startDate?: string; endDate?: string | null }) =>
    api.put(`/prices/${id}`, data),
}
