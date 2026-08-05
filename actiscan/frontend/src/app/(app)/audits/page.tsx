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
import { AuditSession, AuditItem, AuditItemResult, Location } from "@/types"
import {
  Button, Input, Select, Modal, AuditStatusBadge,
  EmptyState, Spinner, Card, AuditResultBadge,
} from "@/components/ui"
import { useAuthStore } from "@/store/auth"
import { Plus, CheckCircle, RotateCcw, ThumbsUp, ChevronDown, ChevronUp, Filter } from "lucide-react"

const schema = z.object({
  title:       z.string().min(3, "Mínimo 3 caracteres"),
  location_id: z.string().optional(),
  notes:       z.string().optional(),
})
type FormData = z.infer<typeof schema>

const SEVERITY_BADGE: Record<string, string> = {
  baja:   "bg-green-100 text-green-700",
  media:  "bg-yellow-100 text-yellow-700",
  alta:   "bg-orange-100 text-orange-700",
  critica:"bg-red-100 text-red-700",
}

const RESULT_FILTER_OPTIONS: { value: AuditItemResult | "all" | "devueltos"; label: string }[] = [
  { value: "all",          label: "Todos"         },
  { value: "presente",     label: "Encontrados"   },
  { value: "faltante",     label: "No encontrados"},
  { value: "danado",       label: "Dañados"       },
  { value: "reubicado",    label: "Reubicados"    },
  { value: "no_accesible", label: "No accesibles" },
  { value: "no_aplica",    label: "No aplica"     },
  { value: "devueltos",    label: "Devueltos"     },
]

