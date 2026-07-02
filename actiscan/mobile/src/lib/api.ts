import axios from "axios"
import * as SecureStore from "expo-secure-store"

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000"

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10_000,
})

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("access_token")
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refresh = await SecureStore.getItemAsync("refresh_token")
        const { data } = await axios.post(`${API_URL}/api/auth/refresh`, {
          refresh_token: refresh,
        })
        await SecureStore.setItemAsync("access_token", data.access_token)
        await SecureStore.setItemAsync("refresh_token", data.refresh_token)
        original.headers.Authorization = `Bearer ${data.access_token}`
        return api(original)
      } catch {
        await SecureStore.deleteItemAsync("access_token")
        await SecureStore.deleteItemAsync("refresh_token")
      }
    }
    return Promise.reject(error)
  }
)

export default api

export const storeTokens = async (access: string, refresh: string) => {
  await SecureStore.setItemAsync("access_token", access)
  await SecureStore.setItemAsync("refresh_token", refresh)
}

export const clearTokens = async () => {
  await SecureStore.deleteItemAsync("access_token")
  await SecureStore.deleteItemAsync("refresh_token")
}
