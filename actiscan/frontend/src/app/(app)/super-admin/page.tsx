"use client"
import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import toast from "react-hot-toast"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  Users, Package, ClipboardCheck, MapPin, Tag, Activity,
  Plus, Pencil, Trash2, UserCheck, UserX, ShieldAlert,
  KeyRound, BarChart3, RefreshCw,
} from "lucide-react"
import api from "@/lib/api"
import { useAuthStore } from "@/store/auth"
import { User, SystemStats } from "@/types"
import { Button, Card, Input, Select, Modal, Spinner, EmptyState } from "@/components/ui"

const createUserSchema = z.object({
  name:              z.string().min(2, "Mínimo 2 caracteres"),
  email:             z.string().email("Correo inválido"),
  password:          z.string().min(8, "Mínimo 8 caracteres"),
  role:              z.enum(["super_admin", "admin", "auditor", "viewer"]),
  assigned_location: z.string().optional(),
})
type CreateUserForm = z.infer<typeof createUserSchema>

const editUserSchema = z.object({
  name:              z.string().min(2, "Mínimo 2 caracteres"),
  email:             z.string().email("Correo inválido"),
  password:          z.string().optional().refine((v) => !v || v.length >= 8, { message: "Mínimo 8 caracteres" }),
  role:              z.enum(["super_admin", "admin", "auditor", "viewer"]),
  assigned_location: z.string().optional(),
  is_active:         z.boolean(),
})
type EditUserForm = z.infer<typeof editUserSchema>

// ─── Role config ──────────────────────────────────────────────────────────────
const ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin",       label: "Admin" },
  { value: "auditor",     label: "Auditor" },
  { value: "viewer",      label: "Viewer" },
]

const ROLE_BADGE: Record<string, string> = {
  super_admin: "bg-amber-100 text-amber-800",
  admin:       "bg-purple-100 text-purple-800",
  auditor:     "bg-blue-100 text-blue-800",
  viewer:      "bg-gray-100 text-gray-600",
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin:       "Admin",
  auditor:     "Auditor",
  viewer:      "Viewer",
}

