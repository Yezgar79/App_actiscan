import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { useAuthStore } from "@/store/auth"
import { Colors, Spacing, Radius, FontSize } from "@/theme"

const MenuRow = ({ emoji, label, onPress }: { emoji: string; label: string; onPress?: () => void }) => (
  <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
    <Text style={styles.menuEmoji}>{emoji}</Text>
    <Text style={styles.menuLabel}>{label}</Text>
    <Text style={{ color: Colors.textMuted, fontSize: 16 }}>›</Text>
  </TouchableOpacity>
)

export default function ProfileScreen() {
  const { user, logout } = useAuthStore()
  const router = useRouter()

  const handleLogout = () => {
    Alert.alert("Cerrar sesión", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar sesión", style: "destructive", onPress: async () => {
        await logout()
        router.replace("/login")
      }},
    ])
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView>
        {/* Profile header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.roleChip}>
            <Text style={styles.roleText}>{user?.role}</Text>
          </View>
          {user?.assigned_location && (
            <Text style={styles.location}>📍 {user.assigned_location}</Text>
          )}
        </View>

        {/* Security info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seguridad</Text>
          <View style={styles.securityCard}>
            <View style={styles.secRow}>
              <Text>🔒</Text>
              <Text style={styles.secText}>Sesión autenticada con JWT</Text>
            </View>
            <View style={styles.secRow}>
              <Text>🛡️</Text>
              <Text style={styles.secText}>Comunicación cifrada con SSL</Text>
            </View>
            <View style={styles.secRow}>
              <Text>🔑</Text>
              <Text style={styles.secText}>Tokens guardados en SecureStore</Text>
            </View>
          </View>
        </View>

        {/* Settings menu */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuración</Text>
          <View style={styles.menuCard}>
            <MenuRow emoji="🔔" label="Notificaciones" />
            <MenuRow emoji="🗺️" label="Sede asignada" />
            <MenuRow emoji="📄" label="Mis reportes" />
            <MenuRow emoji="❓" label="Ayuda y soporte" />
          </View>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Text style={styles.logoutText}>🚪 Cerrar sesión</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  header: { backgroundColor: Colors.brand, alignItems: "center", padding: Spacing.xxl, paddingBottom: 28 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  avatarText: { fontSize: FontSize.xxl, fontWeight: "700", color: Colors.white },
  name:       { fontSize: FontSize.lg, fontWeight: "600", color: Colors.white },
  email:      { fontSize: FontSize.sm, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  roleChip:   {
    marginTop: 10, backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 4,
  },
  roleText:   { color: Colors.white, fontSize: FontSize.xs, fontWeight: "600", textTransform: "capitalize" },
  location:   { marginTop: 6, fontSize: FontSize.xs, color: "rgba(255,255,255,0.55)" },
  section:    { padding: Spacing.lg, paddingBottom: 0 },
  sectionTitle: { fontSize: FontSize.xs, fontWeight: "600", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },
  securityCard: {
    backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, gap: 10,
  },
  secRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  secText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  menuCard: {
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  menuEmoji: { fontSize: 18, width: 24 },
  menuLabel: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary },
  logoutBtn: {
    backgroundColor: Colors.dangerBg, borderRadius: Radius.lg, padding: 14,
    alignItems: "center", borderWidth: 1, borderColor: "#fca5a5",
  },
  logoutText: { fontSize: FontSize.base, fontWeight: "600", color: Colors.danger },
})
