import { useState, useCallback } from "react"
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from "react-native"
import { useFocusEffect, useNavigation, useRouter } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import api from "@/lib/api"
import { Colors, Spacing, Radius, FontSize } from "@/theme"

interface UserOption  { id: string; name: string; role: string }
interface LocOption   { id: string; name: string; building?: string }
interface AssetOption { id: string; name: string; code: string; status: string }

export default function AuditCreateScreen() {
  const navigation = useNavigation()
  const router     = useRouter()

  const [title, setTitle]         = useState("")
  const [description, setDescription] = useState("")
  const [auditorId, setAuditorId] = useState("")
  const [locationId, setLocationId] = useState("")
  const [plannedStart, setPlannedStart] = useState("")
  const [plannedEnd, setPlannedEnd]     = useState("")
  const [notes, setNotes]         = useState("")

  const [auditors, setAuditors]   = useState<UserOption[]>([])
  const [locations, setLocations] = useState<LocOption[]>([])
  const [saving, setSaving]       = useState(false)

  useFocusEffect(useCallback(() => {
    navigation.setOptions({ title: "Nueva auditoría" })
    loadOptions()
  }, []))

  async function loadOptions() {
    try {
      const [audR, locR] = await Promise.all([
        api.get("/api/users", { params: { role: "auditor", limit: 100 } }),
        api.get("/api/locations", { params: { include_inactive: false } }),
      ])
      setAuditors(Array.isArray(audR.data) ? audR.data : [])
      setLocations(Array.isArray(locR.data) ? locR.data : [])
    } catch { /* ignore */ }
  }

  async function submit() {
    if (!title.trim()) { Alert.alert("Error", "El título es obligatorio."); return }
    if (!auditorId)    { Alert.alert("Error", "Debes asignar un capturista."); return }
    setSaving(true)
    try {
      const payload: Record<string, any> = {
        title: title.trim(),
        description: description.trim() || null,
        auditor_id: auditorId,
        location_id: locationId || null,
        notes: notes.trim() || null,
      }
      if (plannedStart) payload.planned_start = plannedStart + ":00"
      if (plannedEnd)   payload.planned_end   = plannedEnd   + ":00"

      const { data } = await api.post("/api/audits", payload)
      Alert.alert("Listo", `Auditoría ${data.audit_code ?? ""} creada correctamente.`, [
        { text: "Ver revisión", onPress: () => router.push({ pathname: "/admin/audit-review", params: { id: data.id } }) },
        { text: "OK", onPress: () => router.back() },
      ])
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.detail ?? "No se pudo crear la auditoría.")
    } finally {
      setSaving(false)
    }
  }

  const selectedAuditor  = auditors.find((a) => a.id === auditorId)
  const selectedLocation = locations.find((l) => l.id === locationId)

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={{ padding: Spacing.lg, gap: 16 }} keyboardShouldPersistTaps="handled">
      <Field label="Título *">
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ej: Auditoría Almacén Norte Q3 2026" />
      </Field>

      <Field label="Descripción">
        <TextInput style={[styles.input, { height: 72, textAlignVertical: "top" }]} value={description} onChangeText={setDescription} placeholder="Objetivo y alcance..." multiline />
      </Field>

      <Field label="Capturista asignado *">
        <Picker
          value={selectedAuditor?.name ?? "Seleccionar..."}
          items={auditors}
          onSelect={(id) => setAuditorId(id)}
          selected={auditorId}
          labelKey="name"
          icon="person-outline"
        />
      </Field>

      <Field label="Sede / Ubicación">
        <Picker
          value={selectedLocation?.name ?? "Todas las ubicaciones"}
          items={[{ id: "", name: "Sin filtro de ubicación" }, ...locations]}
          onSelect={(id) => setLocationId(id)}
          selected={locationId}
          labelKey="name"
          icon="location-outline"
        />
      </Field>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <Field label="Fecha inicio (prevista)" style={{ flex: 1 }}>
          <TextInput style={styles.input} value={plannedStart} onChangeText={setPlannedStart} placeholder="AAAA-MM-DDTHH:mm" />
        </Field>
        <Field label="Fecha fin (prevista)" style={{ flex: 1 }}>
          <TextInput style={styles.input} value={plannedEnd} onChangeText={setPlannedEnd} placeholder="AAAA-MM-DDTHH:mm" />
        </Field>
      </View>

      <Field label="Notas internas">
        <TextInput style={[styles.input, { height: 60, textAlignVertical: "top" }]} value={notes} onChangeText={setNotes} placeholder="Instrucciones para el capturista..." multiline />
      </Field>

      <TouchableOpacity style={[styles.submitBtn, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
        {saving ? (
          <ActivityIndicator color={Colors.white} size="small" />
        ) : (
          <>
            <Ionicons name="clipboard-outline" size={18} color={Colors.white} />
            <Text style={styles.submitBtnText}>Crear auditoría</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={{ height: Spacing.xxl }} />
    </ScrollView>
  )
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: any }) {
  return (
    <View style={style}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

function Picker({ value, items, onSelect, selected, labelKey, icon }: {
  value: string; items: any[]; onSelect: (id: string) => void; selected: string; labelKey: string; icon: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <View>
      <TouchableOpacity style={styles.pickerBtn} onPress={() => setOpen((v) => !v)}>
        <Ionicons name={icon as any} size={16} color={Colors.textMuted} />
        <Text style={[styles.pickerValue, !selected && { color: Colors.textMuted }]} numberOfLines={1}>{value}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={Colors.textMuted} />
      </TouchableOpacity>
      {open && (
        <View style={styles.pickerDropdown}>
          {items.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.pickerItem, item.id === selected && styles.pickerItemActive]}
              onPress={() => { onSelect(item.id); setOpen(false) }}
            >
              <Text style={[styles.pickerItemText, item.id === selected && { color: Colors.brand, fontWeight: "700" }]}>
                {item[labelKey]}
              </Text>
              {item.id === selected && <Ionicons name="checkmark" size={14} color={Colors.brand} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  scroll:       { flex: 1, backgroundColor: Colors.bg },
  fieldLabel:   { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary, marginBottom: 6 },
  input:        { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: FontSize.base, color: Colors.textPrimary },
  pickerBtn:    { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 11 },
  pickerValue:  { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary },
  pickerDropdown: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, marginTop: 4, maxHeight: 200, overflow: "hidden" },
  pickerItem:   { paddingHorizontal: 14, paddingVertical: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickerItemActive: { backgroundColor: Colors.infoBg },
  pickerItemText: { fontSize: FontSize.base, color: Colors.textPrimary },
  submitBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.brand, borderRadius: Radius.lg, paddingVertical: 14 },
  submitBtnText: { color: Colors.white, fontWeight: "700", fontSize: FontSize.base },
})
