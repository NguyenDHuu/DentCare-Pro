import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:5000/api',
})

// Gắn token vào mọi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Tự động logout khi token hết hạn (401) hoặc không có quyền (403 toàn cục)
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      localStorage.removeItem('activeRole')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Auth APIs
export const authApi = {
  checkSetup:     () => api.get('/auth/check-setup'),
  setup:          (data: any) => api.post('/auth/setup', data),
  register:       (data: any) => api.post('/auth/register', data),
  login:          (data: any) => api.post('/auth/login', data),
  changePassword: (data: any) => api.post('/auth/change-password', data),
  forgotPassword: (data: any) => api.post('/auth/forgot-password', data),
  resetPassword:  (data: any) => api.post('/auth/reset-password', data),
  logout:         () => api.post('/auth/logout'),
  getStats:        () => api.get('/auth/stats'),
  getUsers:        () => api.get('/auth/users'),
  createStaff:     (data: { fullName: string; username: string; email: string; password: string; roles: string[] }) =>
                     api.post('/auth/users', data),
  getUserById:     (id: number) => api.get(`/auth/users/${id}`),
  updateUserRoles: (id: number, roles: string[]) => api.put(`/auth/users/${id}/roles`, { roles }),
  updateProfile:   (id: number, data: Record<string, any>) =>
                     api.put(`/auth/users/${id}/profile`, data),
  uploadAvatar:    (id: number, file: File) => {
                     const form = new FormData()
                     form.append('avatar', file)
                     return api.post(`/auth/users/${id}/avatar`, form)
                   },
  adminResetPassword: (id: number, newPassword: string) =>
                     api.post(`/auth/users/${id}/reset-password`, { newPassword }),
  sendEmail:       (id: number, subject: string, content: string, files: File[]) => {
                     const form = new FormData()
                     form.append('subject', subject)
                     form.append('content', content)
                     files.forEach(f => form.append('files', f))
                     return api.post(`/auth/users/${id}/send-email`, form)
                   },
  toggleStatus:    (id: number, isActive: boolean, reason?: string) =>
                     api.patch(`/auth/users/${id}/status`, { isActive, reason }),

  deleteUser:      (id: number) => api.delete(`/auth/users/${id}`),

  // UC07: Nhật ký hoạt động
  getLogs: (params: Record<string, string | number | undefined>) =>
    api.get('/auth/logs', { params }),
  exportLogs: async (params: Record<string, string | undefined>) => {
    const res = await api.get('/auth/logs/export', {
      params,
      responseType: 'blob',
    })
    const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `nhat-ky-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  },

  // Bằng cấp & Chứng chỉ
  getCertificates:    (id: number) => api.get(`/auth/users/${id}/certificates`),
  uploadCertificate:  (id: number, file: File) => {
                        const form = new FormData()
                        form.append('file', file)
                        return api.post(`/auth/users/${id}/certificates`, form)
                      },
  deleteCertificate:  (id: number, certId: number) => api.delete(`/auth/users/${id}/certificates/${certId}`),
}