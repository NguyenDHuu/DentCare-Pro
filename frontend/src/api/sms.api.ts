import { api } from './auth.api'

export interface SmsConfig {
  id:          number
  isEnabled:   boolean
  provider:    string
  apiKey:      string | null
  secretKey:   string | null
  brandname:   string
  dailyLimit:  number
  quietStart:  string
  quietEnd:    string
}

export interface SmsTemplate {
  id:        number
  type:      string
  name:      string
  content:   string
  isEnabled: boolean
  sortOrder: number
}

export interface SmsLog {
  id:            number
  recipientName: string | null
  phone:         string
  type:          string
  status:        string       // PENDING | SUCCESS | FAILED
  content:       string
  retryCount:    number
  errorMsg:      string | null
  sentAt:        string | null
  createdAt:     string
}

export interface SmsStats {
  sentThisMonth: number
  successRate:   number
  failed:        number
  scheduled:     number
  recent:        SmsLog[]
}

export interface SmsLogsResult {
  logs:  SmsLog[]
  total: number
  page:  number
  pages: number
  limit: number
}

export const smsApi = {
  getConfig:      () =>
    api.get<{ config: SmsConfig; templates: SmsTemplate[] }>('/sms/config'),
  updateConfig:   (data: Partial<Omit<SmsConfig, 'id'>>) =>
    api.put<{ message: string }>('/sms/config', data),
  updateTemplate: (type: string, data: { content?: string; isEnabled?: boolean; name?: string }) =>
    api.put<{ message: string }>(`/sms/templates/${type}`, data),
  getStats:       () =>
    api.get<SmsStats>('/sms/stats'),
  getLogs: (params?: {
    page?:          number
    limit?:         number
    type?:          string
    status?:        string
    phone?:         string
    recipientName?: string
    dateFrom?:      string
    dateTo?:        string
  }) => api.get<SmsLogsResult>('/sms/logs', { params }),
  sendTest:       (data: { phone: string; type: string }) =>
    api.post<SmsLog & { templateName: string }>('/sms/test', data),
}
