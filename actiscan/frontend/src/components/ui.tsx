import { ReactNode, forwardRef } from "react"
import { IconInbox } from "@/components/icons"
import { clsx } from "clsx"
import { AssetStatus, AuditItemResult, AuditStatus } from "@/types"

// ─── Button ───────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost"
  size?: "sm" | "md" | "lg"
  loading?: boolean
  children: ReactNode
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const base = "inline-flex items-center gap-2 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
  const variants = {
    primary: "bg-brand-700 text-white hover:bg-brand-900 focus:ring-brand-500",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-brand-500",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    ghost: "text-gray-600 hover:bg-gray-100 focus:ring-gray-300",
  }
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  }
  return (
    <button
      className={clsx(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      )}
      {children}
    </button>
  )
}

// ─── Input ────────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  suffix?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className, suffix, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
        <div className="relative">
          <input
            ref={ref}
            className={clsx(
              "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition",
              error ? "border-red-400 bg-red-50" : "border-gray-300 bg-white",
              suffix ? "pr-10" : "",
              className
            )}
            {...props}
          />
          {suffix && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              {suffix}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {helperText && !error && <p className="text-xs text-gray-500">{helperText}</p>}
      </div>
    )
  }
)
Input.displayName = "Input"

// ─── Select ───────────────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
        <select
          ref={ref}
          className={clsx(
            "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white transition",
            error ? "border-red-400" : "border-gray-300",
            className
          )}
          {...props}
        >
          <option value="">Seleccionar...</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  }
)
Select.displayName = "Select"

// ─── Badge ────────────────────────────────────────────────────────────────────
const STATUS_ASSET: Record<AssetStatus, { label: string; cls: string }> = {
  operativo:     { label: "Operativo",      cls: "bg-green-100 text-green-800" },
  mantenimiento: { label: "Mantenimiento",  cls: "bg-amber-100 text-amber-800" },
  baja:          { label: "Baja",           cls: "bg-gray-100 text-gray-600"   },
  no_localizado: { label: "No localizado",  cls: "bg-red-100 text-red-800"     },
}

const STATUS_AUDIT: Record<AuditStatus, { label: string; cls: string }> = {
  en_curso:   { label: "En curso",    cls: "bg-blue-100 text-blue-800"   },
  completada: { label: "Completada",  cls: "bg-green-100 text-green-800" },
  cancelada:  { label: "Cancelada",   cls: "bg-red-100 text-red-800"     },
}

const RESULT_AUDIT: Record<AuditItemResult, { label: string; cls: string }> = {
  presente:     { label: "Encontrado",   cls: "bg-green-100 text-green-800"   },
  faltante:     { label: "No encontrado",cls: "bg-red-100 text-red-800"       },
  danado:       { label: "Dañado",       cls: "bg-orange-100 text-orange-800" },
  reubicado:    { label: "Reubicado",    cls: "bg-blue-100 text-blue-800"     },
  no_accesible: { label: "No accesible", cls: "bg-purple-100 text-purple-800" },
  no_aplica:    { label: "No aplica",    cls: "bg-gray-100 text-gray-600"     },
  alerta:       { label: "Alerta",       cls: "bg-amber-100 text-amber-800"   },
}

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  const s = STATUS_ASSET[status]
  return <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", s.cls)}>{s.label}</span>
}

export function AuditStatusBadge({ status }: { status: AuditStatus }) {
  const s = STATUS_AUDIT[status]
  return <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", s.cls)}>{s.label}</span>
}

export function AuditResultBadge({ result }: { result: AuditItemResult }) {
  const s = RESULT_AUDIT[result]
  return <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium", s.cls)}>{s.label}</span>
}

// ─── Card ─────────────────────────────────────────────────────────────────────
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div className={clsx("bg-white border border-gray-200 rounded-xl p-5 shadow-sm", className)} {...props}>
      {children}
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
export function StatCard({
  label, value, sub, color = "text-gray-900"
}: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={clsx("text-3xl font-semibold", color)}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </Card>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <IconInbox size={26} className="text-gray-400" />
      </div>
      <p className="text-gray-700 font-medium">{title}</p>
      {description && <p className="text-gray-400 text-sm mt-1">{description}</p>}
    </div>
  )
}

// ─── Loading spinner ──────────────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return (
    <div className={clsx("w-6 h-6 border-2 border-gray-300 border-t-brand-700 rounded-full animate-spin", className)} />
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({
  open, onClose, title, children, wide,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={clsx("relative bg-white rounded-2xl shadow-xl w-full mx-4 p-6 z-10", wide ? "max-w-2xl" : "max-w-md")}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