const MOVEMENT_TYPE_LABEL: Record<string, string> = {
  ubicacion:   "Ubicación",
  responsable: "Responsable",
  estado:      "Estado",
  registro:    "Registro",
  auditoria:   "Auditoría",
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function BigStatCard({
  icon: Icon, label, value, sub, accent = "brand",
}: {
  icon: React.ElementType
  label: string
  value: number | string
  sub?: string
  accent?: "brand" | "amber" | "green" | "blue" | "red"
}) {
  const colors: Record<string, string> = {
    brand: "bg-brand-50 text-brand-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-green-50 text-green-700",
    blue:  "bg-blue-50 text-blue-700",
    red:   "bg-red-50 text-red-700",
  }
  return (
    <Card className="flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colors[accent]}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </Card>
  )
}

// ─── Role distribution bar ────────────────────────────────────────────────────
function RoleBar({ label, count, total, cls }: { label: string; count: number; total: number; cls: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span className="font-medium">{count} <span className="text-gray-400">({pct}%)</span></span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${cls}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
type Tab = "overview" | "users" | "activity"

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SuperAdminPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const qc = useQueryClient()

  const [tab, setTab] = useState<Tab>("overview")
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [search, setSearch] = useState("")

  // Protect route
  useEffect(() => {
    if (user && user.role !== "super_admin") router.replace("/dashboard")
  }, [user, router])

  // ── Queries ──
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<SystemStats>({
    queryKey: ["sa-stats"],
    queryFn: () => api.get("/api/super-admin/stats").then((r) => r.data),
    enabled: !!user && user.role === "super_admin",
  })

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["sa-users"],
    queryFn: () => api.get("/api/super-admin/users").then((r) => r.data),
    enabled: !!user && user.role === "super_admin",
  })

  const { data: movements, isLoading: movementsLoading } = useQuery<any[]>({
    queryKey: ["sa-movements"],
    queryFn: () => api.get("/api/super-admin/movements?limit=80").then((r) => r.data),
    enabled: !!user && user.role === "super_admin",
  })

  // ── Mutations ──
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sa-users"] })
    qc.invalidateQueries({ queryKey: ["sa-stats"] })
  }

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/api/super-admin/users", data).then((r) => r.data),
    onSuccess: () => { invalidate(); setCreateOpen(false); toast.success("Usuario creado") },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error al crear usuario"),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.put(`/api/super-admin/users/${id}`, data).then((r) => r.data),
    onSuccess: () => { invalidate(); setEditTarget(null); toast.success("Usuario actualizado") },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error al actualizar"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/super-admin/users/${id}`),
    onSuccess: () => { invalidate(); setDeleteTarget(null); toast.success("Usuario eliminado") },
    onError: (e: any) => toast.error(e?.response?.data?.detail ?? "Error al eliminar"),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.put(`/api/super-admin/users/${id}`, { is_active }),
    onSuccess: () => invalidate(),
    onError: () => toast.error("Error al cambiar estado"),
  })

  const filteredUsers = users?.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  )

  if (!user || user.role !== "super_admin") return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <ShieldAlert size={20} className="text-amber-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Panel Super Admin</h1>
            <p className="text-sm text-gray-500">Control total del sistema ActiScan</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => refetchStats()}>
          <RefreshCw size={14} /> Actualizar
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(["overview", "users", "activity"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "overview" ? "Resumen" : t === "users" ? "Usuarios" : "Actividad"}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {statsLoading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : (
            <>
              {/* KPI grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <BigStatCard icon={Users}         label="Total usuarios"  value={stats?.total_users ?? 0}       accent="brand" />
                <BigStatCard icon={Package}       label="Total activos"   value={stats?.total_assets ?? 0}      accent="blue" />
                <BigStatCard icon={ClipboardCheck} label="Auditorías"     value={stats?.total_audits ?? 0}      accent="green" sub={`${stats?.active_audits ?? 0} en curso`} />
                <BigStatCard icon={Activity}      label="Movimientos"     value={stats?.total_movements ?? 0}   accent="amber" />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <BigStatCard icon={UserCheck} label="Usuarios activos"   value={stats?.active_users ?? 0}   accent="green" />
                <BigStatCard icon={UserX}     label="Usuarios inactivos" value={stats?.inactive_users ?? 0} accent="red" />
                <BigStatCard icon={MapPin}    label="Ubicaciones"        value={stats?.total_locations ?? 0} accent="brand" />
                <BigStatCard icon={Tag}       label="Categorías"         value={stats?.total_categories ?? 0} accent="blue" />
              </div>

              {/* Breakdowns */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 size={16} className="text-gray-500" />
                    <h3 className="font-semibold text-gray-800">Usuarios por rol</h3>
                  </div>
                  <div className="space-y-3">
                    {ROLES.map(({ value, label }) => (
                      <RoleBar
                        key={value}
                        label={label}
                        count={stats?.users_by_role?.[value] ?? 0}
                        total={stats?.total_users ?? 1}
                        cls={
                          value === "super_admin" ? "bg-amber-500" :
                          value === "admin"       ? "bg-purple-500" :
                          value === "auditor"     ? "bg-blue-500" :
                                                    "bg-gray-400"
                        }
                      />
                    ))}
                  </div>
                </Card>

                <Card>
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 size={16} className="text-gray-500" />
                    <h3 className="font-semibold text-gray-800">Activos por estado</h3>
                  </div>
                  <div className="space-y-3">
                    {[
                      { key: "operativo",     label: "Operativo",     cls: "bg-green-500" },
                      { key: "mantenimiento", label: "Mantenimiento", cls: "bg-amber-500" },
                      { key: "baja",          label: "Baja",          cls: "bg-gray-400"  },
                      { key: "no_localizado", label: "No localizado", cls: "bg-red-500"   },
                    ].map(({ key, label, cls }) => (
                      <RoleBar
                        key={key}
                        label={label}
                        count={stats?.assets_by_status?.[key] ?? 0}
                        total={stats?.total_assets ?? 1}
                        cls={cls}
                      />
                    ))}
                  </div>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── USERS TAB ── */}
      {tab === "users" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <Button onClick={() => setCreateOpen(true)}>
              <Plus size={15} /> Nuevo usuario
            </Button>
          </div>

          <Card className="overflow-hidden p-0">
            {usersLoading ? (
              <div className="flex justify-center py-16"><Spinner /></div>
            ) : filteredUsers?.length === 0 ? (
              <EmptyState title="Sin usuarios" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-left text-xs text-gray-500">
                      <th className="px-4 py-3 font-medium">Usuario</th>
                      <th className="px-4 py-3 font-medium">Rol</th>
                      <th className="px-4 py-3 font-medium">Sede</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3 font-medium">Registro</th>
                      <th className="px-4 py-3 font-medium text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers?.map((u) => (
                      <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-sm flex-shrink-0">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{u.name}</p>
                              <p className="text-xs text-gray-400">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[u.role]}`}>
                            {ROLE_LABEL[u.role]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{u.assigned_location ?? "—"}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleMutation.mutate({ id: u.id, is_active: !u.is_active })}
                            className={`flex items-center gap-1 text-xs font-medium transition-colors ${
                              u.is_active ? "text-green-600 hover:text-green-800" : "text-red-500 hover:text-red-700"
                            }`}
                          >
                            {u.is_active ? <UserCheck size={13} /> : <UserX size={13} />}
                            {u.is_active ? "Activo" : "Inactivo"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {format(new Date(u.created_at), "dd MMM yyyy", { locale: es })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEditTarget(u)}
                              className="p-1.5 text-gray-400 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(u)}
                              disabled={u.id === user.id}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── ACTIVITY TAB ── */}
      {tab === "activity" && (
        <Card className="overflow-hidden p-0">
          {movementsLoading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : movements?.length === 0 ? (
            <EmptyState title="Sin actividad registrada" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-xs text-gray-500">
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Descripción</th>
                    <th className="px-4 py-3 font-medium">Realizado por</th>
                    <th className="px-4 py-3 font-medium">Valor anterior</th>
                    <th className="px-4 py-3 font-medium">Nuevo valor</th>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {movements?.map((m) => (
                    <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                          {MOVEMENT_TYPE_LABEL[m.movement_type] ?? m.movement_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{m.description}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-xs flex-shrink-0">
                            {m.performed_by_user?.name?.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-gray-600 text-xs">{m.performed_by_user?.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{m.previous_value ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-700 text-xs">{m.new_value ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {format(new Date(m.created_at), "dd MMM yyyy HH:mm", { locale: es })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── CREATE USER MODAL ── */}
      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        loading={createMutation.isPending}
      />

      {/* ── EDIT USER MODAL ── */}
      {editTarget && (
        <EditUserModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSubmit={(data) => updateMutation.mutate({ id: editTarget.id, data })}
          loading={updateMutation.isPending}
        />
      )}

      {/* ── DELETE CONFIRM MODAL ── */}
      {deleteTarget && (
        <Modal open title="Eliminar usuario" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              ¿Estás seguro de que deseas eliminar a{" "}
              <span className="font-semibold text-gray-900">{deleteTarget.name}</span>?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
              <Button
                variant="danger"
                loading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
              >
                <Trash2 size={14} /> Eliminar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Create User Modal ────────────────────────────────────────────────────────
function CreateUserModal({
  open, onClose, onSubmit, loading,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (data: any) => void
  loading: boolean
}) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: "auditor" },
  })

  const close = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={close} title="Crear nuevo usuario">
      <form onSubmit={handleSubmit((d) => onSubmit({ ...d, assigned_location: d.assigned_location || undefined }))} className="space-y-4">
        <Input label="Nombre completo *" error={errors.name?.message} {...register("name")} />
        <Input label="Email *" type="email" error={errors.email?.message} {...register("email")} />
        <Input
          label="Contraseña *"
          type="password"
          error={errors.password?.message}
          helperText="Mínimo 8 caracteres"
          {...register("password")}
        />
        <Select label="Rol *" error={errors.role?.message} {...register("role")} options={ROLES} />
        <Input label="Sede asignada (opcional)" {...register("assigned_location")} />
        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={close}>Cancelar</Button>
          <Button type="submit" loading={loading}>
            <Plus size={14} /> Crear usuario
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Edit User Modal ──────────────────────────────────────────────────────────
function EditUserModal({
  user, onClose, onSubmit, loading,
}: {
  user: User
  onClose: () => void
  onSubmit: (data: any) => void
  loading: boolean
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      name:              user.name,
      email:             user.email,
      password:          "",
      role:              user.role as EditUserForm["role"],
      assigned_location: user.assigned_location ?? "",
      is_active:         user.is_active,
    },
  })

  return (
    <Modal open title={`Editar: ${user.name}`} onClose={onClose}>
      <form
        onSubmit={handleSubmit((d) => {
          const data: any = {
            name:              d.name,
            email:             d.email,
            role:              d.role,
            assigned_location: d.assigned_location || undefined,
            is_active:         d.is_active,
          }
          if (d.password) data.password = d.password
          onSubmit(data)
        })}
        className="space-y-4"
      >
        <Input label="Nombre completo *" error={errors.name?.message} {...register("name")} />
        <Input label="Email *" type="email" error={errors.email?.message} {...register("email")} />
        <Input
          label="Nueva contraseña"
          type="password"
          error={errors.password?.message}
          helperText="Dejar vacío para no cambiar"
          {...register("password")}
        />
        <Select label="Rol" {...register("role")} options={ROLES} />
        <Input label="Sede asignada" {...register("assigned_location")} />
        <div className="flex items-center gap-2">
          <input
            id="is_active"
            type="checkbox"
            {...register("is_active")}
            className="w-4 h-4 rounded border-gray-300 text-brand-700"
          />
          <label htmlFor="is_active" className="text-sm text-gray-700">Usuario activo</label>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>
            <KeyRound size={14} /> Guardar cambios
          </Button>
        </div>
      </form>
    </Modal>
  )
}
