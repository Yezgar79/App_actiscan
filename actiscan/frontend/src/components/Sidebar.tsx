"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth"
import { clsx } from "clsx"
import {
  LayoutDashboard, Package, QrCode, ClipboardCheck,
  Users, MapPin, Tag, LogOut, ShieldCheck
} from "lucide-react"

const navItems = [
  { href: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
  { href: "/assets",     label: "Activos",    icon: Package },
  { href: "/audits",     label: "Auditorías", icon: ClipboardCheck },
]

const adminItems = [
  { href: "/users",      label: "Usuarios",   icon: Users },
  { href: "/locations",  label: "Ubicaciones", icon: MapPin },
  { href: "/categories", label: "Categorías", icon: Tag },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  return (
    <aside className="w-60 min-h-screen bg-brand-700 text-white flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center">
            <QrCode size={18} className="text-white" />
          </div>
          <div>
            <p className="font-semibold text-base leading-none">ActiScan</p>
            <p className="text-xs text-white/50 mt-0.5">Gestión de activos</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                active
                  ? "bg-white/15 text-white font-medium"
                  : "text-white/65 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          )
        })}

        {user?.role === "admin" && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-xs text-white/35 uppercase tracking-wider font-medium flex items-center gap-1">
                <ShieldCheck size={11} /> Administración
              </p>
            </div>
            {adminItems.map((item) => {
              const Icon = item.icon
              const active = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                    active
                      ? "bg-white/15 text-white font-medium"
                      : "text-white/65 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-xs font-semibold">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-white/50 capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors px-1 py-1"
        >
          <LogOut size={13} /> Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
