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

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  is_active: boolean
  assigned_location?: string
  last_login?: string
  created_at: string
}

export interface Category {
  id: string
  name: string
  description?: string
}

export interface Location {
  id: string
  name: string
  floor?: string
  building?: string
}

export interface Asset {
  id: string
  code: string
  name: string
  description?: string
  brand?: string
  model?: string
  serial_number?: string
  acquisition_date?: string
  warranty_until?: string
  acquisition_value?: number
  status: AssetStatus
  qr_code_url?: string
  category?: Category
  location?: Location
  responsible_user?: User
  created_at: string
}

export interface Movement {
  id: string
  movement_type: string
  description: string
  previous_value?: string
  new_value?: string
  created_at: string
  performed_by_user: User
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
  title: string
  status: AuditStatus
  notes?: string
  started_at: string
  finished_at?: string
  auditor: User
  items: AuditItem[]
}

export interface SystemStats {
  total_users: number
  users_by_role: Record<string, number>
  active_users: number
  inactive_users: number
  total_assets: number
  assets_by_status: Record<string, number>
  total_audits: number
  active_audits: number
  total_categories: number
  total_locations: number
  total_movements: number
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
