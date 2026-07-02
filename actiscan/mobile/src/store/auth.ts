import { create } from "zustand"
import api, { storeTokens, clearTokens } from "@/lib/api"

interface User {
  id: string
  name: string
  email: string
  role: "admin" | "auditor" | "viewer"
  assigned_location?: string
}

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,

  login: async (email, password) => {
    set({ loading: true })
    try {
      const { data } = await api.post("/api/auth/login", { email, password })
      await storeTokens(data.access_token, data.refresh_token)
      const me = await api.get("/api/auth/me")
      set({ user: me.data, loading: false })
    } catch (err) {
      set({ loading: false })
      throw err
    }
  },

  logout: async () => {
    await clearTokens()
    set({ user: null })
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get("/api/auth/me")
      set({ user: data })
    } catch {
      set({ user: null })
    }
  },
}))
