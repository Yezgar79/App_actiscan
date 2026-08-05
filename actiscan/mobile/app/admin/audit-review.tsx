import { useState, useCallback } from "react"
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, ScrollView, TextInput, Alert, ActivityIndicator,
} from "react-native"
import { useFocusEffect, useNavigation } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import api from "@/lib/api"
import { Colors, Spacing, Radius, FontSize } from "@/theme"
import { AuditSession, AuditItem, AuditItemResult, RESULT_LABELS } from "@/types"

type AuditFilter = "" | "en_curso" | "completada" | "cancelada"

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador", assigned: "Asignada", en_curso: "En curso",
  completada: "Completada", cancelada: "Cancelada",
}
const STATUS_COLORS: Record<string, string> = {
  draft: Colors.textMuted, assigned: Colors.warning, en_curso: Colors.brand,
  completada: Colors.success, cancelada: Colors.danger,
}
const RESULT_COLORS: Record<AuditItemResult, string> = {
  presente: Colors.success, faltante: Colors.danger, danado: Colors.danger,
  reubicado: Colors.warning, no_accesible: Colors.warning, no_aplica: Colors.textMuted,
  alerta: "#D97706",
}
const SEV_COLORS: Record<string, string> = {
  baja: Colors.success, media: Colors.warning, alta: Colors.danger, critica: "#7C3AED",
}

