"use client"
import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth"
import { clsx } from "clsx"
import { useMutation } from "@tanstack/react-query"
import toast from "react-hot-toast"
import api from "@/lib/api"
import { Button, Input, Modal } from "@/components/ui"
import {
  IconLayoutDashboard, IconCube, IconQrCode, IconClipboardCheck,
  IconUsers, IconMapPin, IconTag, IconLogOut,
  IconShieldCheck, IconShieldAlert, IconChartBar, IconKey,
} from "@/components/icons"

const navItems = [
  { href: "/dashboard",  label: "Dashboard",  icon: IconLayoutDashboard },
  { href: "/assets",     label: "Activos",    icon: IconCube },
  { href: "/audits",     label: "Auditorías", icon: IconClipboardCheck },
]

const adminItems = [
  { href: "/users",      label: "Usuarios",   icon: IconUsers },
  { href: "/locations",  label: "Ubicaciones", icon: IconMapPin },
  { href: "/categories", label: "Categorías", icon: IconTag },
]

function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current,  setCurrent]  = useState("")
  const [next,     setNext]     = useState("")
  const [confirm,  setConfirm]  = useState("")
  const [showPwd,  setShowPwd]  = useState(false)

  const reset = () => { setCurrent(""); setNext(""); setConfirm("") }

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/api/auth/change-password", { current_password: current, new_password: next }),
    onSuccess: () => {
      toast.success("Contraseña actualizada correctamente")
      reset()
      onClose()
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      toast.error(detail ?? "No se pudo cambiar la contraseña")
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!current.trim() || !next.trim() || !confirm.trim()) {
      toast.error("Completa todos los campos"); return
    }
    if (next.length < 8) {
      toast.error("La nueva contraseña debe tener al menos 8 caracteres"); return
    }
    if (next !== confirm) {
      toast.error("La nueva contraseña y su confirmación no coinciden"); return
    }
    mutation.mutate()
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Cambiar contraseña">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-500">
          Elige una contraseña segura de al menos 8 caracteres. No puede ser igual a la actual.
        </p>

        <div className="relative">
          <Input
            label="Contraseña actual"
            type={showPwd ? "text" : "password"}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="Tu contraseña actual"
            autoComplete="current-password"
          />
        </div>

        <Input
          label="Nueva contraseña"
          type={showPwd ? "text" : "password"}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="Mínimo 8 caracteres"
          helperText={next.length > 0 && next.length < 8 ? `Faltan ${8 - next.length} caracteres` : undefined}
          autoComplete="new-password"
        />

        <Input
          label="Confirmar nueva contraseña"
          type={showPwd ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repite la nueva contraseña"
          autoComplete="new-password"
        />

        <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none">
          <input type="checkbox" checked={showPwd} onChange={(e) => setShowPwd(e.target.checked)} className="rounded" />
          Mostrar contraseñas
        </label>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="secondary" className="flex-1 justify-center" onClick={() => { reset(); onClose() }}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1 justify-center" loading={mutation.isPending}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [showChangePwd, setShowChangePwd] = useState(false)

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  return (
    <>
      <aside className="w-60 min-h-screen bg-brand-700 text-white flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center">
              <IconQrCode size={18} className="text-white" />
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

          {(user?.role === "admin" || user?.role === "super_admin") && (
            <>
              <div className="pt-4 pb-1 px-3">
                <p className="text-xs text-white/35 uppercase tracking-wider font-medium flex items-center gap-1">
                  <IconShieldCheck size={11} /> Administración
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

          {user?.role === "super_admin" && (
            <>
              <div className="pt-4 pb-1 px-3">
                <p className="text-xs text-amber-300/60 uppercase tracking-wider font-medium flex items-center gap-1">
                  <IconShieldAlert size={11} /> Super Admin
                </p>
              </div>
              <Link
                href="/super-admin"
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  pathname.startsWith("/super-admin")
                    ? "bg-amber-400/20 text-amber-200 font-medium"
                    : "text-amber-300/70 hover:bg-amber-400/10 hover:text-amber-200"
                )}
              >
                <IconChartBar size={16} />
                Panel de Control
              </Link>
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
              <p className="text-xs text-white/50 capitalize">{user?.role === "super_admin" ? "Super Admin" : user?.role}</p>
            </div>
          </div>
          <div className="space-y-0.5">
            <button
              onClick={() => setShowChangePwd(true)}
              className="w-full flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors px-1 py-1.5 rounded hover:bg-white/5"
            >
              <IconKey size={13} /> Cambiar contraseña
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors px-1 py-1 rounded hover:bg-white/5"
            >
              <IconLogOut size={13} /> Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      <ChangePasswordModal open={showChangePwd} onClose={() => setShowChangePwd(false)} />
    </>
  )
}
