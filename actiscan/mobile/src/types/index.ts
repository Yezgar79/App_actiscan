export type UserRole = "admin" | "auditor" | "viewer"
export type AssetStatus = "operativo" | "mantenimiento" | "baja" | "no_localizado"
export type AuditStatus = "en_curso" | "completada" | "cancelada"
export type AuditItemResult = "presente" | "faltante" | "alerta"

export interface User {
  id: string; name: string; email: string
  role: UserRole; assigned_location?: string
}

export interface Category { id: string; name: string }
export interface Location  { id: string; name: string; floor?: string; building?: string }

export interface Asset {
  id: string; code: string; name: string
  description?: string; brand?: string; model?: string
  serial_number?: string; acquisition_value?: number
  status: AssetStatus; qr_code_url?: string
  category?: Category; location?: Location
  responsible_user?: User; created_at: string
}

export interface AuditItem {
  id: string; asset_id: string; result: AuditItemResult
  notes?: string; scanned_at: string; asset?: Asset
}

export interface AuditSession {
  id: string; title: string; status: AuditStatus
  started_at: string; finished_at?: string
  auditor: User; items: AuditItem[]
}

export interface DashboardStats {
  total_assets: number; operativo: number
  mantenimiento: number; baja: number
  no_localizado: number; active_audits: number
  audits_today: number; assets_audited_today: number
}
