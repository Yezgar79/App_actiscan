"use client"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import toast from "react-hot-toast"
import api from "@/lib/api"
import { Asset, Category, Location, User } from "@/types"
import { Button, Input, Select, Modal, AssetStatusBadge, EmptyState, Spinner, Card } from "@/components/ui"
import { Plus, Search, QrCode, Pencil, Trash2, History } from "lucide-react"

const schema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  description: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  acquisition_value: z.coerce.number().optional(),
  status: z.enum(["operativo", "mantenimiento", "baja", "no_localizado"]),
  category_id: z.string().optional(),
  location_id: z.string().optional(),
  responsible_id: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function AssetsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [editAsset, setEditAsset] = useState<Asset | null>(null)
  const [qrAsset, setQrAsset] = useState<Asset | null>(null)

  const { data: assets, isLoading } = useQuery<Asset[]>({
    queryKey: ["assets", search, filterStatus],
    queryFn: () =>
      api.get("/api/assets", { params: { search: search || undefined, status: filterStatus || undefined } })
        .then((r) => r.data),
  })

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api.get("/api/categories").then((r) => r.data),
  })

  const { data: locations } = useQuery<Location[]>({
    queryKey: ["locations"],
    queryFn: () => api.get("/api/locations").then((r) => r.data),
  })

  const { data: users } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => api.get("/api/users").then((r) => r.data),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "operativo" },
  })

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      editAsset
        ? api.put(`/api/assets/${editAsset.id}`, data)
        : api.post("/api/assets", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
      toast.success(editAsset ? "Activo actualizado" : "Activo registrado")
      setShowModal(false)
      setEditAsset(null)
      reset()
    },
    onError: () => toast.error("Error al guardar el activo"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/assets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] })
      toast.success("Activo eliminado")
    },
    onError: () => toast.error("Sin permiso para eliminar"),
  })

  const openEdit = (asset: Asset) => {
    setEditAsset(asset)
    reset({
      name: asset.name,
      description: asset.description ?? "",
      brand: asset.brand ?? "",
      model: asset.model ?? "",
      serial_number: asset.serial_number ?? "",
      acquisition_value: asset.acquisition_value ?? undefined,
      status: asset.status,
      category_id: asset.category?.id ?? "",
      location_id: asset.location?.id ?? "",
      responsible_id: asset.responsible_user?.id ?? "",
    })
    setShowModal(true)
  }

  return (
    <div>
      <div className="page-header flex items-start justify-between">
        <div>
          <h1>Activos</h1>
          <p>{assets?.length ?? 0} activos registrados</p>
        </div>
        <Button onClick={() => { setEditAsset(null); reset(); setShowModal(true) }}>
          <Plus size={16} /> Nuevo activo
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Buscar por nombre, código o marca..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Todos los estados</option>
            <option value="operativo">Operativo</option>
            <option value="mantenimiento">Mantenimiento</option>
            <option value="no_localizado">No localizado</option>
            <option value="baja">Baja</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : assets?.length === 0 ? (
          <EmptyState title="Sin activos" description="Registra el primer activo del inventario" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs text-gray-500">
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Categoría</th>
                  <th className="px-4 py-3 font-medium">Ubicación</th>
                  <th className="px-4 py-3 font-medium">Responsable</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {assets?.map((asset) => (
                  <tr key={asset.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-brand-700">{asset.code}</td>
                    <td className="px-4 py-3 font-medium">{asset.name}
                      {asset.brand && <span className="block text-xs text-gray-400">{asset.brand} {asset.model}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{asset.category?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{asset.location?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{asset.responsible_user?.name ?? "—"}</td>
                    <td className="px-4 py-3"><AssetStatusBadge status={asset.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setQrAsset(asset)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-brand-700 transition-colors" title="Ver QR">
                          <QrCode size={15} />
                        </button>
                        <button onClick={() => openEdit(asset)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-brand-700 transition-colors" title="Editar">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => confirm("¿Eliminar este activo?") && deleteMutation.mutate(asset.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600 transition-colors" title="Eliminar">
                          <Trash2 size={15} />
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

      {/* Create/Edit Modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setEditAsset(null) }} title={editAsset ? "Editar activo" : "Registrar activo"}>
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-3">
          <Input label="Nombre *" error={errors.name?.message} {...register("name")} placeholder="Ej. Laptop Dell XPS 15" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Marca" {...register("brand")} placeholder="Dell" />
            <Input label="Modelo" {...register("model")} placeholder="XPS 15 9500" />
          </div>
          <Input label="Número de serie" {...register("serial_number")} placeholder="SN-XXXXXXX" />
          <Input label="Valor de adquisición (MXN)" type="number" {...register("acquisition_value")} placeholder="15000" />
          <Select
            label="Estado"
            {...register("status")}
            options={[
              { value: "operativo", label: "Operativo" },
              { value: "mantenimiento", label: "Mantenimiento" },
              { value: "baja", label: "Baja" },
              { value: "no_localizado", label: "No localizado" },
            ]}
          />
          <Select
            label="Categoría"
            {...register("category_id")}
            options={categories?.map((c) => ({ value: c.id, label: c.name })) ?? []}
          />
          <Select
            label="Ubicación"
            {...register("location_id")}
            options={locations?.map((l) => ({ value: l.id, label: l.name })) ?? []}
          />
          <Select
            label="Responsable"
            {...register("responsible_id")}
            options={users?.map((u) => ({ value: u.id, label: u.name })) ?? []}
          />
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" className="flex-1 justify-center" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1 justify-center" loading={createMutation.isPending}>
              {editAsset ? "Guardar cambios" : "Registrar activo"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* QR Modal */}
      <Modal open={!!qrAsset} onClose={() => setQrAsset(null)} title={`QR — ${qrAsset?.code}`}>
        {qrAsset?.qr_code_url && (
          <div className="flex flex-col items-center gap-4">
            <img src={qrAsset.qr_code_url} alt={`QR ${qrAsset.code}`} className="w-52 h-52" />
            <p className="text-sm text-gray-500">{qrAsset.name}</p>
            <Button variant="secondary" onClick={() => {
              const a = document.createElement("a")
              a.href = qrAsset.qr_code_url!
              a.download = `${qrAsset.code}.png`
              a.click()
            }}>Descargar QR</Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
