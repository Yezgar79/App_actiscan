import { useState, useCallback } from "react"
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from "react-native"
import { useFocusEffect, useNavigation } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import api from "@/lib/api"
import { Colors, Spacing, Radius, FontSize } from "@/theme"

interface AssetReport {
  status: string
  count: number
  category_name?: string
  location_name?: string
}

interface AuditReport {
  status: string
  count: number
  auditor_name?: string
}

interface DashboardStats {
  total_assets: number
  operativo: number
  mantenimiento: number
  baja: number
  no_localizado: number
  active_audits: number
  completed_audits: number
  total_audits: number
  active_users: number
}

const ASSET_STATUS_LABELS: Record<string, string> = {
  operativo: "Operativos",
  mantenimiento: "En mantenimiento",
  no_localizado: "No localizados",
  baja: "Dados de baja",
}

const ASSET_STATUS_COLORS: Record<string, string> = {
  operativo: Colors.success,
  mantenimiento: Colors.warning,
  no_localizado: Colors.danger,
  baja: Colors.textMuted,
}

export default function ReportsScreen() {
  const navigation = useNavigation()
  const [stats, setStats]       = useState<DashboardStats | null>(null)
  const [loading, setLoading]   = useState(true)

  useFocusEffect(useCallback(() => {
    navigation.setOptions({ title: "Reportes" })
    loadStats()
  }, []))

  async function loadStats() {
    setLoading(true)
    try {
      const { data } = await api.get("/api/dashboard")
      setStats(data)
    } catch {
      setStats(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg }}>
        <ActivityIndicator color={Colors.brand} size="large" />
      </View>
    )
  }

  if (!stats) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: Colors.bg, gap: 12 }}>
        <Ionicons name="cloud-offline-outline" size={40} color={Colors.textMuted} />
        <Text style={{ fontSize: FontSize.base, color: Colors.textMuted }}>No se pudo cargar el reporte</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadStats}>
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const totalAssets = stats.total_assets || 1

  return (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
      {/* Asset summary */}
      <Section title="Inventario de activos">
        {Object.entries(ASSET_STATUS_LABELS).map(([status, label]) => {
          const count = stats[status as keyof DashboardStats] as number ?? 0
          const pct   = Math.round((count / totalAssets) * 100)
          return (
            <View key={status} style={styles.reportRow}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={styles.rowLabel}>{label}</Text>
                <Text style={[styles.rowCount, { color: ASSET_STATUS_COLORS[status] }]}>{count} ({pct}%)</Text>
              </View>
              <ProgressBar value={count} max={totalAssets} color={ASSET_STATUS_COLORS[status]} />
            </View>
          )
        })}

        <View style={styles.totalRow}>
          <Ionicons name="cube-outline" size={18} color={Colors.brand} />
          <Text style={styles.totalLabel}>Total de activos registrados</Text>
          <Text style={styles.totalValue}>{stats.total_assets}</Text>
        </View>
      </Section>

      {/* Audits summary */}
      <Section title="Auditorías">
        <View style={styles.auditGrid}>
          <StatBox label="Activas" value={stats.active_audits} color={Colors.brand} icon="clipboard-outline" />
          <StatBox label="Completadas" value={stats.completed_audits} color={Colors.success} icon="clipboard-check-outline" />
          <StatBox label="Total" value={stats.total_audits ?? (stats.active_audits + stats.completed_audits)} color={Colors.textPrimary} icon="albums-outline" />
          <StatBox label="Usuarios" value={stats.active_users} color="#7C3AED" icon="people-outline" />
        </View>
      </Section>

      {/* Audit completion rate */}
      {stats.total_audits > 0 && (
        <Section title="Tasa de completitud">
          <View style={styles.reportRow}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={styles.rowLabel}>Auditorías completadas</Text>
              <Text style={[styles.rowCount, { color: Colors.success }]}>
                {Math.round((stats.completed_audits / (stats.total_audits || 1)) * 100)}%
              </Text>
            </View>
            <ProgressBar value={stats.completed_audits} max={stats.total_audits || 1} color={Colors.success} />
          </View>
        </Section>
      )}

      <View style={{ height: Spacing.xxl }} />
    </ScrollView>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  )
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / (max || 1)) * 100))
  return (
    <View style={styles.progressBg}>
      <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  )
}

function StatBox({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <View style={[styles.statBox, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scroll:        { flex: 1, backgroundColor: Colors.bg },
  section:       { padding: Spacing.lg, paddingBottom: 0 },
  sectionTitle:  { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary, marginBottom: 10 },
  card:          { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  reportRow:     { gap: 4 },
  rowLabel:      { fontSize: FontSize.sm, color: Colors.textSecondary },
  rowCount:      { fontSize: FontSize.sm, fontWeight: "700" },
  progressBg:    { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: "hidden" },
  progressFill:  { height: "100%", borderRadius: 4 },
  totalRow:      { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  totalLabel:    { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: "600" },
  totalValue:    { fontSize: FontSize.base, fontWeight: "700", color: Colors.brand },
  auditGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statBox:       { flex: 1, minWidth: "45%", backgroundColor: Colors.bg, borderRadius: Radius.md, padding: Spacing.md, alignItems: "center", gap: 4 },
  statValue:     { fontSize: FontSize.xxl, fontWeight: "700" },
  statLabel:     { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: "center" },
  retryBtn:      { backgroundColor: Colors.brand, borderRadius: Radius.md, paddingHorizontal: 20, paddingVertical: 10 },
  retryText:     { color: Colors.white, fontWeight: "700" },
})