export default function AuditReviewScreen() {
  const navigation = useNavigation()
  const [audits, setAudits]           = useState<AuditSession[]>([])
  const [loading, setLoading]         = useState(true)
  const [filter, setFilter]           = useState<AuditFilter>("")
  const [selected, setSelected]       = useState<AuditSession | null>(null)
  const [returnModal, setReturnModal] = useState<{ open: boolean; item: AuditItem | null }>({ open: false, item: null })
  const [cancelModal, setCancelModal] = useState<{ open: boolean; id: string }>({ open: false, id: "" })
  const [cancelReason, setCancelReason] = useState("")
  const [returnComment, setReturnComment] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  useFocusEffect(useCallback(() => {
    navigation.setOptions({ title: "Revisar auditorías" })
    fetchAudits()
  }, [filter]))

  async function fetchAudits() {
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: "30" }
      if (filter) params.status = filter
      const { data } = await api.get("/api/audits", { params })
      setAudits(Array.isArray(data) ? data : [])
    } catch {
      setAudits([])
    } finally {
      setLoading(false)
    }
  }

  async function openAudit(audit: AuditSession) {
    try {
      const { data } = await api.get(`/api/audits/${audit.id}`)
      setSelected(data)
    } catch {
      setSelected(audit)
    }
  }

  async function approveItem(item: AuditItem) {
    if (!selected) return
    setActionLoading(true)
    try {
      await api.post(`/api/audits/${selected.id}/items/${item.id}/approve`)
      const { data } = await api.get(`/api/audits/${selected.id}`)
      setSelected(data)
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.detail ?? "No se pudo aprobar.")
    } finally {
      setActionLoading(false)
    }
  }

  function openReturn(item: AuditItem) {
    setReturnComment("")
    setReturnModal({ open: true, item })
  }

  async function submitReturn() {
    if (!returnComment.trim()) { Alert.alert("Error", "El comentario es obligatorio al devolver."); return }
    if (!selected || !returnModal.item) return
    setActionLoading(true)
    try {
      await api.post(`/api/audits/${selected.id}/items/${returnModal.item.id}/return`, { comment: returnComment.trim() })
      setReturnModal({ open: false, item: null })
      const { data } = await api.get(`/api/audits/${selected.id}`)
      setSelected(data)
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.detail ?? "No se pudo devolver.")
    } finally {
      setActionLoading(false)
    }
  }

  function openCancel(id: string) {
    setCancelReason("")
    setCancelModal({ open: true, id })
  }

  async function submitCancel() {
    if (!cancelReason.trim()) { Alert.alert("Error", "El motivo es obligatorio."); return }
    setActionLoading(true)
    try {
      await api.patch(`/api/audits/${cancelModal.id}/cancel`, { reason: cancelReason.trim() })
      setCancelModal({ open: false, id: "" })
      setSelected(null)
      fetchAudits()
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.detail ?? "No se pudo cancelar.")
    } finally {
      setActionLoading(false)
    }
  }

  const FILTERS: { label: string; value: AuditFilter }[] = [
    { label: "Todas", value: "" },
    { label: "En curso", value: "en_curso" },
    { label: "Completadas", value: "completada" },
    { label: "Canceladas", value: "cancelada" },
  ]

  const renderAudit = ({ item: a }: { item: AuditSession }) => {
    const total   = a.items?.length ?? 0
    const pending = a.items?.filter((i) => !i.approved_at && !i.returned_at).length ?? 0
    return (
      <TouchableOpacity style={styles.auditRow} onPress={() => openAudit(a)} activeOpacity={0.8}>
        <View style={{ flex: 1 }}>
          <Text style={styles.auditCode}>{(a as any).audit_code ?? a.id.slice(0, 8).toUpperCase()}</Text>
          <Text style={styles.auditTitle} numberOfLines={1}>{a.title}</Text>
          <Text style={styles.auditMeta}>{a.auditor?.name ?? "—"} · {total} activos · {pending} pendientes</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[a.status] ?? Colors.textMuted) + "22" }]}>
            <Text style={[styles.statusBadgeText, { color: STATUS_COLORS[a.status] ?? Colors.textMuted }]}>
              {STATUS_LABELS[a.status] ?? a.status}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={{ gap: 8, paddingHorizontal: Spacing.lg }}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.chip, filter === f.value && styles.chipActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[styles.chipText, filter === f.value && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.brand} />
      ) : (
        <FlatList
          data={audits}
          keyExtractor={(a) => a.id}
          renderItem={renderAudit}
          contentContainerStyle={{ padding: Spacing.lg, gap: 8 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="clipboard-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No hay auditorías</Text>
            </View>
          }
        />
      )}

      {/* Audit detail modal */}
      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={{ flex: 1, backgroundColor: Colors.bg }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelected(null)} style={{ padding: 4 }}>
              <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle} numberOfLines={1}>{selected?.title}</Text>
            {selected && (selected.status === "en_curso" || selected.status === "assigned") && (
              <TouchableOpacity onPress={() => openCancel(selected.id)} style={{ padding: 4 }}>
                <Ionicons name="close-circle-outline" size={22} color={Colors.danger} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.lg, gap: 12 }}>
            {selected && (
              <>
                {/* Summary */}
                <View style={styles.summaryCard}>
                  <SummaryStat label="Total" value={selected.items?.length ?? 0} color={Colors.textPrimary} />
                  <SummaryStat label="Pendientes" value={selected.items?.filter((i) => !i.approved_at && !i.returned_at && i.result).length ?? 0} color={Colors.warning} />
                  <SummaryStat label="Aprobados" value={selected.items?.filter((i) => i.approved_at).length ?? 0} color={Colors.success} />
                  <SummaryStat label="Devueltos" value={selected.items?.filter((i) => i.returned_at && !i.approved_at).length ?? 0} color={Colors.danger} />
                </View>

                {/* Items */}
                {(selected.items ?? []).map((item) => (
                  <View key={item.id} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemAssetName} numberOfLines={1}>
                          {item.asset?.name ?? "Activo desconocido"}
                        </Text>
                        <Text style={styles.itemAssetCode}>{item.asset?.code ?? "—"}</Text>
                      </View>
                      <View style={[styles.resultBadge, { backgroundColor: (RESULT_COLORS[item.result] ?? Colors.textMuted) + "22" }]}>
                        <Text style={[styles.resultBadgeText, { color: RESULT_COLORS[item.result] ?? Colors.textMuted }]}>
                          {RESULT_LABELS[item.result] ?? item.result}
                        </Text>
                      </View>
                    </View>

                    {item.notes && (
                      <Text style={styles.itemNotes} numberOfLines={2}>{item.notes}</Text>
                    )}

                    {item.severity && (
                      <View style={styles.itemSevRow}>
                        <Text style={styles.itemSevLabel}>Severidad:</Text>
                        <Text style={[styles.itemSevValue, { color: SEV_COLORS[item.severity] ?? Colors.textMuted }]}>
                          {item.severity.charAt(0).toUpperCase() + item.severity.slice(1)}
                        </Text>
                      </View>
                    )}

                    {item.returned_at && !item.approved_at && (
                      <View style={styles.returnedBanner}>
                        <Ionicons name="return-down-back-outline" size={14} color={Colors.warning} />
                        <Text style={styles.returnedText}>Devuelto para corrección</Text>
                      </View>
                    )}

                    {/* Actions */}
                    {!item.approved_at && item.result && !item.returned_at && (
                      <View style={styles.itemActions}>
                        <TouchableOpacity
                          style={[styles.itemBtn, styles.approveBtn]}
                          onPress={() => approveItem(item)}
                          disabled={actionLoading}
                        >
                          <Ionicons name="checkmark" size={14} color={Colors.white} />
                          <Text style={styles.approveBtnText}>Aprobar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.itemBtn, styles.returnBtn]}
                          onPress={() => openReturn(item)}
                          disabled={actionLoading}
                        >
                          <Ionicons name="arrow-undo-outline" size={14} color={Colors.danger} />
                          <Text style={styles.returnBtnText}>Devolver</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {item.approved_at && (
                      <View style={styles.approvedBanner}>
                        <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                        <Text style={styles.approvedText}>Aprobado</Text>
                      </View>
                    )}
                  </View>
                ))}

                {(!selected.items || selected.items.length === 0) && (
                  <View style={styles.empty}>
                    <Ionicons name="document-outline" size={28} color={Colors.textMuted} />
                    <Text style={styles.emptyText}>Sin activos en esta auditoría</Text>
                  </View>
                )}
              </>
            )}
            <View style={{ height: Spacing.xxl }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Cancel audit modal */}
      <Modal visible={cancelModal.open} transparent animationType="slide" onRequestClose={() => setCancelModal({ open: false, id: "" })}>
        <View style={styles.returnOverlay}>
          <View style={styles.returnSheet}>
            <Text style={styles.returnTitle}>Cancelar auditoría</Text>
            <Text style={styles.returnSub}>Indica el motivo de cancelación:</Text>
            <TextInput
              style={styles.returnInput}
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Ej: Aplazada por cambios en el inventario."
              multiline
              autoFocus
            />
            <View style={styles.returnActions}>
              <TouchableOpacity style={styles.returnCancelBtn} onPress={() => setCancelModal({ open: false, id: "" })}>
                <Text style={{ color: Colors.textPrimary, fontWeight: "600" }}>Volver</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.returnConfirmBtn, actionLoading && { opacity: 0.6 }]} onPress={submitCancel} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.returnConfirmText}>Cancelar auditoría</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Return comment modal */}
      <Modal visible={returnModal.open} transparent animationType="slide" onRequestClose={() => setReturnModal({ open: false, item: null })}>
        <View style={styles.returnOverlay}>
          <View style={styles.returnSheet}>
            <Text style={styles.returnTitle}>Devolver al capturista</Text>
            <Text style={styles.returnSub}>Escribe el comentario con la corrección requerida:</Text>
            <TextInput
              style={[styles.returnInput]}
              value={returnComment}
              onChangeText={setReturnComment}
              placeholder="Ej: La serie no coincide, verificar nuevamente."
              multiline
              autoFocus
            />
            <View style={styles.returnActions}>
              <TouchableOpacity style={styles.returnCancelBtn} onPress={() => setReturnModal({ open: false, item: null })}>
                <Text style={{ color: Colors.textPrimary, fontWeight: "600" }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.returnConfirmBtn, actionLoading && { opacity: 0.6 }]} onPress={submitReturn} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.returnConfirmText}>Devolver</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function SummaryStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={[styles.summaryNum, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.bg },
  chips:       { maxHeight: 48, marginVertical: 8 },
  chip:        { paddingHorizontal: 14, height: 32, borderRadius: 16, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border, justifyContent: "center" },
  chipActive:  { backgroundColor: Colors.brand, borderColor: Colors.brand },
  chipText:    { fontSize: FontSize.xs, color: Colors.textPrimary, fontWeight: "600" },
  chipTextActive: { color: Colors.white },
  auditRow:    { flexDirection: "row", alignItems: "center", backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  auditCode:   { fontSize: FontSize.xs, color: Colors.brand, fontWeight: "700", marginBottom: 2 },
  auditTitle:  { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary },
  auditMeta:   { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  statusBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  statusBadgeText: { fontSize: 10, fontWeight: "700" },
  empty:       { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText:   { fontSize: FontSize.sm, color: Colors.textMuted },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 8, padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.white },
  modalTitle:  { flex: 1, fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  summaryCard:    { flexDirection: "row", justifyContent: "space-around", backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  summaryNum:     { fontSize: FontSize.xxl, fontWeight: "700" },
  summaryLabel:   { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  itemCard:       { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  itemHeader:     { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  itemAssetName:  { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary },
  itemAssetCode:  { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  resultBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  resultBadgeText:{ fontSize: 10, fontWeight: "700" },
  itemNotes:      { fontSize: FontSize.xs, color: Colors.textSecondary, fontStyle: "italic" },
  itemSevRow:     { flexDirection: "row", gap: 6 },
  itemSevLabel:   { fontSize: FontSize.xs, color: Colors.textMuted },
  itemSevValue:   { fontSize: FontSize.xs, fontWeight: "700" },
  itemActions:    { flexDirection: "row", gap: 8 },
  itemBtn:        { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8, borderRadius: Radius.md },
  approveBtn:     { backgroundColor: Colors.success },
  approveBtnText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: "700" },
  returnBtn:      { backgroundColor: Colors.dangerBg, borderWidth: 1, borderColor: Colors.danger },
  returnBtnText:  { color: Colors.danger, fontSize: FontSize.xs, fontWeight: "700" },
  approvedBanner: { flexDirection: "row", alignItems: "center", gap: 6 },
  approvedText:   { fontSize: FontSize.xs, color: Colors.success, fontWeight: "600" },
  returnedBanner: { flexDirection: "row", alignItems: "center", gap: 6 },
  returnedText:   { fontSize: FontSize.xs, color: Colors.warning, fontWeight: "600" },
  returnOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  returnSheet:    { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.xl, gap: 12 },
  returnTitle:    { fontSize: FontSize.lg, fontWeight: "700", color: Colors.textPrimary },
  returnSub:      { fontSize: FontSize.sm, color: Colors.textMuted },
  returnInput:    { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: 12, fontSize: FontSize.base, minHeight: 80, textAlignVertical: "top", color: Colors.textPrimary },
  returnActions:  { flexDirection: "row", gap: 10 },
  returnCancelBtn:  { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, paddingVertical: 12, alignItems: "center" },
  returnConfirmBtn: { flex: 1, backgroundColor: Colors.danger, borderRadius: Radius.lg, paddingVertical: 12, alignItems: "center" },
  returnConfirmText:{ color: Colors.white, fontWeight: "700" },
})
