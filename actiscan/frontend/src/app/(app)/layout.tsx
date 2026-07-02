"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Sidebar from "@/components/Sidebar"
import { useAuthStore } from "@/store/auth"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, fetchMe } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (!token) { router.push("/login"); return }
    if (!user) fetchMe()
  }, [])

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gray-300 border-t-brand-700 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
