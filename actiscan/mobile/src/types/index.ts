export type UserRole = "super_admin" | "admin" | "auditor" | "viewer"
export type AssetStatus = "operativo" | "mantenimiento" | "baja" | "no_localizado"
export type AuditStatus = "en_curso" | "completada" | "cancelada"
export type AuditItemResult =
  | "presente"
  | "faltante"
  | "danado"
  | "reubicado"
  | "no_accesible"
  | "no_aplica"
  | "alerta"
export type ObservationSeverity = "baja" | "media" | "alta" | "critica"

export const RESULT_LABELS: Record<AuditItemResult, string> = {
  presente:    "Encontrado",
  faltante:    "No encontrado",
  danado:      "Dañado",
  reubicado:   "Reubicado",
  no_accesible:"No accesible",
  no_aplica:   "No aplica",
  alerta:      "Alerta",
}

export const SEVERITY_LABELS: Record<ObservationSeverity, string> = {
  baja:   "Baja",
  media:  "Media",
  alta:   "Alta",
  critica:"Crítica",
}

export const RESULTS_REQUIRING_NOTES: AuditItemResult[] = [
  "faltante", "danado", "reubicado", "no_accesible", "no_aplica",
]

export const CRITICAL_RESULTS: AuditItemResult[] = [
  "faltante", "danado",
]

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  assigned_location?: string
  last_login?: string
}

export interface Category { id: string; name: string }
export interface Location { id: string; name: string; floor?: string; building?: string }

export interface Asset {
  id: string
  code: string
  name: string
  description?: string
  brand?: string
  model?: string
  serial_number?: string
  inventory_number?: string
  acquisition_value?: number
  supplier?: string
  invoice_number?: string
  notes?: string
  status: AssetStatus
  qr_code_url?: string
  category?: Category
  location?: Location
  responsible_user?: User
  created_at: string
  updated_at?: string
}

export interface AuditItem {
  id: string
  asset_id: string
  result: AuditItemResult
  notes?: string
  severity?: ObservationSeverity
  detected_location?: string
  detected_responsible?: string
  evidence_urls?: string[]
  returned_at?: string
  returned_comment?: string
  approved_at?: string
  scanned_at: string
  asset?: Asset
}

export interface AuditSession {
  id: string
  audit_code?: string
  title: string
  description?: string
  status: AuditStatus
  started_at: string
  finished_at?: string
  planned_start?: string
  planned_end?: string
  notes?: string
  auditor: User
  location?: Location
  items: AuditItem[]
}

export interface DashboardStats {
  total_assets: number
  operativo: number
  mantenimiento: number
  baja: number
  no_localizado: number
  active_audits: number
  audits_today: number
  assets_audited_today: number
}

export interface CapturistaStats {
  assigned_audits: number
  in_progress_audits: number
  completed_audits: number
  total_items_scanned: number
  items_pending: number
  items_found: number
  items_damaged: number
  items_missing: number
  items_returned: number
  last_audit_id?: string
  last_audit_title?: string
  last_audit_progress_pct?: number
}
