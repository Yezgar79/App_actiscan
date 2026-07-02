import { useState } from "react"
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { Asset } from "@/types"
import { AssetStatusBadge, Spinner } from "@/components/ui"
import { Colors, Spacing, Radius, FontSize } from "@/theme"

const STATUS_FILTERS = [
  { value: "", label: "Todos" },
  { value: "operativo", label: "Operativo" },
  { value: "mantenimiento", label: "Mant." },
  { value: "no_localizado", label: "No hallado" },
]

export default function InventoryScreen() {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")

  const { data: assets, isLoading } = useQuery<Asset[]>({
    queryKey: ["assets", search, status],
    queryFn: () =>
      api.get("/api/assets", { params: { search: search || undefined, status: status || undefined } })
        .then((r) => r.data),
  })

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Inventario</Text>
        <Text style={styles.sub}>{assets?.length ?? 0} activos</Text>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre o código..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      {/* Status filter pills */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterPill, status === f.value && styles.filterPillActive]}
            onPress={() => setStatus(f.value)}
          >
            <Text style={[styles.filterText, status === f.value && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Spinner />
        </View>
      ) : (
        <FlatList
          data={assets}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: Spacing.lg, gap: 8 }}
          renderItem={({ item }) => (
            <View style={styles.assetRow}>
              <View style={styles.assetIcon}>
                <Text style={{ fontSize: 20 }}>
                  {item.category?.name?.toLowerCase().includes("comp") ? "💻"
                    : item.category?.name?.toLowerCase().includes("mobi") ? "🪑"
                    : item.category?.name?.toLowerCase().includes("red") ? "🔌"
                    : "📦"}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.assetName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.assetCode}>{item.code}</Text>
                {item.location && (
                  <Text style={styles.assetLocation} numberOfLines={1}>📍 {item.location.name}</Text>
                )}
              </View>
              <AssetStatusBadge status={item.status} />
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyTitle}>Sin activos</Text>
              <Text style={styles.emptySub}>Registra activos desde la plataforma web</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  header:  { backgroundColor: Colors.brand, padding: Spacing.xl, paddingBottom: Spacing.lg },
  title:   { fontSize: FontSize.xl, fontWeight: "600", color: Colors.white },
  sub:     { fontSize: FontSize.sm, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  searchBox: { margin: Spacing.lg, marginBottom: Spacing.sm },
  searchInput: {
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: FontSize.base, color: Colors.textPrimary,
  },
  filterRow:   { flexDirection: "row", gap: 8, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  filterPill:  {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  filterPillActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  filterText:       { fontSize: FontSize.xs, fontWeight: "600", color: Colors.textSecondary },
  filterTextActive: { color: Colors.white },
  assetRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  assetIcon:     { width: 42, height: 42, backgroundColor: Colors.bg, borderRadius: Radius.md, alignItems: "center", justifyContent: "center" },
  assetName:     { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary },
  assetCode:     { fontSize: FontSize.xs, color: Colors.brand, fontFamily: "monospace", marginTop: 2 },
  assetLocation: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  empty:         { alignItems: "center", paddingTop: 60 },
  emptyIcon:     { fontSize: 40, marginBottom: 12 },
  emptyTitle:    { fontSize: FontSize.md, fontWeight: "600", color: Colors.textPrimary },
  emptySub:      { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 4, textAlign: "center" },
})
