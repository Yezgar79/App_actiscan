import { useState, useCallback } from "react"
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, Alert, ActivityIndicator,
} from "react-native"
import { useFocusEffect, useNavigation } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import api from "@/lib/api"
import { Colors, Spacing, Radius, FontSize } from "@/theme"

interface CategoryItem {
  id: string
  name: string
  description?: string
  is_active: boolean
}

export default function CategoriesScreen() {
  const navigation = useNavigation()
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [modalOpen, setModalOpen]   = useState(false)
  const [editing, setEditing]       = useState<CategoryItem | null>(null)
  const [saving, setSaving]         = useState(false)
  const [form, setForm] = useState({ name: "", description: "" })

  useFocusEffect(useCallback(() => {
    navigation.setOptions({ title: "Catálogos" })
    fetchCategories()
  }, [showInactive]))

  async function fetchCategories() {
    setLoading(true)
    try {
      const { data } = await api.get("/api/categories", { params: { include_inactive: showInactive } })
      setCategories(Array.isArray(data) ? data : [])
    } catch {
      setCategories([])
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setForm({ name: "", description: "" })
    setModalOpen(true)
  }

  function openEdit(cat: CategoryItem) {
    setEditing(cat)
    setForm({ name: cat.name, description: cat.description ?? "" })
    setModalOpen(true)
  }

  async function save() {
    if (!form.name.trim()) {
      Alert.alert("Error", "El nombre de la categoría es obligatorio.")
      return
    }
    setSaving(true)
    try {
      const payload = { name: form.name.trim(), description: form.description.trim() || null }
      if (!editing) {
        await api.post("/api/categories", payload)
      } else {
        await api.put(`/api/categories/${editing.id}`, payload)
      }
      setModalOpen(false)
      fetchCategories()
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.detail ?? "No se pudo guardar.")
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(cat: CategoryItem) {
    try {
      await api.put(`/api/categories/${cat.id}`, { name: cat.name, is_active: !cat.is_active })
      fetchCategories()
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.detail ?? "No se pudo cambiar el estado.")
    }
  }

  const renderItem = ({ item: cat }: { item: CategoryItem }) => (
    <View style={[styles.row, !cat.is_active && { opacity: 0.6 }]}>
      <View style={styles.iconBox}>
        <Ionicons name="pricetag" size={18} color="#D97706" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.catName}>{cat.name}</Text>
        {cat.description && <Text style={styles.catDesc} numberOfLines={1}>{cat.description}</Text>}
        {!cat.is_active && (
          <View style={styles.inactiveBadge}>
            <Text style={styles.inactiveBadgeText}>Inactiva</Text>
          </View>
        )}
      </View>
      <View style={styles.rowActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(cat)}>
          <Ionicons name="pencil" size={16} color={Colors.brand} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => toggleActive(cat)}>
          <Ionicons
            name={cat.is_active ? "close-circle-outline" : "checkmark-circle-outline"}
            size={16}
            color={cat.is_active ? Colors.danger : Colors.success}
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
          data={categories}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: Spacing.lg, gap: 8 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="pricetags-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No hay categorías registradas</Text>
            </View>
          }
        />
      )}

      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: Colors.bg }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editing ? "Editar categoría" : "Nueva categoría"}</Text>
            <TouchableOpacity onPress={() => setModalOpen(false)} style={{ padding: 4 }}>
              <Ionicons name="close" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: Spacing.xl }} keyboardShouldPersistTaps="handled">
            <View style={{ marginBottom: Spacing.md }}>
              <Text style={styles.fieldLabel}>Nombre *</Text>
              <TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Ej: Equipo de Cómputo" />
            </View>
            <View style={{ marginBottom: Spacing.lg }}>
              <Text style={styles.fieldLabel}>Descripción</Text>
              <TextInput style={[styles.input, { height: 80, textAlignVertical: "top" }]} value={form.description} onChangeText={(v) => setForm({ ...form, description: v })} placeholder="Descripción opcional..." multiline />
            </View>
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.saveBtnText}>{editing ? "Guardar" : "Crear"}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
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
  iconBox:      { width: 38, height: 38, borderRadius: Radius.md, backgroundColor: "#FEF3C7", alignItems: "center", justifyContent: "center" },
  catName:      { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary },
  catDesc:      { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
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
