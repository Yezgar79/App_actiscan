import { useState } from "react"
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { useMutation } from "@tanstack/react-query"
import Constants from "expo-constants"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Ionicons } from "@expo/vector-icons"
import { useAuthStore } from "@/store/auth"
import { Colors, Spacing, Radius, FontSize } from "@/theme"
import api from "@/lib/api"

type IoniconName = React.ComponentProps<typeof Ionicons>["name"]

// ─── Change-password modal ────────────────────────────────────────────────────

function ChangePasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [current, setCurrent]       = useState("")
  const [next, setNext]             = useState("")
  const [confirm, setConfirm]       = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext]       = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const reset = () => { setCurrent(""); setNext(""); setConfirm("") }

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/api/auth/change-password", { current_password: current, new_password: next }),
    onSuccess: () => {
      Alert.alert("Contraseña actualizada", "Tu contraseña ha sido cambiada correctamente.")
      reset()
      onClose()
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      Alert.alert("Error", detail ?? "No se pudo cambiar la contraseña")
    },
  })

  const handleSubmit = () => {
    if (!current.trim() || !next.trim() || !confirm.trim()) {
      Alert.alert("Campos requeridos", "Completa todos los campos"); return
    }
    if (next.length < 8) {
      Alert.alert("Contraseña muy corta", "La nueva contraseña debe tener al menos 8 caracteres"); return
    }
    if (next !== confirm) {
      Alert.alert("No coinciden", "La nueva contraseña y su confirmación no son iguales"); return
    }
    mutation.mutate()
  }

  const PasswordField = ({
    label, value, onChange, show, onToggle, placeholder,
  }: {
    label: string; value: string; onChange: (v: string) => void;
    show: boolean; onToggle: () => void; placeholder?: string;
  }) => (
    <View>
      <Text style={cp.label}>{label}</Text>
      <View style={cp.inputRow}>
        <TextInput
          style={[cp.input, { flex: 1 }]}
          value={value}
          onChangeText={onChange}
          secureTextEntry={!show}
          placeholder={placeholder ?? "••••••••"}
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
        />
        <TouchableOpacity style={cp.eye} onPress={onToggle}>
          <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { reset(); onClose() }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Cambiar contraseña</Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => { reset(); onClose() }}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.xl, gap: 18 }}>
            <View style={styles.hintBox}>
              <Ionicons name="shield-outline" size={16} color={Colors.info} />
              <Text style={styles.hintText}>Elige una contraseña segura con mayúsculas, minúsculas, números y símbolos.</Text>
            </View>

            <PasswordField
              label="Contraseña actual"
              value={current}
              onChange={setCurrent}
              show={showCurrent}
              onToggle={() => setShowCurrent(!showCurrent)}
            />
            <PasswordField
              label="Nueva contraseña"
              value={next}
              onChange={setNext}
              show={showNext}
              onToggle={() => setShowNext(!showNext)}
              placeholder="Mínimo 8 caracteres"
            />
            {next.length > 0 && next.length < 8 && (
              <Text style={{ fontSize: FontSize.xs, color: Colors.danger, marginTop: -12 }}>
                Mínimo 8 caracteres ({next.length}/8)
              </Text>
            )}
            <PasswordField
              label="Confirmar nueva contraseña"
              value={confirm}
              onChange={setConfirm}
              show={showConfirm}
              onToggle={() => setShowConfirm(!showConfirm)}
              placeholder="Repite la nueva contraseña"
            />
            {confirm.length > 0 && next !== confirm && (
              <Text style={{ fontSize: FontSize.xs, color: Colors.danger, marginTop: -12 }}>Las contraseñas no coinciden</Text>
            )}

            <TouchableOpacity
              style={[cp.submitBtn, mutation.isPending && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={mutation.isPending}
            >
              {mutation.isPending
                ? <ActivityIndicator color={Colors.white} />
                : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.white} />
                    <Text style={cp.submitText}>Guardar contraseña</Text>
                  </View>
                )
              }
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const cp = StyleSheet.create({
  label:      { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary, marginBottom: 6 },
  inputRow:   { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, backgroundColor: Colors.white, overflow: "hidden" },
  input:      { paddingHorizontal: 12, paddingVertical: 12, fontSize: FontSize.base, color: Colors.textPrimary },
  eye:        { paddingHorizontal: 12, justifyContent: "center" },
  submitBtn:  { backgroundColor: Colors.brand, borderRadius: Radius.lg, padding: 14, alignItems: "center", marginTop: 8 },
  submitText: { color: Colors.white, fontWeight: "700", fontSize: FontSize.base },
})

