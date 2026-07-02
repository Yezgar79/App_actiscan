"use client"
import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { DashboardStats, AuditSession } from "@/types"
import { StatCard, Card, AuditStatusBadge, Spinner } from "@/components/ui"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export default function DashboardPage() {
  const { data: stats, isLoading: loadingStats } = useQuery<DashboardStats>({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/api/dashboard").then((r) => r.data),
    refetchInterval: 30_000,
  })

  const { data: audits } = useQuery<AuditSession[]>({
    queryKey: ["audits", "recent"],
    queryFn: () => api.get("/api/audits?limit=5").then((r) => r.data),
  })

  if (loadingStats) return <div className="flex justify-center pt-20"><Spinner /></div>

  const chartData = stats ? [
    { name: "Operativo",     value: stats.operativo,     color: "#16a34a" },
    { name: "Mantenimiento", value: stats.mantenimiento, color: "#d97706" },
    { name: "No localizado", value: stats.no_localizado, color: "#dc2626" },
    { name: "Baja",          value: stats.baja,          color: "#6b7280" },
  ] : []

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Resumen general del sistema de activos</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total activos"       value={stats?.total_assets ?? 0} />
        <StatCard label="Operativos"          value={stats?.operativo ?? 0}      color="text-green-600" />
        <StatCard label="No localizados"      value={stats?.no_localizado ?? 0}  color="text-red-600" />
        <StatCard label="Auditados hoy"       value={stats?.assets_audited_today ?? 0} color="text-brand-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Estado del inventario</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={36}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Quick stats */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Auditorías</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Activas ahora</span>
              <span className="font-semibold text-brand-700">{stats?.active_audits}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Iniciadas hoy</span>
              <span className="font-semibold">{stats?.audits_today}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-600">En mantenimiento</span>
              <span className="font-semibold text-amber-600">{stats?.mantenimiento}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent audits */}
      <Card className="mt-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Auditorías recientes</h2>
        {audits?.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Sin auditorías registradas aún</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="pb-2 font-medium">Título</th>
                <th className="pb-2 font-medium">Auditor</th>
                <th className="pb-2 font-medium">Estado</th>
                <th className="pb-2 font-medium">Inicio</th>
                <th className="pb-2 font-medium">Activos</th>
              </tr>
            </thead>
            <tbody>
              {audits?.map((a) => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 font-medium">{a.title}</td>
                  <td className="py-3 text-gray-500">{a.auditor.name}</td>
                  <td className="py-3"><AuditStatusBadge status={a.status} /></td>
                  <td className="py-3 text-gray-500">
                    {format(new Date(a.started_at), "dd MMM yyyy HH:mm", { locale: es })}
                  </td>
                  <td className="py-3">{a.items.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
