import { useState } from "react"
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  Modal, ScrollView, Alert, KeyboardAvoidingView, Platform,
  ActivityIndicator, useWindowDimensions,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import api from "@/lib/api"
import { Asset, AssetStatus, Category, Location } from "@/types"
import { AssetStatusBadge, Spinner } from "@/components/ui"
import { Colors, Spacing, Radius, FontSize } from "@/theme"

// ─── Types ────────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: "" as const,            label: "Todos",     icon: "apps-outline" as const },
  { value: "operativo" as const,   label: "Operativo", icon: "checkmark-circle-outline" as const },
  { value: "mantenimiento" as const, label: "Mant.",   icon: "construct-outline" as const },
  { value: "no_localizado" as const, label: "No hallado", icon: "warning-outline" as const },
]

const STATUS_OPTIONS: { value: AssetStatus; label: string; color: string }[] = [
  { value: "operativo",     label: "Operativo",     color: Colors.success },
  { value: "mantenimiento", label: "Mantenimiento", color: Colors.warning },
  { value: "baja",          label: "Baja",          color: Colors.textSecondary },
  { value: "no_localizado", label: "No localizado", color: Colors.danger },
]

interface AssetFormData {
  name: string
  description: string
  brand: string
  model: string
  serial_number: string
  status: AssetStatus
  category_id: string
  location_id: string
  acquisition_value: string
}

const EMPTY_FORM: AssetFormData = {
  name: "", description: "", brand: "", model: "",
  serial_number: "", status: "operativo",
  category_id: "", location_id: "", acquisition_value: "",
}

// ─── Category icon mapping ─────────────────────────────────────────────────────

function getCategoryIcon(name?: string): React.ComponentProps<typeof Ionicons>["name"] {
  const lower = (name ?? "").toLowerCase()
  if (lower.includes("comp") || lower.includes("laptop") || lower.includes("pc")) return "laptop-outline"
  if (lower.includes("mob") || lower.includes("cel") || lower.includes("phone")) return "phone-portrait-outline"
  if (lower.includes("red") || lower.includes("network") || lower.includes("switch")) return "git-network-outline"
  if (lower.includes("mueble") || lower.includes("silla") || lower.includes("escritorio")) return "desktop-outline"
  if (lower.includes("impres") || lower.includes("print")) return "print-outline"
  if (lower.includes("audio") || lower.includes("camara") || lower.includes("video")) return "videocam-outline"
  return "cube-outline"
}

// ─── Add Asset Modal ──────────────────────────────────────────────────────────

function AddAssetModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<AssetFormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<AssetFormData>>({})

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api.get("/api/categories").then((r) => r.data),
    enabled: visible,
  })

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["locations"],
    queryFn: () => api.get("/api/locations").then((r) => r.data),
    enabled: visible,
  })

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/api/assets", {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        brand: form.brand.trim() || undefined,
        model: form.model.trim() || undefined,
        serial_number: form.serial_number.trim() || undefined,
        status: form.status,
        category_id: form.category_id || undefined,
        location_id: form.location_id || undefined,
        acquisition_value: form.acquisition_value ? parseFloat(form.acquisition_value) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] })
      Alert.alert("Activo creado", "El activo fue registrado correctamente.")
      setForm(EMPTY_FORM)
      onClose()
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      Alert.alert("Error", detail ?? "No se pudo crear el activo")
    },
  })

  const validate = () => {
    const e: Partial<AssetFormData> = {}
    if (!form.name.trim()) e.name = "El nombre es requerido"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    mutation.mutate()
  }

  const handleClose = () => {
    setForm(EMPTY_FORM)
    setErrors({})
    onClose()
  }

  const update = (key: keyof AssetFormData, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
          {/* Header */}
          <View style={modal.header}>
            <View style={{ flex: 1 }}>
              <Text style={modal.headerTitle}>Nuevo activo</Text>
              <Text style={modal.headerSub}>Completa los datos del activo</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={modal.closeBtn}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: Spacing.lg, gap: 20 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Name */}
            <View>
              <Text style={modal.label}>Nombre <Text style={{ color: Colors.danger }}>*</Text></Text>
              <TextInput
                style={[modal.input, !!errors.name && modal.inputError]}
                value={form.name}
                onChangeText={(v) => update("name", v)}
                placeholder="Ej. Laptop Dell Inspiron 15"
                placeholderTextColor={Colors.textMuted}
              />
              {!!errors.name && <Text style={modal.errorText}>{errors.name}</Text>}
            </View>

            {/* Status */}
            <View>
              <Text style={modal.label}>Estado</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {STATUS_OPTIONS.map((s) => (
                  <TouchableOpacity
                    key={s.value}
                    style={[
                      modal.chip,
                      form.status === s.value && { backgroundColor: s.color, borderColor: s.color },
                    ]}
                    onPress={() => update("status", s.value)}
                  >
                    <Text style={[modal.chipText, form.status === s.value && { color: Colors.white }]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Brand & Model */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={modal.label}>Marca</Text>
                <TextInput
                  style={modal.input}
                  value={form.brand}
                  onChangeText={(v) => update("brand", v)}
                  placeholder="Dell, HP, Apple..."
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={modal.label}>Modelo</Text>
                <TextInput
                  style={modal.input}
                  value={form.model}
                  onChangeText={(v) => update("model", v)}
                  placeholder="Inspiron 15"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            {/* Serial Number */}
            <View>
              <Text style={modal.label}>Número de serie</Text>
              <TextInput
                style={modal.input}
                value={form.serial_number}
                onChangeText={(v) => update("serial_number", v)}
                placeholder="SN123456789"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
              />
            </View>

            {/* Category */}
            {categories.length > 0 && (
              <View>
                <Text style={modal.label}>Categoría</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  <TouchableOpacity
                    style={[modal.chip, form.category_id === "" && modal.chipActive]}
                    onPress={() => update("category_id", "")}
                  >
                    <Text style={[modal.chipText, form.category_id === "" && { color: Colors.white }]}>Sin categoría</Text>
                  </TouchableOpacity>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[modal.chip, form.category_id === cat.id && modal.chipActive]}
                      onPress={() => update("category_id", cat.id)}
                    >
                      <Text style={[modal.chipText, form.category_id === cat.id && { color: Colors.white }]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Location */}
            {locations.length > 0 && (
              <View>
                <Text style={modal.label}>Ubicación</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  <TouchableOpacity
                    style={[modal.chip, form.location_id === "" && modal.chipActive]}
                    onPress={() => update("location_id", "")}
                  >
                    <Text style={[modal.chipText, form.location_id === "" && { color: Colors.white }]}>Sin ubicación</Text>
                  </TouchableOpacity>
                  {locations.map((loc) => (
                    <TouchableOpacity
                      key={loc.id}
                      style={[modal.chip, form.location_id === loc.id && modal.chipActive]}
                      onPress={() => update("location_id", loc.id)}
                    >
                      <Text style={[modal.chipText, form.location_id === loc.id && { color: Colors.white }]}>
                        {loc.name}{loc.floor ? ` P${loc.floor}` : ""}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Acquisition value */}
            <View>
              <Text style={modal.label}>Valor de adquisición (MXN)</Text>
              <TextInput
                style={modal.input}
                value={form.acquisition_value}
                onChangeText={(v) => update("acquisition_value", v.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Description */}
            <View>
              <Text style={modal.label}>Descripción</Text>
              <TextInput
                style={[modal.input, { minHeight: 80, textAlignVertical: "top", paddingTop: 10 }]}
                value={form.description}
                onChangeText={(v) => update("description", v)}
                placeholder="Descripción opcional del activo..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[modal.submitBtn, mutation.isPending && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
                  <Text style={modal.submitText}>Registrar activo</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={{ height: 20 }} />
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const modal = StyleSheet.create({
  header:      { backgroundColor: Colors.brand, padding: Spacing.xl, paddingBottom: Spacing.lg, flexDirection: "row", alignItems: "flex-start" },
  headerTitle: { fontSize: FontSize.lg, fontWeight: "700", color: Colors.white },
  headerSub:   { fontSize: FontSize.sm, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  closeBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  label:       { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary, marginBottom: 8 },
  input:       {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: FontSize.base,
    color: Colors.textPrimary, backgroundColor: Colors.white,
  },
  inputError:  { borderColor: Colors.danger },
  errorText:   { fontSize: FontSize.xs, color: Colors.danger, marginTop: 4 },
  chip:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.white },
  chipActive:  { backgroundColor: Colors.brand, borderColor: Colors.brand },
  chipText:    { fontSize: FontSize.xs, fontWeight: "600", color: Colors.textSecondary },
  submitBtn:   { backgroundColor: Colors.brand, borderRadius: Radius.lg, padding: 15, alignItems: "center" },
  submitText:  { color: Colors.white, fontWeight: "700", fontSize: FontSize.base },
})

// ─── Asset Detail Modal ───────────────────────────────────────────────────────

function AssetDetailModal({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const icon = getCategoryIcon(asset.category?.name)

  const Field = ({ label, value }: { label: string; value?: string | number | null }) =>
    value != null && value !== "" ? (
      <View style={detail.row}>
        <Text style={detail.fieldLabel}>{label}</Text>
        <Text style={detail.fieldValue}>{String(value)}</Text>
      </View>
    ) : null

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
        <View style={detail.header}>
          <View style={detail.iconBox}>
            <Ionicons name={icon} size={28} color={Colors.white} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={detail.title} numberOfLines={2}>{asset.name}</Text>
            <Text style={detail.code}>{asset.code}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={modal.closeBtn}>
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: 12 }}>
          <View style={detail.statusRow}>
            <AssetStatusBadge status={asset.status} />
            {asset.category && (
              <View style={detail.catBadge}>
                <Text style={detail.catText}>{asset.category.name}</Text>
              </View>
            )}
          </View>

          <View style={detail.card}>
            <Field label="Marca" value={asset.brand} />
            <Field label="Modelo" value={asset.model} />
            <Field label="Serie" value={asset.serial_number} />
            <Field label="Ubicación" value={asset.location?.name} />
            <Field label="Responsable" value={asset.responsible_user?.name} />
            {asset.acquisition_value != null && (
              <Field label="Valor" value={`$${asset.acquisition_value.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN`} />
            )}
          </View>

          {asset.description ? (
            <View style={detail.card}>
              <Text style={detail.fieldLabel}>Descripción</Text>
              <Text style={[detail.fieldValue, { marginTop: 4, lineHeight: 20 }]}>{asset.description}</Text>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

const detail = StyleSheet.create({
  header:     { backgroundColor: Colors.brand, flexDirection: "row", alignItems: "center", padding: Spacing.xl, paddingBottom: Spacing.lg },
  iconBox:    { width: 52, height: 52, borderRadius: Radius.lg, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  title:      { fontSize: FontSize.lg, fontWeight: "700", color: Colors.white },
  code:       { fontSize: FontSize.sm, color: "rgba(255,255,255,0.65)", fontFamily: "monospace", marginTop: 2 },
  statusRow:  { flexDirection: "row", gap: 8, alignItems: "center" },
  catBadge:   { backgroundColor: Colors.infoBg, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  catText:    { fontSize: FontSize.xs, fontWeight: "600", color: Colors.info },
  card:       { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, gap: 10 },
  row:        { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  fieldLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4, flex: 1 },
  fieldValue: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: "500", flex: 2, textAlign: "right" },
})

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function InventoryScreen() {
  const { width } = useWindowDimensions()
  const [search, setSearch]           = useState("")
  const [status, setStatus]           = useState("")
  const [showAdd, setShowAdd]         = useState(false)
  const [selected, setSelected]       = useState<Asset | null>(null)

  const { data: assets, isLoading, refetch, isRefetching } = useQuery<Asset[]>({
    queryKey: ["assets", search, status],
    queryFn: () =>
      api.get("/api/assets", { params: { search: search || undefined, status: status || undefined } })
        .then((r) => r.data),
  })

  const numColumns = width >= 600 ? 2 : 1

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Inventario</Text>
          <Text style={styles.sub}>{assets?.length ?? 0} activos registrados</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
          <Ionicons name="add" size={26} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre, código, marca..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={Colors.textMuted}
            clearButtonMode="while-editing"
          />
          {search.length > 0 && Platform.OS === "android" && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Status filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={{ gap: 8, paddingHorizontal: Spacing.lg }}
      >
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterPill, status === f.value && styles.filterPillActive]}
            onPress={() => setStatus(f.value)}
          >
            <Ionicons
              name={f.icon}
              size={13}
              color={status === f.value ? Colors.white : Colors.textSecondary}
            />
            <Text style={[styles.filterText, status === f.value && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Asset List */}
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Spinner />
        </View>
      ) : (
        <FlatList
          data={assets}
          keyExtractor={(item) => item.id}
          key={numColumns}
          numColumns={numColumns}
          contentContainerStyle={{ padding: Spacing.lg, gap: 10 }}
          columnWrapperStyle={numColumns > 1 ? { gap: 10 } : undefined}
          onRefresh={refetch}
          refreshing={isRefetching}
          renderItem={({ item }) => {
            const icon = getCategoryIcon(item.category?.name)
            return (
              <TouchableOpacity
                style={[styles.assetCard, numColumns > 1 && { flex: 1 }]}
                onPress={() => setSelected(item)}
                activeOpacity={0.85}
              >
                <View style={styles.assetIconBox}>
                  <Ionicons name={icon} size={22} color={Colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.assetName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.assetCode}>{item.code}</Text>
                  {item.location && (
                    <View style={styles.assetLocation}>
                      <Ionicons name="location-outline" size={11} color={Colors.textMuted} />
                      <Text style={styles.assetLocationText} numberOfLines={1}>{item.location.name}</Text>
                    </View>
                  )}
                  {item.brand && (
                    <Text style={styles.assetBrand} numberOfLines={1}>{item.brand}{item.model ? ` · ${item.model}` : ""}</Text>
                  )}
                </View>
                <View style={{ alignItems: "flex-end", justifyContent: "space-between", paddingLeft: 8 }}>
                  <AssetStatusBadge status={item.status} />
                  <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} style={{ marginTop: 8 }} />
                </View>
              </TouchableOpacity>
            )
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="cube-outline" size={40} color={Colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>
                {search || status ? "Sin resultados" : "Sin activos"}
              </Text>
              <Text style={styles.emptySub}>
                {search
                  ? `No hay activos que coincidan con "${search}"`
                  : status
                  ? "No hay activos con ese estado"
                  : "Toca + para registrar el primer activo"}
              </Text>
              {!search && !status && (
                <TouchableOpacity style={styles.emptyAddBtn} onPress={() => setShowAdd(true)}>
                  <Ionicons name="add" size={16} color={Colors.white} />
                  <Text style={styles.emptyAddText}>Agregar activo</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      <AddAssetModal visible={showAdd} onClose={() => setShowAdd(false)} />

      {selected && (
        <AssetDetailModal asset={selected} onClose={() => setSelected(null)} />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  header:         { backgroundColor: Colors.brand, flexDirection: "row", alignItems: "center", padding: Spacing.xl, paddingBottom: Spacing.lg },
  title:          { fontSize: FontSize.xl, fontWeight: "700", color: Colors.white },
  sub:            { fontSize: FontSize.sm, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  addBtn:         { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  searchContainer:{ padding: Spacing.lg, paddingBottom: Spacing.sm },
  searchBox:      { flexDirection: "row", alignItems: "center", backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: 10 },
  searchInput:    { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary },
  filterScroll:   { paddingVertical: Spacing.sm },
  filterPill:     { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border },
  filterPillActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  filterText:     { fontSize: FontSize.xs, fontWeight: "600", color: Colors.textSecondary },
  filterTextActive: { color: Colors.white },
  assetCard:      { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  assetIconBox:   { width: 46, height: 46, backgroundColor: Colors.infoBg, borderRadius: Radius.md, alignItems: "center", justifyContent: "center" },
  assetName:      { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary },
  assetCode:      { fontSize: FontSize.xs, color: Colors.brand, fontFamily: "monospace", marginTop: 2, fontWeight: "600" },
  assetLocation:  { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  assetLocationText: { fontSize: 11, color: Colors.textMuted },
  assetBrand:     { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  empty:          { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyIconBox:   { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.white, alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  emptyTitle:     { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary, marginBottom: 6 },
  emptySub:       { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: "center", lineHeight: 20 },
  emptyAddBtn:    { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 20, backgroundColor: Colors.brand, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg, paddingVertical: 12 },
  emptyAddText:   { fontSize: FontSize.sm, fontWeight: "700", color: Colors.white },
})
