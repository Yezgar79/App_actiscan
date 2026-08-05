import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, useWindowDimensions, Redirect,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useAuthStore } from "@/store/auth"
import { Colors, Spacing, Radius, FontSize } from "@/theme"

type IoniconName = React.ComponentProps<typeof Ionicons>["name"]

interface AdminSection {
  icon: IoniconName
  label: string
  subtitle: string
  route: string
  color: string
  bg: string
}

const SECTIONS: AdminSection[] = [
  {
    icon: "people",
    label: "Usuarios",
    subtitle: "Crear, editar y gestionar cuentas",
    route: "/admin/users",
    color: Colors.brand,
    bg: Colors.infoBg,
  },
  {
    icon: "geo-alt",
    label: "Ubicaciones",
    subtitle: "Sedes, edificios, pisos y áreas",
    route: "/admin/locations",
    color: "#7C3AED",
    bg: "#EDE9FE",
  },
  {
    icon: "pricetags",
    label: "Catálogos",
    subtitle: "Categorías y clasificaciones",
    route: "/admin/categories",
    color: "#D97706",
    bg: "#FEF3C7",
  },
  {
    icon: "clipboard",
    label: "Crear auditoría",
    subtitle: "Asignar activos y capturistas",
    route: "/admin/audit-create",
    color: Colors.success,
    bg: Colors.successBg,
  },
  {
    icon: "checkmark-done-circle",
    label: "Revisar auditorías",
    subtitle: "Aprobar o devolver hallazgos",
    route: "/admin/audit-review",
    color: "#059669",
    bg: "#D1FAE5",
  },
  {
    icon: "bar-chart",
    label: "Reportes",
    subtitle: "Activos y auditorías por filtro",
    route: "/admin/reports",
    color: "#2563EB",
    bg: "#DBEAFE",
  },
]

export default function AdminHubScreen() {
  const { user } = useAuthStore()
  const router = useRouter()
  const { width } = useWindowDimensions()
  const numCols = width >= 600 ? 3 : 2

  if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
    return <Redirect href="/(tabs)/home" />
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Administración</Text>
          <Text style={styles.headerSub}>
            {user.role === "super_admin" ? "Super Administrador" : "Administrador"}
          </Text>
        </View>
        <View style={styles.badge}>
          <Ionicons name="shield-checkmark" size={20} color={Colors.white} />
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.grid, { gap: 12 }]}>
          {SECTIONS.map((s) => (
            <TouchableOpacity
              key={s.route}
              style={[styles.card, numCols === 3 && { flex: 1 / 3 }]}
              onPress={() => router.push(s.route as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconBox, { backgroundColor: s.bg }]}>
                <Ionicons name={s.icon} size={24} color={s.color} />
              </View>
              <Text style={styles.cardLabel}>{s.label}</Text>
              <Text style={styles.cardSub} numberOfLines={2}>{s.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: Colors.bg },
  header:     {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: Colors.brand, padding: Spacing.xl, paddingBottom: Spacing.lg,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: "700", color: Colors.white },
  headerSub:   { fontSize: FontSize.sm, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  badge:       {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  scroll:  { flex: 1 },
  grid:    { flexDirection: "row", flexWrap: "wrap", padding: Spacing.lg },
  card:    {
    flexBasis: "47%", backgroundColor: Colors.white,
    borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
    gap: 8,
  },
  iconBox:   {
    width: 46, height: 46, borderRadius: Radius.md,
    alignItems: "center", justifyContent: "center",
  },
  cardLabel: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  cardSub:   { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 16 },
})
