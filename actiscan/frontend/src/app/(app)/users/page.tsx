"use client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"
import api from "@/lib/api"
import { User } from "@/types"
import { Button, Card, Spinner, EmptyState } from "@/components/ui"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ShieldCheck, UserX, UserCheck } from "lucide-react"

export default function UsersPage() {
  const qc = useQueryClient()
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

  const ROLE_BADGE: Record<string, string> = {
    admin:   "bg-purple-100 text-purple-800",
    auditor: "bg-blue-100 text-blue-800",
    viewer:  "bg-gray-100 text-gray-600",
  }

  return (
    <div>
      <div className="page-header">
        <h1>Usuarios</h1>
        <p>Gestión de accesos al sistema</p>
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

      <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
        <ShieldCheck size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-800">Registro de nuevos usuarios</p>
          <p className="text-xs text-blue-600 mt-0.5">
            Los usuarios se registran vía <code className="bg-blue-100 px-1 rounded">POST /api/auth/register</code>. Solo admins pueden cambiar roles y estados.
          </p>
        </div>
      </div>
    </div>
  )
}
