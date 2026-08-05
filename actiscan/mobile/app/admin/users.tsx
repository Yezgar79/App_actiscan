import { useState, useCallback } from "react"
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, Alert, ActivityIndicator,
} from "react-native"
import { useFocusEffect } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useNavigation } from "expo-router"
import api from "@/lib/api"
import { Colors, Spacing, Radius, FontSize } from "@/theme"

type Role = "admin" | "super_admin" | "auditor" | "viewer"

interface UserItem {
  id: string
  name: string
  email: string
  username?: string
  role: Role
  is_active: boolean
  employee_number?: string
  last_login?: string
}

const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  auditor: "Auditor",
  viewer: "Visor",
}

const ROLE_COLORS: Record<Role, string> = {
  super_admin: "#7C3AED",
  admin: Colors.brand,
  auditor: Colors.success,
  viewer: Colors.textMuted,
}

export default function UsersScreen() {
  const navigation = useNavigation()

  const [users, setUsers]         = useState<UserItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("")
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState<UserItem | null>(null)
  const [saving, setSaving]       = useState(false)

  const [form, setForm] = useState({
    name: "", email: "", username: "", employee_number: "",
    role: "auditor" as Role, password: "", must_change_password: true,
  })

  useFocusEffect(useCallback(() => {
    navigation.setOptions({ title: "Usuarios" })
    fetchUsers()
  }, [search, roleFilter]))

  async function fetchUsers() {
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: "50" }
      if (search) params.search = search
      if (roleFilter) params.role = roleFilter
      const { data } = await api.get("/api/users", { params })
      setUsers(Array.isArray(data) ? data : [])
    } catch {
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setForm({ name: "", email: "", username: "", employee_number: "", role: "auditor", password: "", must_change_password: true })
    setModalOpen(true)
  }

  function openEdit(u: UserItem) {
    setEditing(u)
    setForm({ name: u.name, email: u.email, username: u.username ?? "", employee_number: u.employee_number ?? "", role: u.role, password: "", must_change_password: false })
    setModalOpen(true)
  }

  async function save() {
    if (!form.name.trim() || (!editing && !form.email.trim())) {
      Alert.alert("Error", "Nombre y correo son obligatorios.")
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, any> = {
        name: form.name.trim(),
        role: form.role,
        username: form.username.trim() || null,
        employee_number: form.employee_number.trim() || null,
        must_change_password: form.must_change_password,
      }
      if (!editing) {
        payload.email    = form.email.trim()
        payload.password = form.password
        await api.post("/api/users", payload)
        Alert.alert("Listo", "Usuario creado correctamente.")
      } else {
        await api.put(`/api/users/${editing.id}`, payload)
        Alert.alert("Listo", "Usuario actualizado.")
      }
      setModalOpen(false)
      fetchUsers()
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.detail ?? "No se pudo guardar.")
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(u: UserItem) {
    const action = u.is_active ? "desactivar" : "activar"
    Alert.alert(
      `¿${action.charAt(0).toUpperCase() + action.slice(1)} usuario?`,
      `${u.name} quedará ${u.is_active ? "inactivo" : "activo"}.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: u.is_active ? "Desactivar" : "Activar",
          style: u.is_active ? "destructive" : "default",
          onPress: async () => {
            try {
              await api.post(`/api/users/${u.id}/toggle-active`)
              fetchUsers()
            } catch (err: any) {
              Alert.alert("Error", err?.response?.data?.detail ?? "No se pudo cambiar el estado.")
            }
          },
        },
      ]
    )
  }

  async function resetPassword(u: UserItem) {
    try {
      const { data } = await api.post(`/api/users/${u.id}/generate-password`)
      Alert.alert(
        "Contraseña temporal",
        `Nueva contraseña para ${u.name}:\n\n${data.temp_password}\n\nEl usuario deberá cambiarla al iniciar sesión.`,
        [{ text: "Entendido" }]
      )
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.detail ?? "No se pudo generar contraseña.")
    }
  }

  const ROLES: Role[] = ["auditor", "viewer", "admin"]

  const renderUser = ({ item: u }: { item: UserItem }) => (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={[styles.avatar, { backgroundColor: ROLE_COLORS[u.role] + "22" }]}>
          <Text style={[styles.avatarText, { color: ROLE_COLORS[u.role] }]}>
            {u.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={styles.userName} numberOfLines={1}>{u.name}</Text>
            {!u.is_active && (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveBadgeText}>Inactivo</Text>
              </View>
            )}
          </View>
          <Text style={styles.userEmail} numberOfLines={1}>{u.email}</Text>
          <Text style={[styles.userRole, { color: ROLE_COLORS[u.role] }]}>
            {ROLE_LABELS[u.role]}
          </Text>
        </View>
      </View>
      <View style={styles.rowActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(u)}>
          <Ionicons name="pencil" size={16} color={Colors.brand} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => resetPassword(u)}>
          <Ionicons name="key-outline" size={16} color={Colors.warning} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => toggleActive(u)}>
          <Ionicons
            name={u.is_active ? "close-circle-outline" : "checkmark-circle-outline"}
            size={16}
            color={u.is_active ? Colors.danger : Colors.success}
          />
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      {/* Search + filter bar */}
      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar usuario..."
            value={search}
            onChangeText={(t) => { setSearch(t); fetchUsers() }}
            returnKeyType="search"
          />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Ionicons name="person-add" size={18} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Role filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={{ gap: 8, paddingHorizontal: Spacing.lg }}>
        {["", "auditor", "viewer", "admin"].map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.chip, roleFilter === r && styles.chipActive]}
            onPress={() => { setRoleFilter(r); fetchUsers() }}
          >
            <Text style={[styles.chipText, roleFilter === r && styles.chipTextActive]}>
              {r === "" ? "Todos" : ROLE_LABELS[r as Role]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.brand} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          renderItem={renderUser}
          contentContainerStyle={{ padding: Spacing.lg, gap: 8 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No hay usuarios</Text>
            </View>
          }
        />
      )}

      {/* Create / Edit modal */}
      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <SafeScrollView title={editing ? `Editar: ${editing.name}` : "Nuevo usuario"} onClose={() => setModalOpen(false)}>
          <Field label="Nombre completo *">
            <TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Juan Pérez García" />
          </Field>
          {!editing && (
            <Field label="Correo electrónico *">
              <TextInput style={styles.input} value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} keyboardType="email-address" autoCapitalize="none" placeholder="usuario@empresa.mx" />
            </Field>
          )}
          <Field label="Nombre de usuario">
            <TextInput style={styles.input} value={form.username} onChangeText={(v) => setForm({ ...form, username: v })} autoCapitalize="none" placeholder="juan.garcia" />
          </Field>
          <Field label="No. de empleado">
            <TextInput style={styles.input} value={form.employee_number} onChangeText={(v) => setForm({ ...form, employee_number: v })} placeholder="EMP-001" />
          </Field>
          <Field label="Rol">
            <View style={styles.roleRow}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, form.role === r && { backgroundColor: ROLE_COLORS[r], borderColor: ROLE_COLORS[r] }]}
                  onPress={() => setForm({ ...form, role: r })}
                >
                  <Text style={[styles.roleChipText, form.role === r && { color: Colors.white }]}>
                    {ROLE_LABELS[r]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>
          {!editing && (
            <Field label="Contraseña temporal">
              <TextInput style={styles.input} value={form.password} onChangeText={(v) => setForm({ ...form, password: v })} secureTextEntry placeholder="Mínimo 8 caracteres" />
            </Field>
          )}
          <TouchableOpacity
            style={[styles.checkRow]}
            onPress={() => setForm({ ...form, must_change_password: !form.must_change_password })}
          >
            <Ionicons
              name={form.must_change_password ? "checkbox" : "square-outline"}
              size={20}
              color={form.must_change_password ? Colors.brand : Colors.textMuted}
            />
            <Text style={styles.checkLabel}>Debe cambiar contraseña al iniciar sesión</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.saveBtnText}>{editing ? "Guardar cambios" : "Crear usuario"}</Text>}
          </TouchableOpacity>
        </SafeScrollView>
      </Modal>
    </View>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

function SafeScrollView({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.bg }}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>{title}</Text>
        <TouchableOpacity onPress={onClose} style={styles.modalClose}>
          <Ionicons name="close" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.xl }} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.bg },
  toolbar:      { flexDirection: "row", gap: 10, padding: Spacing.lg, paddingBottom: 8 },
  searchBox:    { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.white, borderRadius: Radius.md, paddingHorizontal: 12, height: 40, borderWidth: 1, borderColor: Colors.border },
  searchInput:  { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary },
  addBtn:       { width: 40, height: 40, backgroundColor: Colors.brand, borderRadius: Radius.md, alignItems: "center", justifyContent: "center" },
  chips:        { maxHeight: 48, marginBottom: 4 },
  chip:         { paddingHorizontal: 14, height: 32, borderRadius: 16, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, justifyContent: "center" },
  chipActive:   { backgroundColor: Colors.brand, borderColor: Colors.brand },
  chipText:     { fontSize: FontSize.xs, color: Colors.textPrimary, fontWeight: "600" },
  chipTextActive: { color: Colors.white },
  row:          { flexDirection: "row", backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 10 },
  rowLeft:      { flex: 1, flexDirection: "row", gap: 10, alignItems: "center" },
  avatar:       { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  avatarText:   { fontSize: FontSize.md, fontWeight: "700" },
  userName:     { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary },
  userEmail:    { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  userRole:     { fontSize: FontSize.xs, fontWeight: "600", marginTop: 2 },
  inactiveBadge:     { backgroundColor: Colors.dangerBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  inactiveBadgeText: { fontSize: 10, color: Colors.danger, fontWeight: "600" },
  rowActions:   { flexDirection: "row", gap: 4 },
  actionBtn:    { width: 34, height: 34, borderRadius: Radius.sm, backgroundColor: Colors.bg, alignItems: "center", justifyContent: "center" },
  empty:        { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText:    { fontSize: FontSize.sm, color: Colors.textMuted },
  modalHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.white },
  modalTitle:   { fontSize: FontSize.lg, fontWeight: "700", color: Colors.textPrimary },
  modalClose:   { padding: 4 },
  fieldLabel:   { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary, marginBottom: 6 },
  input:        { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: FontSize.base, color: Colors.textPrimary },
  roleRow:      { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  roleChip:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.white },
  roleChipText: { fontSize: FontSize.xs, fontWeight: "600", color: Colors.textPrimary },
  checkRow:     { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: Spacing.lg },
  checkLabel:   { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },
  saveBtn:      { backgroundColor: Colors.brand, borderRadius: Radius.lg, paddingVertical: 14, alignItems: "center", marginTop: Spacing.sm },
  saveBtnText:  { color: Colors.white, fontWeight: "700", fontSize: FontSize.base },
})
