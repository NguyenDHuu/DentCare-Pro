import { create } from 'zustand'
import { authApi } from '../api/auth.api'

interface User {
  id: number
  fullName: string
  username: string
  email: string
  roles: string[]
}

interface AuthState {
  token: string | null
  user: User | null
  activeRole: string | null
  setAuth: (token: string, user: User) => void
  setActiveRole: (role: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  activeRole: localStorage.getItem('activeRole'),

  setAuth: (token, user) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    set({ token, user })
  },

  setActiveRole: (role) => {
    localStorage.setItem('activeRole', role)
    set({ activeRole: role })
  },

  logout: () => {
    authApi.logout().catch(() => {})
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('activeRole')
    set({ token: null, user: null, activeRole: null })
  },
}))