function AuditItemRow({
  item,
  sessionId,
  isAdmin,
  isEnCurso,
}: {
  item: AuditItem
  sessionId: string
  isAdmin: boolean
  isEnCurso: boolean
}) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [returnComment, setReturnComment] = useState("")
  const [showReturnForm, setShowReturnForm] = useState(false)

  const isReturned = !!item.returned_at && !item.approved_at
  const isApproved = !!item.approved_at

  const returnMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/audits/${sessionId}/items/${item.id}/return`, { comment: returnComment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["audits"] })
      toast.success("Activo devuelto para corrección")
      setShowReturnForm(false)
      setReturnComment("")
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? "Error al devolver activo"),
  })

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/api/audits/${sessionId}/items/${item.id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["audits"] })
      toast.success("Activo aprobado")
    },
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? "Error al aprobar"),
  })

  return (
    <div className={`border rounded-lg overflow-hidden ${isReturned ? "border-orange-400" : isApproved ? "border-green-300" : "border-gray-200"}`}>
      {/* Main row */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-white cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-900 truncate">{item.asset?.name ?? item.asset_id}</span>
            {item.asset?.code && (
              <span className="text-xs text-brand-700 font-mono bg-brand-50 px-1.5 py-0.5 rounded">{item.asset.code}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <AuditResultBadge result={item.result} />
            {item.severity && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${SEVERITY_BADGE[item.severity] ?? ""}`}>
                {item.severity}
              </span>
            )}
            {isReturned && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">↩ Devuelto</span>
            )}
            {isApproved && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">✓ Aprobado</span>
            )}
            {item.evidence_urls && item.evidence_urls.length > 0 && (
              <span className="text-xs text-gray-400">📷 {item.evidence_urls.length} evidencia{item.evidence_urls.length > 1 ? "s" : ""}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-400">{format(new Date(item.scanned_at), "HH:mm", { locale: es })}</span>
          {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
          {/* Notes */}
          {item.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Observación</p>
              <p className="text-sm text-gray-700">{item.notes}</p>
            </div>
          )}

          {/* Location / responsible */}
          {(item.detected_location || item.detected_responsible) && (
            <div className="grid grid-cols-2 gap-3">
              {item.detected_location && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Ubicación detectada</p>
                  <p className="text-sm text-gray-700">{item.detected_location}</p>
                </div>
              )}
              {item.detected_responsible && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Responsable detectado</p>
                  <p className="text-sm text-gray-700">{item.detected_responsible}</p>
                </div>
              )}
            </div>
          )}

          {/* Returned comment */}
          {item.returned_comment && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-orange-700 mb-1">Comentario de devolución</p>
              <p className="text-sm text-orange-800">{item.returned_comment}</p>
              {item.returned_at && (
                <p className="text-xs text-orange-500 mt-1">
                  {format(new Date(item.returned_at), "dd MMM yyyy · HH:mm", { locale: es })}
                </p>
              )}
            </div>
          )}

          {/* Approved */}
          {item.approved_at && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-2">
              <p className="text-xs text-green-700">
                ✓ Aprobado el {format(new Date(item.approved_at), "dd MMM yyyy · HH:mm", { locale: es })}
              </p>
            </div>
          )}

          {/* Admin actions */}
          {isAdmin && isEnCurso && !isApproved && (
            <div className="flex gap-2 pt-1">
              {!showReturnForm && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowReturnForm(true)}
                  disabled={returnMutation.isPending || approveMutation.isPending}
                >
                  <RotateCcw size={13} /> Devolver para corrección
                </Button>
              )}
              {!isReturned && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-green-700 hover:bg-green-50"
                  onClick={() => approveMutation.mutate()}
                  loading={approveMutation.isPending}
                  disabled={returnMutation.isPending}
                >
                  <ThumbsUp size={13} /> Aprobar
                </Button>
              )}
              {isReturned && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-green-700 hover:bg-green-50"
                  onClick={() => approveMutation.mutate()}
                  loading={approveMutation.isPending}
                >
                  <ThumbsUp size={13} /> Aprobar corrección
                </Button>
              )}
            </div>
          )}

          {/* Return form */}
          {showReturnForm && (
            <div className="bg-white border border-orange-200 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-gray-800">¿Por qué se devuelve este activo?</p>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                rows={3}
                placeholder="Explica al capturista qué debe corregir..."
                value={returnComment}
                onChange={(e) => setReturnComment(e.target.value)}
              />
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => { setShowReturnForm(false); setReturnComment("") }}>Cancelar</Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    if (!returnComment.trim()) { toast.error("Escribe un comentario de devolución"); return }
                    returnMutation.mutate()
                  }}
                  loading={returnMutation.isPending}
                >
                  <RotateCcw size={13} /> Confirmar devolución
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function AuditsPage() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = user?.role === "admin" || user?.role === "super_admin"

  const [showModal, setShowModal]   = useState(false)
  const [selected, setSelected]     = useState<AuditSession | null>(null)
  const [resultFilter, setResultFilter] = useState<string>("all")

  const { data: audits, isLoading } = useQuery<AuditSession[]>({
    queryKey: ["audits"],
    queryFn: () => api.get("/api/audits").then((r) => r.data),
    refetchInterval: 15_000,
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
    onError: (err: any) => toast.error(err?.response?.data?.detail ?? "Error al finalizar"),
  })

  // Selected audit: reload from query to get latest data
  const selectedAudit = audits?.find((a) => a.id === selected?.id) ?? selected

  // Filter items in detail modal
  const filteredItems = (selectedAudit?.items ?? []).filter((item) => {
    if (resultFilter === "all") return true
    if (resultFilter === "devueltos") return !!item.returned_at && !item.approved_at
    return item.result === resultFilter
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
            const present   = audit.items.filter((i) => i.result === "presente").length
            const missing   = audit.items.filter((i) => i.result === "faltante").length
            const damaged   = audit.items.filter((i) => i.result === "danado" || i.result === "alerta").length
            const returned  = audit.items.filter((i) => i.returned_at && !i.approved_at).length

            return (
              <Card
                key={audit.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => { setSelected(audit); setResultFilter("all") }}
              >
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
                <div className="grid grid-cols-5 gap-2 mb-3">
                  {[
                    { label: "Hallados",  value: present,  color: "text-green-600"  },
                    { label: "Faltantes", value: missing,  color: "text-red-600"    },
                    { label: "Dañados",   value: damaged,  color: "text-orange-600" },
                    { label: "Devueltos", value: returned, color: "text-orange-500" },
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

                {/* Returned warning */}
                {returned > 0 && (
                  <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                    <p className="text-xs text-orange-700 font-medium">
                      ↩ {returned} activo{returned > 1 ? "s" : ""} devuelto{returned > 1 ? "s" : ""} para corrección
                    </p>
                  </div>
                )}

                {audit.status === "en_curso" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-center mt-3"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (returned > 0) {
                        toast.error(`Hay ${returned} activo(s) devueltos pendientes. Corrígelos antes de finalizar.`)
                        return
                      }
                      if (confirm("¿Finalizar esta auditoría?")) finishMutation.mutate(audit.id)
                    }}
                  >
                    <CheckCircle size={14} /> Finalizar auditoría
                  </Button>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Detail modal ────────────────────────────────────────────── */}
      {selectedAudit && (
        <Modal
          open={!!selectedAudit}
          onClose={() => { setSelected(null); setResultFilter("all") }}
          title={selectedAudit.title}
          wide
        >
          <div className="space-y-4">
            {/* Header info */}
            <div className="flex items-center gap-2 flex-wrap">
              <AuditStatusBadge status={selectedAudit.status} />
              <span className="text-sm text-gray-500">👤 {selectedAudit.auditor.name}</span>
              <span className="text-sm text-gray-500">
                📅 {format(new Date(selectedAudit.started_at), "dd MMM yyyy", { locale: es })}
              </span>
            </div>

            {/* Result filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter size={14} className="text-gray-400" />
              {RESULT_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setResultFilter(opt.value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    resultFilter === opt.value
                      ? "bg-brand-700 text-white border-brand-700"
                      : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                  }`}
                >
                  {opt.label}
                  {opt.value !== "all" && (
                    <span className="ml-1 opacity-70">
                      ({opt.value === "devueltos"
                        ? selectedAudit.items.filter(i => i.returned_at && !i.approved_at).length
                        : selectedAudit.items.filter(i => i.result === opt.value).length
                      })
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Items list */}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {filteredItems.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Sin activos en esta categoría</p>
              ) : (
                filteredItems.map((item) => (
                  <AuditItemRow
                    key={item.id}
                    item={item}
                    sessionId={selectedAudit.id}
                    isAdmin={isAdmin}
                    isEnCurso={selectedAudit.status === "en_curso"}
                  />
                ))
              )}
            </div>

            {/* Footer actions */}
            {selectedAudit.status === "en_curso" && isAdmin && (
              <div className="border-t border-gray-100 pt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() => {
                    const returned = selectedAudit.items.filter(i => i.returned_at && !i.approved_at).length
                    if (returned > 0) { toast.error(`Aún hay ${returned} activo(s) devueltos sin aprobar`); return }
                    if (confirm("¿Finalizar esta auditoría?")) finishMutation.mutate(selectedAudit.id)
                  }}
                  loading={finishMutation.isPending}
                >
                  <CheckCircle size={14} /> Finalizar auditoría
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Create modal ─────────────────────────────────────────────── */}
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
