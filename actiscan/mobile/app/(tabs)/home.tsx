import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, useWindowDimensions } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import api from "@/lib/api"
import { DashboardStats, AuditSession, CapturistaStats } from "@/types"
import { useAuthStore } from "@/store/auth"
import { Card, SectionHeader } from "@/components/ui"
import { Colors, Spacing, Radius, FontSize } from "@/theme"
import { useNetworkStatus } from "@/lib/network"

type IoniconName = React.ComponentProps<typeof Ionicons>["name"]

export default function HomeScreen() {
  const { user } = useAuthStore()
  const router   = useRouter()
  const isOnline = useNetworkStatus()
  const { width } = useWindowDimensions()

  const { data: stats, refetch: refetchStats, isRefetching } = useQuery<DashboardStats>({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/api/dashboard").then((r) => r.data),
    refetchInterval: 30_000,
    enabled: isOnline,
  })

  const { data: capStats } = useQuery<CapturistaStats>({
    queryKey: ["capturista-stats"],
    queryFn: () => api.get("/api/audits/capturista-stats").then((r) => r.data),
    refetchInterval: 30_000,
    enabled: isOnline,
  })

  const { data: audits } = useQuery<AuditSession[]>({
    queryKey: ["audits", "recent"],
    queryFn: () => api.get("/api/audits?limit=3").then((r) => r.data),
    enabled: isOnline,
  })

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return "Buenos días"
    if (h < 18) return "Buenas tardes"
    return "Buenas noches"
  }

  const kpis = [
    { label: "Total activos",  value: stats?.total_assets ?? "—",         color: Colors.textPrimary, icon: "cube-outline" as IoniconName,          bg: "#EEF2FF" },
    { label: "Operativos",     value: stats?.operativo ?? "—",            color: Colors.success,     icon: "checkmark-circle-outline" as IoniconName, bg: Colors.successBg },
    { label: "No localizados", value: stats?.no_localizado ?? "—",        color: Colors.danger,      icon: "warning-outline" as IoniconName,        bg: Colors.dangerBg  },
    { label: "Auditados hoy",  value: stats?.assets_audited_today ?? "—", color: Colors.brand,       icon: "scan-outline" as IoniconName,           bg: Colors.infoBg    },
  ]

  const quickActions: { icon: IoniconName; label: string; route: string; badge?: number; danger?: boolean }[] = [
    { icon: "clipboard-outline", label: "Auditorías",  route: "/(tabs)/audits"     },
    { icon: "cube-outline",      label: "Inventario",  route: "/(tabs)/inventory"  },
    ...(capStats && capStats.items_returned > 0
      ? [{ icon: "return-down-back-outline" as IoniconName, label: `${capStats.items_returned} devuelto${capStats.items_returned !== 1 ? "s" : ""}`, route: "/(tabs)/audits", badge: capStats.items_returned, danger: true }]
      : []),
  ]

  const numKpiCols = width >= 600 ? 4 : 2

  return (
    <SafeAreaView style={styles.safe}>
      {/* Offline banner */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="wifi-outline" size={14} color="#92400e" />
          <Text style={styles.offlineText}>Sin conexión — mostrando datos en caché</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>
            {greeting()}, {user?.name?.split(" ")[0]}
          </Text>
          <Text style={styles.headerSub}>
            {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
          </Text>
        </View>
        <TouchableOpacity style={styles.avatar} onPress={() => router.push("/(tabs)/profile")} activeOpacity={0.8}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase()}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetchStats} tintColor={Colors.brand} />
        }
      >
        {/* KPI Grid */}
        <View style={[styles.kpiGrid, numKpiCols === 4 && { flexWrap: "nowrap" }]}>
          {kpis.map((k) => (
            <View key={k.label} style={[styles.kpiCard, numKpiCols === 4 && { flex: 1 }]}>
              <View style={[styles.kpiIconBox, { backgroundColor: k.bg }]}>
                <Ionicons name={k.icon} size={18} color={k.color} />
              </View>
              <Text style={[styles.kpiNum, { color: k.color }]}>{k.value}</Text>
              <Text style={styles.kpiLabel}>{k.label}</Text>
            </View>
          ))}
        </View>

        {/* Capturista progress panel */}
        {capStats && (
          <Card style={styles.progressCard}>
            <View style={styles.progressTitleRow}>
              <Ionicons name="bar-chart-outline" size={16} color={Colors.brand} />
              <Text style={styles.progressTitle}>Mi progreso en campo</Text>
            </View>

            <View style={styles.progressRow}>
              {[
                { label: "Asignadas",   value: capStats.assigned_audits,    color: Colors.info   },
                { label: "En curso",    value: capStats.in_progress_audits, color: Colors.brand  },
                { label: "Completadas", value: capStats.completed_audits,   color: Colors.success},
                { label: "Devueltos",   value: capStats.items_returned,     color: Colors.danger },
              ].map((s) => (
                <View key={s.label} style={styles.progressStat}>
                  <Text style={[styles.progressNum, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.progressLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            <View style={{ marginTop: 14, gap: 8 }}>
              <ProgressRow label="Encontrados"    value={capStats.items_found}   total={capStats.total_items_scanned} color={Colors.success} />
              <ProgressRow label="Dañados"        value={capStats.items_damaged} total={capStats.total_items_scanned} color={Colors.warning} />
              <ProgressRow label="No encontrados" value={capStats.items_missing} total={capStats.total_items_scanned} color={Colors.danger}  />
            </View>

            {capStats.last_audit_id && capStats.last_audit_title && (
              <TouchableOpacity
                style={styles.lastAuditBox}
                onPress={() => router.push("/(tabs)/audits")}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.lastAuditLabel}>Última auditoría activa</Text>
                  <Text style={styles.lastAuditTitle} numberOfLines={1}>{capStats.last_audit_title}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.lastAuditPct}>{capStats.last_audit_progress_pct ?? 0}%</Text>
                  <Text style={styles.lastAuditSub}>avance</Text>
                </View>
              </TouchableOpacity>
            )}
          </Card>
        )}

        {/* CTA scan button */}
        <TouchableOpacity style={styles.scanCta} onPress={() => router.push("/(tabs)/scan")} activeOpacity={0.85}>
          <View style={styles.scanCtaIconBox}>
            <Ionicons name="qr-code" size={26} color={Colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.scanCtaTitle}>Escanear activo</Text>
            <Text style={styles.scanCtaSub}>Apunta la cámara al código QR</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>

        {/* Quick actions */}
        <View style={styles.quickActions}>
          {quickActions.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={[styles.quickBtn, a.danger && { borderColor: Colors.danger }]}
              onPress={() => router.push(a.route as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.quickBtnIcon, a.danger && { backgroundColor: Colors.dangerBg }]}>
                <Ionicons name={a.icon} size={20} color={a.danger ? Colors.danger : Colors.brand} />
              </View>
              <Text style={[styles.quickBtnLabel, a.danger && { color: Colors.danger }]} numberOfLines={1}>
                {a.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent audits */}
        <View style={styles.section}>
          <SectionHeader title="Auditorías recientes" />
          {!audits || audits.length === 0 ? (
            <View style={styles.emptyAudits}>
              <Ionicons name="clipboard-outline" size={28} color={Colors.textMuted} />
              <Text style={styles.emptyAuditsText}>Sin auditorías registradas aún</Text>
            </View>
          ) : (
            audits.map((audit) => {
              const present = audit.items.filter((i) => i.result === "presente").length
              const total   = audit.items.length
              const pct     = total > 0 ? Math.round((present / total) * 100) : 0
              const isActive = audit.status === "en_curso"

              return (
                <TouchableOpacity
                  key={audit.id}
                  onPress={() => router.push("/(tabs)/audits")}
                  activeOpacity={0.85}
                >
                  <Card style={styles.auditCard}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <Text style={styles.auditTitle} numberOfLines={1}>{audit.title}</Text>
                      <View style={{
                        paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full,
                        backgroundColor: isActive ? Colors.infoBg : Colors.successBg,
                        marginLeft: 8,
                      }}>
                        <Text style={{ fontSize: FontSize.xs, fontWeight: "600", color: isActive ? Colors.info : Colors.success }}>
                          {isActive ? "En curso" : "Completada"}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
                      <Ionicons name="person-outline" size={12} color={Colors.textMuted} />
                      <Text style={styles.auditMeta}>{audit.auditor.name} · {audit.items.length} activos</Text>
                    </View>
                    {isActive && total > 0 && (
                      <View style={{ marginTop: 8 }}>
                        <View style={styles.miniProgress}>
                          <View style={[styles.miniProgressFill, { width: `${pct}%` as any }]} />
                        </View>
                        <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 3 }}>
                          {present}/{total} encontrados ({pct}%)
                        </Text>
                      </View>
                    )}
                  </Card>
                </TouchableOpacity>
              )
            })
          )}
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function ProgressRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
        <Text style={{ fontSize: FontSize.xs, color: Colors.textSecondary }}>{label}</Text>
        <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>{value} ({pct}%)</Text>
      </View>
      <View style={{ height: 5, backgroundColor: Colors.border, borderRadius: 3, overflow: "hidden" }}>
        <View style={{ height: "100%", width: `${pct}%` as any, backgroundColor: color, borderRadius: 3 }} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: Colors.bg },
  offlineBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fef3c7", paddingVertical: 8, paddingHorizontal: 16, justifyContent: "center" },
  offlineText:   { fontSize: FontSize.xs, color: "#92400e", fontWeight: "600" },
  header:        { flexDirection: "row", alignItems: "center", backgroundColor: Colors.brand, padding: Spacing.xl, paddingBottom: Spacing.lg },
  greeting:      { fontSize: FontSize.lg, fontWeight: "700", color: Colors.white },
  headerSub:     { fontSize: FontSize.sm, color: "rgba(255,255,255,0.6)", marginTop: 2, textTransform: "capitalize" },
  avatar:        { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  avatarText:    { color: Colors.white, fontWeight: "700", fontSize: FontSize.md },
  scroll:        { flex: 1, padding: Spacing.lg },

  // KPI
  kpiGrid:       { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: Spacing.lg },
  kpiCard:       { flex: 1, minWidth: "45%", backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, gap: 6 },
  kpiIconBox:    { width: 34, height: 34, borderRadius: Radius.md, alignItems: "center", justifyContent: "center" },
  kpiNum:        { fontSize: FontSize.xxl, fontWeight: "700", marginTop: 2 },
  kpiLabel:      { fontSize: FontSize.xs, color: Colors.textMuted },

  // Progress card
  progressCard:     { marginBottom: Spacing.lg },
  progressTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 },
  progressTitle:    { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary },
  progressRow:      { flexDirection: "row", justifyContent: "space-around" },
  progressStat:     { alignItems: "center" },
  progressNum:      { fontSize: FontSize.lg, fontWeight: "700" },
  progressLabel:    { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  lastAuditBox:     { marginTop: 14, backgroundColor: Colors.bg, borderRadius: Radius.md, padding: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: Colors.border },
  lastAuditLabel:   { fontSize: FontSize.xs, color: Colors.textMuted },
  lastAuditTitle:   { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary, marginTop: 2 },
  lastAuditPct:     { fontSize: FontSize.xl, fontWeight: "700", color: Colors.brand },
  lastAuditSub:     { fontSize: FontSize.xs, color: Colors.textMuted },

  // Scan CTA
  scanCta:       { flexDirection: "row", alignItems: "center", gap: Spacing.md, backgroundColor: Colors.brand, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md },
  scanCtaIconBox:{ width: 46, height: 46, borderRadius: Radius.md, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  scanCtaTitle:  { fontSize: FontSize.base, fontWeight: "700", color: Colors.white },
  scanCtaSub:    { fontSize: FontSize.xs, color: "rgba(255,255,255,0.65)", marginTop: 2 },

  // Quick actions
  quickActions:  { flexDirection: "row", gap: 10, marginBottom: Spacing.xl },
  quickBtn:      { flex: 1, alignItems: "center", paddingVertical: 14, backgroundColor: Colors.white, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  quickBtnIcon:  { width: 38, height: 38, borderRadius: Radius.md, backgroundColor: Colors.infoBg, alignItems: "center", justifyContent: "center" },
  quickBtnLabel: { fontSize: FontSize.xs, color: Colors.textPrimary, fontWeight: "600", textAlign: "center" },

  // Recent audits
  section:           { marginBottom: Spacing.lg },
  auditCard:         { marginBottom: Spacing.sm },
  auditTitle:        { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary, flex: 1 },
  auditMeta:         { fontSize: FontSize.xs, color: Colors.textMuted },
  miniProgress:      { height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: "hidden" },
  miniProgressFill:  { height: "100%", backgroundColor: Colors.brand, borderRadius: 2 },
  emptyAudits:       { alignItems: "center", paddingVertical: 24, gap: 8 },
  emptyAuditsText:   { fontSize: FontSize.sm, color: Colors.textMuted },
})
