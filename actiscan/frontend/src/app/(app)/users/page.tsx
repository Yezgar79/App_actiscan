"use client"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import toast from "react-hot-toast"
import api from "@/lib/api"
import { User } from "@/types"
import { Button, Card, Spinner, EmptyState, Input, Select, Modal } from "@/components/ui"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { UserX, UserCheck, Plus } from "lucide-react"

const createUserSchema = z.object({
  name:              z.string().min(2, "Mínimo 2 caracteres"),
  email:             z.string().email("Correo inválido"),
  password:          z.string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Z]/, "Debe incluir al menos una mayúscula")
    .regex(/[a-z]/, "Debe incluir al menos una minúscula")
    .regex(/\d/, "Debe incluir al menos un número")
    .regex(/[!@#$%^&*(),.?":{}|<>_\-]/, "Debe incluir al menos un carácter especial"),
  role:              z.enum(["auditor", "viewer"]),
  assigned_location: z.string().optional(),
})
type CreateUserForm = z.infer<typeof createUserSchema>

const ROLE_BADGE: Record<string, string> = {
  super_admin: "bg-amber-100 text-amber-800",
  admin:       "bg-purple-100 text-purple-800",
  auditor:     "bg-blue-100 text-blue-800",
  viewer:      "bg-gray-100 text-gray-600",
}

const ROLES = [
  { value: "auditor", label: "Auditor" },
  { value: "viewer",  label: "Viewer" },
]

export default function UsersPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => api.get("/api/users").then((r) => r.data),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.put(`/api/users/${id}`, { is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] })
      toast.success("Usuario actualizado")
    },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestión de accesos al sistema</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={15} /> Nuevo usuario
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : users?.length === 0 ? (
          <EmptyState title="Sin usuarios" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Sede asignada</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Registro</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((u) => (
                  <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-sm">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{u.name}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${ROLE_BADGE[u.role]}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{u.assigned_location ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs font-medium ${u.is_active ? "text-green-600" : "text-red-600"}`}>
                        {u.is_active ? <UserCheck size={13} /> : <UserX size={13} />}
                        {u.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {format(new Date(u.created_at), "dd MMM yyyy", { locale: es })}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant={u.is_active ? "danger" : "secondary"}
                        size="sm"
                        onClick={() => toggleMutation.mutate({ id: u.id, is_active: !u.is_active })}
                      >
                        {u.is_active ? "Desactivar" : "Activar"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["users"] })
          setCreateOpen(false)
        }}
      />
    </div>
  )
}

function CreateUserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: "auditor" },
  })

  const mutation = useMutation({
    mutationFn: (data: CreateUserForm) =>
      api.post("/api/users", {
        ...data,
        assigned_location: data.assigned_location || undefined,
      }).then((r) => r.data),
    onSuccess: () => {
      reset()
      toast.success("Usuario creado correctamente")
      onCreated()
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.detail ?? "Error al crear usuario"),
  })

  const close = () => { reset(); onClose() }

  return (
    <Modal open={open} onClose={close} title="Crear nuevo usuario">
      <form
        onSubmit={handleSubmit((d) => mutation.mutate(d))}
        className="space-y-4"
      >
        <Input label="Nombre completo *" error={errors.name?.message} {...register("name")} />
        <Input label="Email *" type="email" error={errors.email?.message} {...register("email")} />
        <Input
          label="Contraseña *"
          type="password"
          error={errors.password?.message}
          helperText="Mín. 8 caracteres, incluir mayúscula, minúscula, número y símbolo"
          {...register("password")}
        />
        <Select label="Rol *" error={errors.role?.message} {...register("role")} options={ROLES} />
        <Input label="Sede asignada (opcional)" {...register("assigned_location")} />
        <p className="text-xs text-gray-400">
          Para crear usuarios con rol <strong>Admin</strong> o <strong>Super Admin</strong>, usa el Panel de Control.
        </p>
        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={close}>Cancelar</Button>
          <Button type="submit" loading={mutation.isPending}>
            <Plus size={14} /> Crear usuario
          </Button>
        </div>
      </form>
    </Modal>
  )
}
