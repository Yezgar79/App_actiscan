import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "expo-router"
import api from "@/lib/api"
import { DashboardStats, AuditSession } from "@/types"
import { useAuthStore } from "@/store/auth"
import { Card, SectionHeader, AssetStatusBadge } from "@/components/ui"
import { Colors, Spacing, Radius, FontSize } from "@/theme"

export default function HomeScreen() {
  const { user } = useAuthStore()
  const router = useRouter()

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/api/dashboard").then((r) => r.data),
    refetchInterval: 30_000,
  })

  const { data: audits } = useQuery<AuditSession[]>({
    queryKey: ["audits", "recent"],
    queryFn: () => api.get("/api/audits?limit=3").then((r) => r.data),
  })

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return "Buenos días"
    if (h < 18) return "Buenas tardes"
    return "Buenas noches"
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{greeting()}, {user?.name?.split(" ")[0]} 👋</Text>
          <Text style={styles.headerSub}>
            {new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
          </Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase()}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {[
            { label: "Total activos",    value: stats?.total_assets ?? 0,         color: Colors.textPrimary },
            { label: "Operativos",       value: stats?.operativo ?? 0,            color: Colors.success },
            { label: "No localizados",   value: stats?.no_localizado ?? 0,        color: Colors.danger },
            { label: "Auditados hoy",    value: stats?.assets_audited_today ?? 0, color: Colors.brand },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text style={[styles.statNum, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* CTA scan button */}
        <TouchableOpacity style={styles.scanCta} onPress={() => router.push("/(tabs)/scan")} activeOpacity={0.85}>
          <Text style={styles.scanCtaIcon}>📷</Text>
          <View>
            <Text style={styles.scanCtaTitle}>Escanear activo</Text>
            <Text style={styles.scanCtaSub}>Apunta la cámara al código QR</Text>
          </View>
        </TouchableOpacity>

        {/* Recent audits */}
        <View style={styles.section}>
          <SectionHeader title="Auditorías recientes" />
          {audits?.length === 0 && (
            <Text style={{ fontSize: FontSize.sm, color: Colors.textMuted, textAlign: "center", paddingVertical: 16 }}>
              Sin auditorías registradas aún
            </Text>
          )}
          {audits?.map((audit) => (
            <Card key={audit.id} style={styles.auditCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Text style={styles.auditTitle} numberOfLines={1}>{audit.title}</Text>
                <View style={{
                  paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full,
                  backgroundColor: audit.status === "en_curso" ? Colors.infoBg : Colors.successBg,
                }}>
                  <Text style={{
                    fontSize: FontSize.xs, fontWeight: "600",
                    color: audit.status === "en_curso" ? Colors.info : Colors.success,
                  }}>
                    {audit.status === "en_curso" ? "En curso" : "Completada"}
                  </Text>
                </View>
              </View>
              <Text style={styles.auditMeta}>{audit.auditor.name} · {audit.items.length} activos</Text>
            </Card>
          ))}
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.bg },
  header:   {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.brand, padding: Spacing.xl, paddingBottom: Spacing.lg,
  },
  greeting: { fontSize: FontSize.lg, fontWeight: "600", color: Colors.white },
  headerSub:{ fontSize: FontSize.sm, color: "rgba(255,255,255,0.6)", marginTop: 2, textTransform: "capitalize" },
  avatar:   {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: Colors.white, fontWeight: "700", fontSize: FontSize.md },
  scroll:     { flex: 1, padding: Spacing.lg },
  statsGrid:  { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: Spacing.lg },
  statCard:   {
    flex: 1, minWidth: "45%", backgroundColor: Colors.white,
    borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  statNum:   { fontSize: FontSize.xxl, fontWeight: "700" },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  scanCta:   {
    flexDirection: "row", alignItems: "center", gap: Spacing.md,
    backgroundColor: Colors.brand, borderRadius: Radius.lg,
    padding: Spacing.lg, marginBottom: Spacing.xl,
  },
  scanCtaIcon:  { fontSize: 28 },
  scanCtaTitle: { fontSize: FontSize.base, fontWeight: "600", color: Colors.white },
  scanCtaSub:   { fontSize: FontSize.xs, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  section:      { marginBottom: Spacing.lg },
  auditCard:    { marginBottom: Spacing.sm },
  auditTitle:   { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary, flex: 1, marginRight: 8 },
  auditMeta:    { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 4 },
})
