import { useState } from "react"
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import { AuditSession } from "@/types"
import { Card, AuditResultBadge, Button, Spinner } from "@/components/ui"
import { Colors, Spacing, Radius, FontSize } from "@/theme"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export default function AuditsScreen() {
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState("")

  const { data: audits, isLoading } = useQuery<AuditSession[]>({
    queryKey: ["audits"],
    queryFn: () => api.get("/api/audits").then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: () => api.post("/api/audits", { title: newTitle }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["audits"] })
      setShowNew(false)
      setNewTitle("")
    },
    onError: () => Alert.alert("Error", "No se pudo crear la auditoría"),
  })

  const finishMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/audits/${id}/finish`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["audits"] }),
    onError: () => Alert.alert("Error", "No se pudo cerrar la auditoría"),
  })

  const statusColor = (s: AuditSession["status"]) =>
    s === "en_curso" ? Colors.info : s === "completada" ? Colors.success : Colors.textMuted

  const statusBg = (s: AuditSession["status"]) =>
    s === "en_curso" ? Colors.infoBg : s === "completada" ? Colors.successBg : "#F3F4F6"

  const statusLabel = (s: AuditSession["status"]) =>
    s === "en_curso" ? "En curso" : s === "completada" ? "Completada" : "Cancelada"

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Auditorías</Text>
          <Text style={styles.sub}>{audits?.length ?? 0} registradas</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowNew(!showNew)}>
          <Text style={{ color: Colors.white, fontWeight: "700", fontSize: 22 }}>+</Text>
        </TouchableOpacity>
      </View>

      {/* New audit inline form */}
      {showNew && (
        <View style={styles.newForm}>
          <Text style={styles.newFormTitle}>Nueva auditoría</Text>
          <TextInput
            style={styles.newInput}
            placeholder="Ej. Almacén Norte — Turno Mañana"
            value={newTitle}
            onChangeText={setNewTitle}
            placeholderTextColor={Colors.textMuted}
            autoFocus
          />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <Button
              title="Cancelar"
              variant="secondary"
              onPress={() => { setShowNew(false); setNewTitle("") }}
              style={{ flex: 1 }}
            />
            <Button
              title="Crear"
              onPress={() => {
                if (!newTitle.trim()) { Alert.alert("", "Ingresa un título"); return }
                createMutation.mutate()
              }}
              loading={createMutation.isPending}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      )}

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Spinner />
        </View>
      ) : (
        <FlatList
          data={audits}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: Spacing.lg, gap: 10 }}
          renderItem={({ item }) => {
            const present = item.items.filter((i) => i.result === "presente").length
            const missing = item.items.filter((i) => i.result === "faltante").length
            const alert   = item.items.filter((i) => i.result === "alerta").length

            return (
              <Card>
                {/* Header row */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <Text style={styles.auditTitle} numberOfLines={2}>{item.title}</Text>
                  <View style={{ backgroundColor: statusBg(item.status), borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 }}>
                    <Text style={{ color: statusColor(item.status), fontSize: FontSize.xs, fontWeight: "600" }}>
                      {statusLabel(item.status)}
                    </Text>
                  </View>
                </View>

                {/* Meta */}
                <Text style={styles.auditMeta}>
                  👤 {item.auditor.name}
                </Text>
                <Text style={styles.auditMeta}>
                  📅 {format(new Date(item.started_at), "dd MMM yyyy · HH:mm", { locale: es })}
                </Text>

                {/* Results summary */}
                {item.items.length > 0 && (
                  <View style={styles.resultsRow}>
                    <View style={styles.resultChip}>
                      <Text style={styles.resultNum}>{present}</Text>
                      <Text style={[styles.resultLbl, { color: Colors.success }]}>Presentes</Text>
                    </View>
                    <View style={styles.resultChip}>
                      <Text style={styles.resultNum}>{missing}</Text>
                      <Text style={[styles.resultLbl, { color: Colors.danger }]}>Faltantes</Text>
                    </View>
                    <View style={styles.resultChip}>
                      <Text style={styles.resultNum}>{alert}</Text>
                      <Text style={[styles.resultLbl, { color: Colors.warning }]}>Alertas</Text>
                    </View>
                    <View style={styles.resultChip}>
                      <Text style={styles.resultNum}>{item.items.length}</Text>
                      <Text style={[styles.resultLbl, { color: Colors.textMuted }]}>Total</Text>
                    </View>
                  </View>
                )}

                {/* Progress bar */}
                {item.status === "en_curso" && item.items.length > 0 && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBg}>
                      <View style={[styles.progressFill, { width: `${Math.min((present / item.items.length) * 100, 100)}%` as any }]} />
                    </View>
                    <Text style={styles.progressLabel}>{present}/{item.items.length} verificados</Text>
                  </View>
                )}

                {/* Finish button */}
                {item.status === "en_curso" && (
                  <TouchableOpacity
                    style={styles.finishBtn}
                    onPress={() => Alert.alert(
                      "Finalizar auditoría",
                      "¿Estás seguro de cerrar esta auditoría?",
                      [
                        { text: "Cancelar", style: "cancel" },
                        { text: "Finalizar", style: "destructive", onPress: () => finishMutation.mutate(item.id) },
                      ]
                    )}
                  >
                    <Text style={styles.finishBtnText}>✓ Finalizar auditoría</Text>
                  </TouchableOpacity>
                )}
              </Card>
            )
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>✅</Text>
              <Text style={styles.emptyTitle}>Sin auditorías</Text>
              <Text style={styles.emptySub}>Toca + para iniciar una nueva auditoría</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: Colors.bg },
  header:     { backgroundColor: Colors.brand, flexDirection: "row", alignItems: "center", padding: Spacing.xl, paddingBottom: Spacing.lg },
  title:      { fontSize: FontSize.xl, fontWeight: "600", color: Colors.white },
  sub:        { fontSize: FontSize.sm, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  addBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  newForm:    { margin: Spacing.lg, marginBottom: 0, backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  newFormTitle: { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary, marginBottom: 10 },
  newInput:   { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: FontSize.base, color: Colors.textPrimary },
  auditTitle: { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary, flex: 1 },
  auditMeta:  { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 3 },
  resultsRow: { flexDirection: "row", gap: 6, marginTop: 12 },
  resultChip: { flex: 1, backgroundColor: Colors.bg, borderRadius: Radius.md, padding: 8, alignItems: "center" },
  resultNum:  { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  resultLbl:  { fontSize: 10, fontWeight: "600", marginTop: 2 },
  progressContainer: { marginTop: 10 },
  progressBg: { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: Colors.brand, borderRadius: 3 },
  progressLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  finishBtn:  { marginTop: 12, backgroundColor: Colors.brand, borderRadius: Radius.md, padding: 12, alignItems: "center" },
  finishBtnText: { color: Colors.white, fontWeight: "600", fontSize: FontSize.sm },
  empty:      { alignItems: "center", paddingTop: 60 },
  emptyTitle: { fontSize: FontSize.md, fontWeight: "600", color: Colors.textPrimary },
  emptySub:   { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 4 },
})
