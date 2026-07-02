"use client"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import toast from "react-hot-toast"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import api from "@/lib/api"
import { AuditSession, Location } from "@/types"
import { Button, Input, Select, Modal, AuditStatusBadge, EmptyState, Spinner, Card, AuditResultBadge } from "@/components/ui"
import { Plus, CheckCircle } from "lucide-react"

const schema = z.object({
  title: z.string().min(3, "Mínimo 3 caracteres"),
  location_id: z.string().optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function AuditsPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [selected, setSelected] = useState<AuditSession | null>(null)

  const { data: audits, isLoading } = useQuery<AuditSession[]>({
    queryKey: ["audits"],
    queryFn: () => api.get("/api/audits").then((r) => r.data),
  })

  const { data: locations } = useQuery<Location[]>({
    queryKey: ["locations"],
    queryFn: () => api.get("/api/locations").then((r) => r.data),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const createMutation = useMutation({
    mutationFn: (data: FormData) => api.post("/api/audits", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["audits"] })
      toast.success("Auditoría iniciada")
      setShowModal(false)
      reset()
    },
    onError: () => toast.error("Error al crear la auditoría"),
  })

  const finishMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/audits/${id}/finish`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["audits"] })
      toast.success("Auditoría finalizada")
      setSelected(null)
    },
  })

  return (
    <div>
      <div className="page-header flex items-start justify-between">
        <div>
          <h1>Auditorías</h1>
          <p>{audits?.length ?? 0} auditorías registradas</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} /> Nueva auditoría
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center pt-20"><Spinner /></div>
      ) : audits?.length === 0 ? (
        <EmptyState title="Sin auditorías" description="Inicia la primera auditoría del sistema" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {audits?.map((audit) => {
            const present = audit.items.filter((i) => i.result === "presente").length
            const missing = audit.items.filter((i) => i.result === "faltante").length
            const alertC  = audit.items.filter((i) => i.result === "alerta").length

            return (
              <Card key={audit.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(audit)}>
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-gray-900 flex-1 mr-2">{audit.title}</h3>
                  <AuditStatusBadge status={audit.status} />
                </div>
                <div className="text-sm text-gray-500 space-y-1 mb-4">
                  <p>👤 {audit.auditor.name}</p>
                  <p>📅 {format(new Date(audit.started_at), "dd MMM yyyy · HH:mm", { locale: es })}</p>
                  {audit.finished_at && (
                    <p>✅ {format(new Date(audit.finished_at), "dd MMM yyyy · HH:mm", { locale: es })}</p>
                  )}
                </div>

                {/* Result stats */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[
                    { label: "Presentes", value: present, color: "text-green-600" },
                    { label: "Faltantes", value: missing, color: "text-red-600" },
                    { label: "Alertas",   value: alertC,  color: "text-amber-600" },
                    { label: "Total",     value: audit.items.length, color: "text-gray-700" },
                  ].map((s) => (
                    <div key={s.label} className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-gray-400">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Progress */}
                {audit.status === "en_curso" && audit.items.length > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Progreso</span>
                      <span>{Math.round((present / audit.items.length) * 100)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-700 rounded-full"
                        style={{ width: `${(present / audit.items.length) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {audit.status === "en_curso" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-center mt-3"
                    onClick={(e) => { e.stopPropagation(); if (confirm("¿Finalizar esta auditoría?")) finishMutation.mutate(audit.id) }}
                  >
                    <CheckCircle size={14} /> Finalizar auditoría
                  </Button>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title={selected.title}>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            <AuditStatusBadge status={selected.status} />
            <p className="text-sm text-gray-500">Auditor: {selected.auditor.name}</p>
            <p className="text-sm text-gray-500">
              Inicio: {format(new Date(selected.started_at), "dd MMM yyyy HH:mm", { locale: es })}
            </p>
            {selected.items.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin activos escaneados aún</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="pb-2">Activo</th>
                    <th className="pb-2">Resultado</th>
                    <th className="pb-2">Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-50">
                      <td className="py-2">{item.asset?.name ?? item.asset_id}</td>
                      <td className="py-2"><AuditResultBadge result={item.result} /></td>
                      <td className="py-2 text-gray-400">
                        {format(new Date(item.scanned_at), "HH:mm", { locale: es })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Modal>
      )}

      {/* Create modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); reset() }} title="Nueva auditoría">
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
          <Input label="Título *" error={errors.title?.message} placeholder="Ej. Almacén Norte — Turno Mañana" {...register("title")} />
          <Select
            label="Ubicación"
            {...register("location_id")}
            options={locations?.map((l) => ({ value: l.id, label: l.name })) ?? []}
          />
          <Input label="Notas" placeholder="Observaciones generales..." {...register("notes")} />
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" className="flex-1 justify-center" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" className="flex-1 justify-center" loading={createMutation.isPending}>Iniciar auditoría</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
