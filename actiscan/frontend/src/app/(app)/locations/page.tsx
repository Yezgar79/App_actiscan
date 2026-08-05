"use client"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import toast from "react-hot-toast"
import api from "@/lib/api"
import { Location, Category } from "@/types"
import { Button, Input, Modal, Card, Spinner, EmptyState } from "@/components/ui"
import { Plus, MapPin, Tag } from "lucide-react"

const locationSchema = z.object({
  name:     z.string().min(2, "Mínimo 2 caracteres"),
  floor:    z.string().optional(),
  building: z.string().optional(),
})
type LocationForm = z.infer<typeof locationSchema>

const categorySchema = z.object({
  name:        z.string().min(2, "Mínimo 2 caracteres"),
  description: z.string().optional(),
})
type CategoryForm = z.infer<typeof categorySchema>

// ─── Locations ───────────────────────────────────────────────────────────────
export function LocationsPage() {
  const qc = useQueryClient()
  const [show, setShow] = useState(false)
  const { data, isLoading } = useQuery<Location[]>({
    queryKey: ["locations"],
    queryFn: () => api.get("/api/locations").then((r) => r.data),
  })
  const { register, handleSubmit, reset, formState: { errors } } = useForm<LocationForm>({
    resolver: zodResolver(locationSchema),
  })
  const mutation = useMutation({
    mutationFn: (d: LocationForm) => api.post("/api/locations", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["locations"] }); toast.success("Ubicación agregada"); setShow(false); reset() },
    onError: () => toast.error("Error al guardar la ubicación"),
  })

  return (
    <div>
      <div className="page-header flex items-start justify-between">
        <div><h1>Ubicaciones</h1><p>Sedes, pisos y áreas del inventario</p></div>
        <Button onClick={() => setShow(true)}><Plus size={16} /> Agregar</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? <Spinner /> : data?.map((loc) => (
          <Card key={loc.id} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <MapPin size={18} className="text-brand-700" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{loc.name}</p>
              {(loc.floor || loc.building) && (
                <p className="text-xs text-gray-400">{[loc.building, loc.floor].filter(Boolean).join(" · ")}</p>
              )}
            </div>
          </Card>
        ))}
      </div>
      <Modal open={show} onClose={() => { setShow(false); reset() }} title="Nueva ubicación">
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
          <Input label="Nombre *" placeholder="Ej. Almacén Norte" error={errors.name?.message} {...register("name")} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Piso" placeholder="Piso 3" {...register("floor")} />
            <Input label="Edificio" placeholder="Torre A" {...register("building")} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" className="flex-1 justify-center" onClick={() => { setShow(false); reset() }}>Cancelar</Button>
            <Button type="submit" className="flex-1 justify-center" loading={mutation.isPending}>Guardar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ─── Categories ───────────────────────────────────────────────────────────────
export function CategoriesPage() {
  const qc = useQueryClient()
  const [show, setShow] = useState(false)
  const { data, isLoading } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api.get("/api/categories").then((r) => r.data),
  })
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
  })
  const mutation = useMutation({
    mutationFn: (d: CategoryForm) => api.post("/api/categories", d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); toast.success("Categoría agregada"); setShow(false); reset() },
    onError: () => toast.error("Error al guardar la categoría"),
  })

  return (
    <div>
      <div className="page-header flex items-start justify-between">
        <div><h1>Categorías</h1><p>Tipos de activos del inventario</p></div>
        <Button onClick={() => setShow(true)}><Plus size={16} /> Agregar</Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? <Spinner /> : data?.length === 0 ? (
          <EmptyState title="Sin categorías" description="Agrega categorías para clasificar tus activos" />
        ) : data?.map((cat) => (
          <Card key={cat.id} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Tag size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{cat.name}</p>
              {cat.description && <p className="text-xs text-gray-400">{cat.description}</p>}
            </div>
          </Card>
        ))}
      </div>
      <Modal open={show} onClose={() => { setShow(false); reset() }} title="Nueva categoría">
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
          <Input label="Nombre *" placeholder="Ej. Equipos de Cómputo" error={errors.name?.message} {...register("name")} />
          <Input label="Descripción" placeholder="Descripción opcional" {...register("description")} />
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" className="flex-1 justify-center" onClick={() => { setShow(false); reset() }}>Cancelar</Button>
            <Button type="submit" className="flex-1 justify-center" loading={mutation.isPending}>Guardar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default LocationsPage