// ─── Menu row ────────────────────────────────────────────────────────────────

function MenuRow({
  icon, label, subtitle, onPress, danger, showChevron = true,
}: {
  icon: IoniconName; label: string; subtitle?: string;
  onPress?: () => void; danger?: boolean; showChevron?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIconBox, danger && { backgroundColor: Colors.dangerBg }]}>
        <Ionicons name={icon} size={18} color={danger ? Colors.danger : Colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuLabel, danger && { color: Colors.danger }]}>{label}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      {showChevron && !danger && (
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      )}
    </TouchableOpacity>
  )
}

// ─── Security badge row ────────────────────────────────────────────────────

function SecurityRow({ icon, text }: { icon: IoniconName; text: string }) {
  return (
    <View style={styles.secRow}>
      <View style={styles.secIconBox}>
        <Ionicons name={icon} size={14} color={Colors.success} />
      </View>
      <Text style={styles.secText}>{text}</Text>
    </View>
  )
}

// ─── Main profile screen ──────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, logout }   = useAuthStore()
  const router             = useRouter()
  const [showChangePw, setShowChangePw] = useState(false)

  const appVersion  = Constants.expoConfig?.version ?? "1.0.0"
  const buildNumber = Constants.expoConfig?.ios?.buildNumber
    ?? Constants.expoConfig?.android?.versionCode
    ?? null

  const handleLogout = () => {
    Alert.alert("Cerrar sesión", "¿Estás seguro de que quieres cerrar tu sesión?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión", style: "destructive", onPress: async () => {
          await logout()
          router.replace("/login")
        },
      },
    ])
  }

  const roleLabel: Record<string, string> = {
    super_admin: "Super Administrador",
    admin:       "Administrador",
    auditor:     "Capturista",
    viewer:      "Visualizador",
  }

  const roleIcon: Record<string, IoniconName> = {
    super_admin: "shield-checkmark-outline",
    admin:       "shield-outline",
    auditor:     "scan-outline",
    viewer:      "eye-outline",
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Profile header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.roleChip}>
            <Ionicons name={roleIcon[user?.role ?? "viewer"]} size={12} color={Colors.white} />
            <Text style={styles.roleText}>{roleLabel[user?.role ?? ""] ?? user?.role}</Text>
          </View>
          {user?.assigned_location && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.6)" />
              <Text style={styles.location}>{user.assigned_location}</Text>
            </View>
          )}
        </View>

        {/* Last access */}
        {user?.last_login && (
          <View style={styles.section}>
            <View style={styles.infoCard}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.infoLabel}>Último acceso</Text>
              </View>
              <Text style={styles.infoValue}>
                {format(new Date(user.last_login), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
              </Text>
            </View>
          </View>
        )}

        {/* Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seguridad</Text>
          <View style={styles.menuCard}>
            <MenuRow
              icon="key-outline"
              label="Cambiar contraseña"
              subtitle="Actualiza tu contraseña de acceso"
              onPress={() => setShowChangePw(true)}
            />
          </View>
          <View style={styles.securityCard}>
            <SecurityRow icon="shield-checkmark-outline" text="Sesión autenticada con JWT" />
            <SecurityRow icon="lock-closed-outline"     text="Comunicación cifrada con SSL" />
            <SecurityRow icon="phone-portrait-outline"  text="Tokens guardados en SecureStore" />
          </View>
        </View>

        {/* Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información</Text>
          <View style={styles.menuCard}>
            <MenuRow icon="notifications-outline" label="Notificaciones"  subtitle="Preferencias de alertas"            />
            <MenuRow icon="business-outline"      label="Sede asignada"   subtitle={user?.assigned_location ?? "No asignada"} />
            <MenuRow icon="help-circle-outline"   label="Ayuda y soporte"                                               />
          </View>
        </View>

        {/* App version */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aplicación</Text>
          <View style={styles.versionCard}>
            <View style={styles.versionIconBox}>
              <Ionicons name="scan-outline" size={24} color={Colors.brand} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.versionName}>ActiScan Mobile</Text>
              <Text style={styles.versionNumber}>
                Versión {appVersion}{buildNumber ? ` (build ${buildNumber})` : ""}
              </Text>
            </View>
            <View style={styles.versionBadge}>
              <Text style={styles.versionBadgeText}>Actual</Text>
            </View>
          </View>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <ChangePasswordModal visible={showChangePw} onClose={() => setShowChangePw(false)} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: Colors.bg },

  // Header
  header:        { backgroundColor: Colors.brand, alignItems: "center", padding: Spacing.xxl, paddingBottom: 28 },
  avatar:        { width: 76, height: 76, borderRadius: 38, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 12, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)" },
  avatarText:    { fontSize: FontSize.xxl, fontWeight: "700", color: Colors.white },
  name:          { fontSize: FontSize.lg, fontWeight: "700", color: Colors.white },
  email:         { fontSize: FontSize.sm, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  roleChip:      { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 5 },
  roleText:      { color: Colors.white, fontSize: FontSize.xs, fontWeight: "600" },
  locationRow:   { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  location:      { fontSize: FontSize.xs, color: "rgba(255,255,255,0.55)" },

  // Sections
  section:       { padding: Spacing.lg, paddingBottom: 0 },
  sectionTitle:  { fontSize: FontSize.xs, fontWeight: "700", color: Colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },

  // Info card
  infoCard:      { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  infoLabel:     { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  infoValue:     { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: "600" },

  // Menu card
  menuCard:      { backgroundColor: Colors.white, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, overflow: "hidden" },
  menuRow:       { flexDirection: "row", alignItems: "center", gap: 12, padding: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  menuIconBox:   { width: 34, height: 34, borderRadius: Radius.md, backgroundColor: Colors.infoBg, alignItems: "center", justifyContent: "center" },
  menuLabel:     { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: "500" },
  menuSubtitle:  { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },

  // Security card
  securityCard:  { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, gap: 10, marginTop: 8 },
  secRow:        { flexDirection: "row", alignItems: "center", gap: 10 },
  secIconBox:    { width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.successBg, alignItems: "center", justifyContent: "center" },
  secText:       { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },

  // Version card
  versionCard:    { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, flexDirection: "row", alignItems: "center" },
  versionIconBox: { width: 46, height: 46, borderRadius: Radius.md, backgroundColor: Colors.infoBg, alignItems: "center", justifyContent: "center" },
  versionName:    { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  versionNumber:  { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  versionBadge:   { backgroundColor: Colors.successBg, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  versionBadgeText:{ fontSize: FontSize.xs, color: Colors.success, fontWeight: "700" },

  // Logout
  logoutBtn:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.dangerBg, borderRadius: Radius.lg, padding: 14, borderWidth: 1, borderColor: "#fca5a5" },
  logoutText:    { fontSize: FontSize.base, fontWeight: "600", color: Colors.danger },

  // Modal
  modalHeader:   { backgroundColor: Colors.brand, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.xl, paddingBottom: Spacing.lg },
  modalTitle:    { fontSize: FontSize.lg, fontWeight: "700", color: Colors.white },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  hintBox:       { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: Colors.infoBg, borderRadius: Radius.md, padding: Spacing.md },
  hintText:      { flex: 1, fontSize: FontSize.sm, color: Colors.info, lineHeight: 20 },
})
