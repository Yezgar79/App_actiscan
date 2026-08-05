import { create } from "zustand"
import api, { storeTokens, clearTokens } from "@/lib/api"

interface User {
  id: string
  name: string
  email: string
  role: "super_admin" | "admin" | "auditor" | "viewer"
  assigned_location?: string
  employee_number?: string
  is_active?: boolean
  last_login?: string
}

interface AuthState {
  user: User | null
  loading: boolean
  initialized: boolean   // true una vez que fetchMe terminó (éxito o fallo)
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  login: async (email, password) => {
    set({ loading: true })
    try {
      const { data } = await api.post("/api/auth/login", { email, password })
      await storeTokens(data.access_token, data.refresh_token)
      const me = await api.get("/api/auth/me")
      set({ user: me.data, loading: false, initialized: true })
    } catch (err) {
      set({ loading: false })
      throw err
    }
  },

  logout: async () => {
    await clearTokens()
    set({ user: null, initialized: true })
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get("/api/auth/me")
      set({ user: data, initialized: true })
    } catch {
      // Token inválido o expirado — limpiar sesión
      await clearTokens()
      set({ user: null, initialized: true })
    }
  },
}))
