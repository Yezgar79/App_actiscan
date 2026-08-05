import { useState } from "react"
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert,
  TextInput, Modal, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import api from "@/lib/api"
import {
  AuditSession, AuditItem, AuditItemResult, ObservationSeverity,
  RESULT_LABELS, RESULTS_REQUIRING_NOTES,
} from "@/types"
import { Card, Button, Spinner } from "@/components/ui"
import { Colors, Spacing, Radius, FontSize } from "@/theme"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useNetworkStatus } from "@/lib/network"

type FilterStatus = "all" | "en_curso" | "completada" | "cancelada"

const RESULT_COLORS: Record<AuditItemResult, string> = {
  presente:    Colors.success,
  faltante:    Colors.danger,
  danado:      Colors.warning,
  reubicado:   Colors.info,
  no_accesible:"#9333ea",
  no_aplica:   Colors.textMuted,
  alerta:      Colors.warning,
}

const SEVERITY_OPTIONS: ObservationSeverity[] = ["baja", "media", "alta", "critica"]
const SEVERITY_COLORS: Record<ObservationSeverity, string> = {
  baja:   Colors.success,
  media:  Colors.info,
  alta:   Colors.warning,
  critica:Colors.danger,
}

// ─── Correction Modal ─────────────────────────────────────────────────────────
function CorrectionModal({
  item,
  sessionId,
  visible,
  onClose,
}: {
  item: AuditItem
  sessionId: string
  visible: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [result, setResult]     = useState<AuditItemResult>(item.result)
  const [notes, setNotes]       = useState(item.notes ?? "")
  const [severity, setSeverity] = useState<ObservationSeverity | undefined>(item.severity)

  const mutation = useMutation({
    mutationFn: () =>
      api.put(`/api/audits/${sessionId}/items/${item.id}`, {
        result,
        notes: notes || undefined,
        severity: severity || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["audits"] })
      qc.invalidateQueries({ queryKey: ["capturista-stats"] })
      Alert.alert("Enviado", "La corrección fue enviada al administrador para revisión.")
      onClose()
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      Alert.alert("Error", detail ?? "No se pudo enviar la corrección")
    },
  })

  const handleSubmit = () => {
    if (RESULTS_REQUIRING_NOTES.includes(result) && !notes.trim()) {
      Alert.alert("Observación requerida", `Agrega una observación para el resultado "${RESULT_LABELS[result]}"`)
      return
    }
    Alert.alert(
      "Enviar corrección",
      "¿Confirmas que la información es correcta? El administrador la revisará.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Enviar", onPress: () => mutation.mutate() },
      ]
    )
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
          {/* Header */}
          <View style={{ backgroundColor: Colors.brand, padding: Spacing.xl, paddingBottom: Spacing.lg }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FontSize.lg, fontWeight: "600", color: Colors.white }}>Corregir activo</Text>
                <Text style={{ fontSize: FontSize.sm, color: "rgba(255,255,255,0.65)", marginTop: 2 }} numberOfLines={1}>
                  {item.asset?.name ?? item.asset_id}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.lg, gap: 16 }}>
            {/* Admin comment */}
            <View style={corrStyles.adminComment}>
              <Text style={corrStyles.adminLabel}>Comentario del administrador</Text>
              <Text style={corrStyles.adminText}>{item.returned_comment}</Text>
              {item.returned_at && (
                <Text style={corrStyles.adminDate}>
                  {format(new Date(item.returned_at), "dd MMM yyyy · HH:mm", { locale: es })}
                </Text>
              )}
            </View>

            {/* Result selector */}
            <View>
              <Text style={corrStyles.label}>Nuevo resultado *</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(Object.entries(RESULT_LABELS) as [AuditItemResult, string][])
                  .filter(([k]) => k !== "alerta")
                  .map(([key, label]) => (
                    <TouchableOpacity
                      key={key}
                      style={[
                        corrStyles.resultChip,
                        result === key && { backgroundColor: RESULT_COLORS[key], borderColor: RESULT_COLORS[key] },
                      ]}
                      onPress={() => setResult(key)}
                    >
                      <Text style={[corrStyles.resultChipText, result === key && { color: Colors.white }]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </View>

            {/* Severity */}
            <View>
              <Text style={corrStyles.label}>Severidad</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {SEVERITY_OPTIONS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      corrStyles.severityChip,
                      severity === s && { backgroundColor: SEVERITY_COLORS[s], borderColor: SEVERITY_COLORS[s] },
                    ]}
                    onPress={() => setSeverity(severity === s ? undefined : s)}
                  >
                    <Text style={[corrStyles.severityText, severity === s && { color: Colors.white }]}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Notes */}
            <View>
              <Text style={corrStyles.label}>
                Observación{RESULTS_REQUIRING_NOTES.includes(result) ? " *" : ""}
              </Text>
              <TextInput
                style={corrStyles.notesInput}
                value={notes}
                onChangeText={(t) => setNotes(t.slice(0, 500))}
                multiline
                numberOfLines={4}
                placeholder={
                  RESULTS_REQUIRING_NOTES.includes(result)
                    ? "Requerido: describe el hallazgo..."
                    : "Observación adicional (opcional)..."
                }
                placeholderTextColor={Colors.textMuted}
              />
              <Text style={corrStyles.charCount}>{notes.length}/500</Text>
            </View>

            <Button
              title="Enviar corrección"
              onPress={handleSubmit}
              loading={mutation.isPending}
            />

            <Text style={corrStyles.hint}>
              Una vez enviada, el administrador revisará tu corrección y la aprobará o devolverá nuevamente.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const corrStyles = StyleSheet.create({
  adminComment:   { backgroundColor: "#fff7ed", borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: "#fed7aa" },
  adminLabel:     { fontSize: FontSize.xs, fontWeight: "700", color: Colors.warning, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  adminText:      { fontSize: FontSize.sm, color: "#9a3412", lineHeight: 20 },
  adminDate:      { fontSize: 11, color: Colors.textMuted, marginTop: 6 },
  label:          { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary, marginBottom: 8 },
  resultChip:     { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border },
  resultChipText: { fontSize: FontSize.xs, fontWeight: "600", color: Colors.textSecondary },
  severityChip:   { flex: 1, paddingVertical: 8, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center" },
  severityText:   { fontSize: FontSize.xs, fontWeight: "600", color: Colors.textSecondary },
  notesInput:     {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: 12, fontSize: FontSize.base, color: Colors.textPrimary,
    backgroundColor: Colors.white, minHeight: 100, textAlignVertical: "top",
  },
  charCount:      { fontSize: 11, color: Colors.textMuted, textAlign: "right", marginTop: 4 },
  hint:           { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: "center", lineHeight: 18 },
})

// ─── Audit item row (inside detail modal) ─────────────────────────────────────
function AuditItemRow({ item, sessionId }: { item: AuditItem; sessionId: string }) {
  const color = RESULT_COLORS[item.result] ?? Colors.textMuted
  const isReturned = !!item.returned_at && !item.approved_at
  const isApproved = !!item.approved_at
  const [showCorrection, setShowCorrection] = useState(false)

  return (
    <>
      <View style={[styles.itemRow, isReturned && { borderColor: Colors.danger, borderWidth: 1.5 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.asset?.name ?? item.asset_id}
          </Text>
          <Text style={styles.itemCode}>{item.asset?.code}</Text>
          {item.notes && <Text style={styles.itemNotes} numberOfLines={2}>{item.notes}</Text>}

          {/* Admin return comment */}
          {item.returned_comment && (
            <View style={styles.returnedCommentBox}>
              <Text style={styles.returnedCommentLabel}>↩ Admin: </Text>
              <Text style={styles.returnedCommentText} numberOfLines={2}>{item.returned_comment}</Text>
            </View>
          )}

          <Text style={styles.itemTime}>
            {format(new Date(item.scanned_at), "HH:mm dd/MM/yy", { locale: es })}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <View style={[styles.resultBadge, { backgroundColor: color + "20", borderColor: color }]}>
            <Text style={[styles.resultBadgeText, { color }]}>{RESULT_LABELS[item.result]}</Text>
          </View>
          {isReturned && (
            <TouchableOpacity
              style={styles.correctBtn}
              onPress={() => setShowCorrection(true)}
            >
              <Ionicons name="pencil-outline" size={11} color={Colors.danger} />
              <Text style={styles.correctBtnText}>Corregir</Text>
            </TouchableOpacity>
          )}
          {isApproved && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
              <Text style={{ fontSize: 10, color: Colors.success, fontWeight: "600" }}>Aprobado</Text>
            </View>
          )}
          {item.severity && (
            <View style={styles.severityBadge}>
              <Text style={styles.severityBadgeText}>{item.severity}</Text>
            </View>
          )}
          {item.evidence_urls && item.evidence_urls.length > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Ionicons name="camera-outline" size={11} color={Colors.info} />
              <Text style={{ fontSize: 10, color: Colors.info, fontWeight: "600" }}>{item.evidence_urls.length}</Text>
            </View>
          )}
        </View>
      </View>

      {showCorrection && (
        <CorrectionModal
          item={item}
          sessionId={sessionId}
          visible={showCorrection}
          onClose={() => setShowCorrection(false)}
        />
      )}
    </>
  )
}

// ─── Audit detail modal ───────────────────────────────────────────────────────
function AuditDetailModal({ audit: initialAudit, onClose }: { audit: AuditSession; onClose: () => void }) {
  const [filterResult, setFilterResult] = useState<AuditItemResult | "all" | "devueltos">("all")

  // Fetch fresh data; initialData muestra el snapshot inmediatamente mientras recarga
  const { data: audit = initialAudit } = useQuery<AuditSession>({
    queryKey: ["audits", initialAudit.id],
    queryFn: () => api.get(`/api/audits/${initialAudit.id}`).then((r) => r.data),
    refetchInterval: 10_000,   // sincroniza con web cada 10 s
    initialData: initialAudit,
    initialDataUpdatedAt: 0,   // marca como stale inmediatamente para re-fetch
  })

  const displayed = audit.items.filter((i) => {
    if (filterResult === "all")      return true
    if (filterResult === "devueltos") return !!i.returned_at && !i.approved_at
    return i.result === filterResult
  })

  const counts: Record<string, number> = {
    all:        audit.items.length,
    presente:   audit.items.filter(i => i.result === "presente").length,
    faltante:   audit.items.filter(i => i.result === "faltante").length,
    danado:     audit.items.filter(i => i.result === "danado" || i.result === "alerta").length,
    reubicado:  audit.items.filter(i => i.result === "reubicado").length,
    devueltos:  audit.items.filter(i => i.returned_at && !i.approved_at).length,
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bg }}>
      {/* Header */}
      <View style={{ backgroundColor: Colors.brand, padding: Spacing.xl, paddingBottom: Spacing.lg }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Text style={{ fontSize: FontSize.lg, fontWeight: "600", color: Colors.white, flex: 1, marginRight: 12 }} numberOfLines={2}>
            {audit.title}
          </Text>
          <TouchableOpacity onPress={onClose} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: FontSize.sm, marginTop: 4 }}>
          {audit.items.length} activos · {format(new Date(audit.started_at), "dd MMM yyyy", { locale: es })}
        </Text>
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 10 }} contentContainerStyle={{ gap: 8, paddingHorizontal: Spacing.lg }}>
        {([
          { key: "all",       label: `Todos (${counts.all})`,              color: Colors.textPrimary },
          { key: "presente",  label: `Encontrados (${counts.presente})`,   color: Colors.success     },
          { key: "faltante",  label: `Faltantes (${counts.faltante})`,     color: Colors.danger      },
          { key: "danado",    label: `Dañados (${counts.danado})`,         color: Colors.warning     },
          { key: "reubicado", label: `Reubicados (${counts.reubicado})`,   color: Colors.info        },
          { key: "devueltos", label: `Devueltos (${counts.devueltos})`,    color: Colors.danger      },
        ] as const).map(({ key, label, color }) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.filterPill,
              { borderColor: color },
              filterResult === key && { backgroundColor: color },
            ]}
            onPress={() => setFilterResult(key as typeof filterResult)}
          >
            <Text style={[styles.filterPillText, { color: filterResult === key ? Colors.white : color }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Items list */}
      <FlatList
        data={displayed}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: Spacing.lg, gap: 8 }}
        renderItem={({ item }) => <AuditItemRow item={item} sessionId={audit.id} />}
        ListEmptyComponent={
          <Text style={{ textAlign: "center", color: Colors.textMuted, paddingTop: 32, fontSize: FontSize.base }}>
            Sin activos en esta categoría
          </Text>
        }
      />
    </SafeAreaView>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function AuditsScreen() {
  const qc = useQueryClient()
  const isOnline = useNetworkStatus()
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [titleError, setTitleError] = useState("")
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all")
  const [search, setSearch] = useState("")
  const [detailAudit, setDetailAudit] = useState<AuditSession | null>(null)

  const { data: audits, isLoading } = useQuery<AuditSession[]>({
    queryKey: ["audits"],
    queryFn: () => api.get("/api/audits").then((r) => r.data),
    enabled: isOnline,
    refetchInterval: isOnline ? 15_000 : false,
  })

  const createMutation = useMutation({
    mutationFn: () => api.post("/api/audits", { title: newTitle.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["audits"] })
      qc.invalidateQueries({ queryKey: ["capturista-stats"] })
      setShowNew(false)
      setNewTitle("")
      setTitleError("")
    },
    onError: () => Alert.alert("Error", "No se pudo crear la auditoría"),
  })

  const finishMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/audits/${id}/finish`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["audits"] })
      qc.invalidateQueries({ queryKey: ["capturista-stats"] })
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      Alert.alert("No se puede finalizar", detail ?? "Error al cerrar la auditoría")
    },
  })

  const statusColor = (s: AuditSession["status"]) =>
    s === "en_curso" ? Colors.info : s === "completada" ? Colors.success : Colors.textMuted
  const statusBg = (s: AuditSession["status"]) =>
    s === "en_curso" ? Colors.infoBg : s === "completada" ? Colors.successBg : "#F3F4F6"
  const statusLabel = (s: AuditSession["status"]) =>
    s === "en_curso" ? "En curso" : s === "completada" ? "Completada" : "Cancelada"

  const displayed = (audits ?? []).filter((a) => {
    if (filterStatus !== "all" && a.status !== filterStatus) return false
    if (search.trim() && !a.title.toLowerCase().includes(search.trim().toLowerCase())) return false
    return true
  })

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Auditorías</Text>
          <Text style={styles.sub}>{audits?.length ?? 0} registradas</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setShowNew(!showNew); setNewTitle(""); setTitleError("") }}>
          <Ionicons name={showNew ? "close" : "add"} size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={Colors.textMuted}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Status filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ gap: 8, paddingHorizontal: Spacing.lg }}>
        {([
          { key: "all",        label: "Todas"       },
          { key: "en_curso",   label: "En curso"    },
          { key: "completada", label: "Completadas" },
          { key: "cancelada",  label: "Canceladas"  },
        ] as const).map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterPill, filterStatus === f.key && styles.filterPillActive]}
            onPress={() => setFilterStatus(f.key)}
          >
            <Text style={[styles.filterPillText, filterStatus === f.key && { color: Colors.white }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* New audit form */}
      {showNew && (
        <View style={styles.newForm}>
          <Text style={styles.newFormTitle}>Nueva auditoría</Text>
          <TextInput
            style={[styles.newInput, !!titleError && { borderColor: Colors.danger }]}
            placeholder="Ej. Almacén Norte — Turno Mañana"
            value={newTitle}
            onChangeText={(t) => { setNewTitle(t); if (titleError) setTitleError("") }}
            placeholderTextColor={Colors.textMuted}
            autoFocus
          />
          {!!titleError && (
            <Text style={{ fontSize: FontSize.xs, color: Colors.danger, marginTop: 4 }}>{titleError}</Text>
          )}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <Button title="Cancelar" variant="secondary" onPress={() => { setShowNew(false); setNewTitle(""); setTitleError("") }} style={{ flex: 1 }} />
            <Button
              title="Crear"
              onPress={() => {
                const trimmed = newTitle.trim()
                if (!trimmed) { setTitleError("El título es requerido"); return }
                if (trimmed.length < 3) { setTitleError("Mínimo 3 caracteres"); return }
                if (!isOnline) { Alert.alert("Sin conexión", "Se requiere conexión para crear auditorías"); return }
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
          data={displayed}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: Spacing.lg, gap: 10 }}
          renderItem={({ item }) => {
            const present   = item.items.filter((i) => i.result === "presente").length
            const missing   = item.items.filter((i) => i.result === "faltante").length
            const damaged   = item.items.filter((i) => i.result === "danado" || i.result === "alerta").length
            const returned  = item.items.filter((i) => i.returned_at && !i.approved_at).length
            const total     = item.items.length

            return (
              <TouchableOpacity onPress={() => setDetailAudit(item)} activeOpacity={0.9}>
                <Card>
                  {/* Header */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <Text style={styles.auditTitle} numberOfLines={2}>{item.title}</Text>
                    <View style={{ backgroundColor: statusBg(item.status), borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 }}>
                      <Text style={{ color: statusColor(item.status), fontSize: FontSize.xs, fontWeight: "600" }}>
                        {statusLabel(item.status)}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <Ionicons name="person-outline" size={11} color={Colors.textMuted} />
                    <Text style={styles.auditMeta}>{item.auditor.name}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <Ionicons name="calendar-outline" size={11} color={Colors.textMuted} />
                    <Text style={styles.auditMeta}>{format(new Date(item.started_at), "dd MMM yyyy · HH:mm", { locale: es })}</Text>
                  </View>
                  {item.finished_at && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <Ionicons name="checkmark-circle-outline" size={11} color={Colors.success} />
                      <Text style={[styles.auditMeta, { color: Colors.success }]}>{format(new Date(item.finished_at), "dd MMM yyyy · HH:mm", { locale: es })}</Text>
                    </View>
                  )}

                  {/* Result chips */}
                  {total > 0 && (
                    <View style={styles.resultsRow}>
                      {[
                        { v: present,  label: "Encontrados", c: Colors.success },
                        { v: missing,  label: "Faltantes",   c: Colors.danger },
                        { v: damaged,  label: "Dañados",     c: Colors.warning },
                        { v: returned, label: "Devueltos",   c: "#9333ea" },
                        { v: total,    label: "Total",       c: Colors.textMuted },
                      ].map((s) => (
                        <View key={s.label} style={styles.resultChip}>
                          <Text style={[styles.resultNum, { color: s.c }]}>{s.v}</Text>
                          <Text style={[styles.resultLbl, { color: s.c }]}>{s.label}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Progress bar */}
                  {item.status === "en_curso" && total > 0 && (
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBg}>
                        <View style={[styles.progressFill, { width: `${Math.min((present / total) * 100, 100)}%` as any }]} />
                      </View>
                      <Text style={styles.progressLabel}>{present}/{total} verificados ({Math.round((present / total) * 100)}%)</Text>
                    </View>
                  )}

                  {/* Returned warning */}
                  {returned > 0 && (
                    <View style={styles.returnedWarning}>
                      <Ionicons name="return-down-back-outline" size={13} color={Colors.danger} />
                      <Text style={styles.returnedWarningText}>
                        {returned} activo{returned !== 1 ? "s" : ""} devuelto{returned !== 1 ? "s" : ""} — requiere corrección
                      </Text>
                    </View>
                  )}

                  {/* Finish button */}
                  {item.status === "en_curso" && (
                    <TouchableOpacity
                      style={[styles.finishBtn, returned > 0 && { opacity: 0.5 }]}
                      onPress={() => Alert.alert(
                        "Finalizar auditoría",
                        returned > 0
                          ? `Tienes ${returned} activo(s) devueltos pendientes. Corrígelos antes de finalizar.`
                          : "¿Estás seguro de cerrar esta auditoría? No podrás agregar más resultados.",
                        returned > 0
                          ? [{ text: "Entendido" }]
                          : [
                              { text: "Cancelar", style: "cancel" },
                              { text: "Finalizar", style: "destructive", onPress: () => finishMutation.mutate(item.id) },
                            ]
                      )}
                    >
                      <Ionicons name="checkmark-circle-outline" size={15} color={Colors.white} />
                      <Text style={styles.finishBtnText}>Finalizar asignación</Text>
                    </TouchableOpacity>
                  )}
                </Card>
              </TouchableOpacity>
            )
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="clipboard-outline" size={36} color={Colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>{search ? "Sin resultados" : "Sin auditorías"}</Text>
              <Text style={styles.emptySub}>
                {search ? `No hay auditorías que coincidan con "${search}"` : "Toca + para iniciar una nueva auditoría"}
              </Text>
            </View>
          }
        />
      )}

      {/* Detail modal */}
      <Modal
        visible={!!detailAudit}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailAudit(null)}
      >
        {detailAudit && <AuditDetailModal audit={detailAudit} onClose={() => setDetailAudit(null)} />}
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: Colors.bg },
  header:       { backgroundColor: Colors.brand, flexDirection: "row", alignItems: "center", padding: Spacing.xl, paddingBottom: Spacing.lg },
  title:        { fontSize: FontSize.xl, fontWeight: "600", color: Colors.white },
  sub:          { fontSize: FontSize.sm, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  addBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  searchBox:    { padding: Spacing.md, paddingBottom: 0 },
  searchInput:  { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: FontSize.base, backgroundColor: Colors.white, color: Colors.textPrimary },
  filterRow:    { paddingVertical: 10 },
  filterPill:   { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border },
  filterPillActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  filterPillText:   { fontSize: FontSize.xs, fontWeight: "600", color: Colors.textSecondary },
  newForm:      { margin: Spacing.lg, marginBottom: 0, backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  newFormTitle: { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary, marginBottom: 10 },
  newInput:     { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: FontSize.base, color: Colors.textPrimary },
  auditTitle:   { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary, flex: 1 },
  auditMeta:    { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 3 },
  resultsRow:   { flexDirection: "row", gap: 4, marginTop: 12, flexWrap: "wrap" },
  resultChip:   { flex: 1, minWidth: "18%", backgroundColor: Colors.bg, borderRadius: Radius.md, padding: 6, alignItems: "center" },
  resultNum:    { fontSize: FontSize.md, fontWeight: "700" },
  resultLbl:    { fontSize: 9, fontWeight: "600", marginTop: 1 },
  progressContainer: { marginTop: 10 },
  progressBg:   { height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: Colors.brand, borderRadius: 3 },
  progressLabel:{ fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
  returnedWarning:   { marginTop: 8, backgroundColor: Colors.dangerBg, borderRadius: Radius.md, padding: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  returnedWarningText: { fontSize: FontSize.xs, color: Colors.danger, fontWeight: "600", flex: 1 },
  finishBtn:    { marginTop: 12, backgroundColor: Colors.brand, borderRadius: Radius.md, padding: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 },
  finishBtnText:{ color: Colors.white, fontWeight: "600", fontSize: FontSize.sm },
  empty:        { alignItems: "center", paddingTop: 60 },
  emptyIconBox: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.white, alignItems: "center", justifyContent: "center", marginBottom: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  emptyTitle:   { fontSize: FontSize.md, fontWeight: "700", color: Colors.textPrimary },
  emptySub:     { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 4, textAlign: "center", paddingHorizontal: 32 },
  // Item row (detail modal)
  itemRow:      { flexDirection: "row", backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, gap: 10 },
  itemName:     { fontSize: FontSize.sm, fontWeight: "600", color: Colors.textPrimary },
  itemCode:     { fontSize: FontSize.xs, color: Colors.brand, fontFamily: "monospace", marginTop: 1 },
  itemNotes:    { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4, lineHeight: 16 },
  itemTime:     { fontSize: 10, color: Colors.textMuted, marginTop: 4 },
  returnedCommentBox:  { flexDirection: "row", marginTop: 4, flexWrap: "wrap" },
  returnedCommentLabel:{ fontSize: FontSize.xs, fontWeight: "700", color: Colors.danger },
  returnedCommentText: { fontSize: FontSize.xs, color: Colors.danger, flex: 1 },
  resultBadge:  { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1 },
  resultBadgeText: { fontSize: 10, fontWeight: "700" },
  correctBtn:   { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.dangerBg, borderRadius: Radius.md, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: Colors.danger },
  correctBtnText:{ fontSize: 10, color: Colors.danger, fontWeight: "700" },
  severityBadge:{ backgroundColor: "#fef3c7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full },
  severityBadgeText: { fontSize: 10, color: "#92400e", fontWeight: "600", textTransform: "capitalize" },
})
