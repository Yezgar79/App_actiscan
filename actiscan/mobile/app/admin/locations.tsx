import { useState, useCallback } from "react"
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, Alert, ActivityIndicator,
} from "react-native"
import { useFocusEffect, useNavigation } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import api from "@/lib/api"
import { Colors, Spacing, Radius, FontSize } from "@/theme"

interface LocationItem {
  id: string
  name: string
  floor?: string
  building?: string
  description?: string
  is_active: boolean
}

export default function LocationsScreen() {
  const navigation = useNavigation()
  const [locations, setLocations]   = useState<LocationItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [modalOpen, setModalOpen]   = useState(false)
  const [editing, setEditing]       = useState<LocationItem | null>(null)
  const [saving, setSaving]         = useState(false)
  const [form, setForm] = useState({ name: "", floor: "", building: "", description: "" })

  useFocusEffect(useCallback(() => {
    navigation.setOptions({ title: "Ubicaciones" })
    fetchLocations()
  }, [showInactive]))

  async function fetchLocations() {
    setLoading(true)
    try {
      const { data } = await api.get("/api/locations", { params: { include_inactive: showInactive } })
      setLocations(Array.isArray(data) ? data : [])
    } catch {
      setLocations([])
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setForm({ name: "", floor: "", building: "", description: "" })
    setModalOpen(true)
  }

  function openEdit(loc: LocationItem) {
    setEditing(loc)
    setForm({ name: loc.name, floor: loc.floor ?? "", building: loc.building ?? "", description: loc.description ?? "" })
    setModalOpen(true)
  }

  async function save() {
    if (!form.name.trim()) {
      Alert.alert("Error", "El nombre de la ubicación es obligatorio.")
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        floor: form.floor.trim() || null,
        building: form.building.trim() || null,
        description: form.description.trim() || null,
      }
      if (!editing) {
        await api.post("/api/locations", payload)
      } else {
        await api.put(`/api/locations/${editing.id}`, payload)
      }
      setModalOpen(false)
      fetchLocations()
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.detail ?? "No se pudo guardar.")
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(loc: LocationItem) {
    const action = loc.is_active ? "desactivar" : "activar"
    Alert.alert(
      `¿${action.charAt(0).toUpperCase() + action.slice(1)} ubicación?`,
      `"${loc.name}" quedará ${loc.is_active ? "inactiva" : "activa"}.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: loc.is_active ? "Desactivar" : "Activar",
          style: loc.is_active ? "destructive" : "default",
          onPress: async () => {
            try {
              await api.put(`/api/locations/${loc.id}`, { name: loc.name, is_active: !loc.is_active })
              fetchLocations()
            } catch (err: any) {
              Alert.alert("Error", err?.response?.data?.detail ?? "No se pudo cambiar el estado.")
            }
          },
        },
      ]
    )
  }

  const renderItem = ({ item: loc }: { item: LocationItem }) => (
    <View style={[styles.row, !loc.is_active && { opacity: 0.6 }]}>
      <View style={styles.iconBox}>
        <Ionicons name="location" size={20} color={Colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.locName}>{loc.name}</Text>
        {(loc.building || loc.floor) && (
          <Text style={styles.locMeta}>
            {[loc.building, loc.floor].filter(Boolean).join(" — Piso ")}
          </Text>
        )}
        {!loc.is_active && (
          <View style={styles.inactiveBadge}>
            <Text style={styles.inactiveBadgeText}>Inactiva</Text>
          </View>
        )}
      </View>
      <View style={styles.rowActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(loc)}>
          <Ionicons name="pencil" size={16} color={Colors.brand} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => toggleActive(loc)}>
          <Ionicons
            name={loc.is_active ? "close-circle-outline" : "checkmark-circle-outline"}
            size={16}
            color={loc.is_active ? Colors.danger : Colors.success}
          />
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.toggleBtn, showInactive && styles.toggleBtnActive]}
          onPress={() => setShowInactive((v) => !v)}
        >
          <Ionicons name={showInactive ? "eye" : "eye-off-outline"} size={15} color={showInactive ? Colors.brand : Colors.textMuted} />
          <Text style={[styles.toggleText, showInactive && { color: Colors.brand }]}>
            {showInactive ? "Ocultar inactivas" : "Ver inactivas"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate}>
          <Ionicons name="add" size={20} color={Colors.white} />
          <Text style={styles.addBtnText}>Nueva</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.brand} />
      ) : (
        <FlatList
          data={locations}
          keyExtractor={(l) => l.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: Spacing.lg, gap: 8 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="location-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No hay ubicaciones registradas</Text>
            </View>
          }
        />
      )}

      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: Colors.bg }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editing ? "Editar ubicación" : "Nueva ubicación"}</Text>
            <TouchableOpacity onPress={() => setModalOpen(false)} style={{ padding: 4 }}>
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: Spacing.xl }} keyboardShouldPersistTaps="handled">
            <LabeledInput label="Nombre *" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Ej: Almacén General" />
            <LabeledInput label="Edificio" value={form.building} onChangeText={(v) => setForm({ ...form, building: v })} placeholder="Ej: Edificio A" />
            <LabeledInput label="Piso" value={form.floor} onChangeText={(v) => setForm({ ...form, floor: v })} placeholder="Ej: Planta baja" />
            <LabeledInput label="Descripción" value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} placeholder="Notas adicionales..." multiline />
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.saveBtnText}>{editing ? "Guardar" : "Crear"}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

function LabeledInput({ label, value, onChangeText, placeholder, multiline }: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; multiline?: boolean
}) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && { height: 80, textAlignVertical: "top" }]}
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        multiline={multiline}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Colors.bg },
  toolbar:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.lg },
  toggleBtn:    { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  toggleBtnActive: { borderColor: Colors.brand },
  toggleText:   { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: "600" },
  addBtn:       { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.brand, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText:   { color: Colors.white, fontWeight: "700", fontSize: FontSize.sm },
  row:          { flexDirection: "row", backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, alignItems: "center", gap: 10 },
  iconBox:      { width: 38, height: 38, borderRadius: Radius.md, backgroundColor: Colors.infoBg, alignItems: "center", justifyContent: "center" },
  locName:      { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary },
  locMeta:      { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  inactiveBadge:     { alignSelf: "flex-start", backgroundColor: Colors.dangerBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  inactiveBadgeText: { fontSize: 10, color: Colors.danger, fontWeight: "600" },
  rowActions:   { flexDirection: "row", gap: 4 },
  actionBtn:    { width: 34, height: 34, borderRadius: Radius.sm, backgroundColor: Colors.bg, alignItems: "center", justifyContent: "center" },
  empty:        { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText:    { fontSize: FontSize.sm, color: Colors.textMuted },
  modalHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.white },
  modalTitle:   { fontSize: FontSize.lg, fontWeight: "700", color: Colors.textPrimary },
  fieldLabel:   { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary, marginBottom: 6 },
  input:        { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: FontSize.base, color: Colors.textPrimary },
  saveBtn:      { backgroundColor: Colors.brand, borderRadius: Radius.lg, paddingVertical: 14, alignItems: "center", marginTop: Spacing.sm },
  saveBtnText:  { color: Colors.white, fontWeight: "700", fontSize: FontSize.base },
})
