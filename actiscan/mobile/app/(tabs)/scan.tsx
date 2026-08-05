import { useState, useRef } from "react"
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, TextInput,
  ScrollView, Image, ActivityIndicator
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { CameraView, useCameraPermissions, CameraType } from "expo-camera"
import * as ImagePicker from "expo-image-picker"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Ionicons } from "@expo/vector-icons"
import api from "@/lib/api"
import {
  Asset, AuditSession, AuditItemResult, ObservationSeverity,
  RESULT_LABELS, SEVERITY_LABELS, RESULTS_REQUIRING_NOTES, CRITICAL_RESULTS,
} from "@/types"
import { Button, Card, AssetStatusBadge } from "@/components/ui"
import { Colors, Spacing, Radius, FontSize } from "@/theme"
import { useNetworkStatus } from "@/lib/network"

type ScanState = "scanning" | "found" | "not_found"

const RESULT_COLORS: Record<AuditItemResult, { border: string; active: string; text: string }> = {
  presente:    { border: Colors.success,  active: Colors.success,  text: "#fff" },
  faltante:    { border: Colors.danger,   active: Colors.danger,   text: "#fff" },
  danado:      { border: Colors.warning,  active: Colors.warning,  text: "#fff" },
  reubicado:   { border: Colors.info,     active: Colors.info,     text: "#fff" },
  no_accesible:{ border: "#9333ea",       active: "#9333ea",       text: "#fff" },
  no_aplica:   { border: Colors.textMuted,active: Colors.textMuted,text: "#fff" },
  alerta:      { border: Colors.warning,  active: Colors.warning,  text: "#fff" },
}

const RESULT_ORDER: AuditItemResult[] = [
  "presente", "faltante", "danado", "reubicado", "no_accesible", "no_aplica",
]

export default function ScanScreen() {
  const qc = useQueryClient()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanState, setScanState] = useState<ScanState>("scanning")
  const [scannedAsset, setScannedAsset] = useState<Asset | null>(null)
  const [manualCode, setManualCode] = useState("")
  const [activeSession, setActiveSession] = useState<string | null>(null)
  const [auditResult, setAuditResult] = useState<AuditItemResult | null>(null)
  const [notes, setNotes] = useState("")
  const [severity, setSeverity] = useState<ObservationSeverity | null>(null)
  const [detectedLocation, setDetectedLocation] = useState("")
  const [detectedResponsible, setDetectedResponsible] = useState("")
  const [evidences, setEvidences] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [searching, setSearching] = useState(false)
  const scannedRef = useRef(false)
  const isOnline = useNetworkStatus()

  const { data: sessions } = useQuery<AuditSession[]>({
    queryKey: ["audits", "active"],
    queryFn: () =>
      api.get("/api/audits").then((r) =>
        (r.data as AuditSession[]).filter((s) => s.status === "en_curso")
      ),
    enabled: isOnline,
    refetchInterval: isOnline ? 15_000 : false,
  })

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scannedRef.current) return
    scannedRef.current = true

    const match = data.match(/actiscan:\/\/asset\/([^?]+)\?code=(.+)/)
    const code = match ? match[2] : data

    try {
      setSearching(true)
      const res = await api.get(`/api/assets/by-code/${encodeURIComponent(code)}`)
      setScannedAsset(res.data)
      setScanState("found")
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setScanState("not_found")
      } else {
        Alert.alert("Error de red", "No se pudo consultar el activo. Verifica tu conexión.")
        scannedRef.current = false
      }
    } finally {
      setSearching(false)
    }
  }

  const handleManualSearch = async () => {
    const code = manualCode.trim()
    if (!code) return
    if (!isOnline) {
      Alert.alert("Sin conexión", "Se requiere conexión para buscar activos")
      return
    }
    try {
      setSearching(true)
      const res = await api.get(`/api/assets/by-code/${encodeURIComponent(code)}`)
      setScannedAsset(res.data)
      setScanState("found")
    } catch (err: any) {
      if (err?.response?.status === 404) {
        Alert.alert("Activo no encontrado", `No existe el código "${code}" en el sistema`)
      } else {
        Alert.alert("Error", "No se pudo buscar el activo. Verifica tu conexión.")
      }
    } finally {
      setSearching(false)
    }
  }

  const takeEvidencePhoto = async () => {
    const permResult = await ImagePicker.requestCameraPermissionsAsync()
    if (!permResult.granted) {
      Alert.alert("Permiso requerido", "Se necesita acceso a la cámara para tomar evidencias fotográficas")
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
    })
    if (!result.canceled && result.assets[0]) {
      setEvidences((prev) => [...prev, result.assets[0].uri])
    }
  }

  const pickEvidenceFromGallery = async () => {
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permResult.granted) {
      Alert.alert("Permiso requerido", "Se necesita acceso a la galería para adjuntar evidencias")
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsMultipleSelection: false,
    })
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      const size = asset.fileSize ?? 0
      if (size > 10 * 1024 * 1024) {
        Alert.alert("Archivo muy grande", "La imagen no debe superar 10 MB")
        return
      }
      setEvidences((prev) => [...prev, asset.uri])
    }
  }

  const removeEvidence = (index: number) => {
    setEvidences((prev) => prev.filter((_, i) => i !== index))
  }

  const handleRegisterAudit = async () => {
    if (!auditResult) {
      Alert.alert("Selecciona un resultado", "Elige el resultado del escaneo para este activo")
      return
    }
    if (!activeSession) {
      Alert.alert("Selecciona una auditoría", "Elige la auditoría activa en la que registrar este resultado")
      return
    }

    // Notes required for specific results
    if (RESULTS_REQUIRING_NOTES.includes(auditResult) && !notes.trim()) {
      Alert.alert(
        "Observación requerida",
        `El resultado "${RESULT_LABELS[auditResult]}" requiere ingresar una observación explicando la situación.`
      )
      return
    }

    // Evidence required for damaged assets
    if (auditResult === "danado" && evidences.length === 0) {
      Alert.alert("Evidencia requerida", "Debes adjuntar al menos una fotografía cuando el activo está dañado")
      return
    }

    // Confirmation for critical results
    if (CRITICAL_RESULTS.includes(auditResult)) {
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "Confirmar resultado crítico",
          `Estás a punto de registrar "${RESULT_LABELS[auditResult]}" para ${scannedAsset?.name}. ¿Confirmas?`,
          [
            { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
            { text: "Confirmar", style: "destructive", onPress: () => resolve(true) },
          ]
        )
      })
      if (!confirmed) return
    }

    // Confirmation for critical severity
    if (severity === "critica") {
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "Severidad crítica",
          "Has marcado la observación como CRÍTICA. ¿Confirmas el registro?",
          [
            { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
            { text: "Confirmar", style: "destructive", onPress: () => resolve(true) },
          ]
        )
      })
      if (!confirmed) return
    }

    setSaving(true)
    try {
      await api.post(`/api/audits/${activeSession}/scan`, {
        asset_id: scannedAsset!.id,
        result: auditResult,
        notes: notes.trim() || undefined,
        severity: severity || undefined,
        detected_location: detectedLocation.trim() || undefined,
        detected_responsible: detectedResponsible.trim() || undefined,
        evidence_urls: evidences.length > 0 ? evidences : undefined,
      })
      qc.invalidateQueries({ queryKey: ["audits"] })
      Alert.alert(
        "Registrado correctamente",
        `${scannedAsset!.name} fue marcado como "${RESULT_LABELS[auditResult]}"`,
        [{ text: "Continuar escaneo", onPress: resetScan }]
      )
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      Alert.alert("Error al guardar", detail ?? "No se pudo registrar el resultado. Verifica tu conexión.")
    } finally {
      setSaving(false)
    }
  }

  const resetScan = () => {
    setScanState("scanning")
    setScannedAsset(null)
    setManualCode("")
    setAuditResult(null)
    setNotes("")
    setSeverity(null)
    setDetectedLocation("")
    setDetectedResponsible("")
    setEvidences([])
    scannedRef.current = false
  }

  if (!permission) return <View style={styles.safe} />

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.permissionBox}>
          <View style={styles.permissionIconBox}>
            <Ionicons name="camera-outline" size={40} color={Colors.brand} />
          </View>
          <Text style={styles.permissionTitle}>Acceso a cámara requerido</Text>
          <Text style={styles.permissionSub}>
            ActiScan necesita acceso a la cámara para leer los códigos QR de los activos
            durante las auditorías. Los datos de la cámara no se almacenan ni se comparten.
          </Text>
          <Button title="Permitir acceso a cámara" onPress={requestPermission} style={{ marginTop: 24 }} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Connectivity warning */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="wifi-outline" size={14} color="#92400e" />
          <Text style={styles.offlineText}>Sin conexión — las búsquedas no están disponibles</Text>
        </View>
      )}

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Escanear QR</Text>
        <Text style={styles.headerSub}>
          {scanState === "scanning" ? "Apunta al código del activo" : scannedAsset?.code ?? "Activo identificado"}
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {scanState === "scanning" && (
          <>
            {/* Camera */}
            <View style={styles.cameraContainer}>
              <CameraView
                style={styles.camera}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={scannedRef.current ? undefined : handleBarCodeScanned}
                enableTorch={torchOn}
              />
              {/* Corner overlay */}
              <View style={[styles.corner, styles.tl]} />
              <View style={[styles.corner, styles.tr]} />
              <View style={[styles.corner, styles.bl]} />
              <View style={[styles.corner, styles.br]} />

              {/* Torch button */}
              <TouchableOpacity
                style={[styles.torchBtn, torchOn && styles.torchBtnActive]}
                onPress={() => setTorchOn((v) => !v)}
              >
                <Ionicons name={torchOn ? "flash" : "flash-outline"} size={20} color={Colors.white} />
              </TouchableOpacity>

              {searching && (
                <View style={styles.scanningOverlay}>
                  <ActivityIndicator color="#fff" size="large" />
                  <Text style={{ color: "#fff", marginTop: 8, fontWeight: "600" }}>Buscando activo...</Text>
                </View>
              )}
            </View>

            {/* Manual entry */}
            <View style={styles.manualBox}>
              <Text style={styles.manualLabel}>¿No funciona la cámara? Ingresa el código manualmente</Text>
              <View style={styles.manualRow}>
                <TextInput
                  style={styles.manualInput}
                  placeholder="Ej. ACT-2024-0058"
                  value={manualCode}
                  onChangeText={setManualCode}
                  autoCapitalize="characters"
                  placeholderTextColor={Colors.textMuted}
                  onSubmitEditing={handleManualSearch}
                  returnKeyType="search"
                />
                <TouchableOpacity
                  style={[styles.searchBtn, (!isOnline || searching) && { opacity: 0.5 }]}
                  onPress={handleManualSearch}
                  disabled={!isOnline || searching}
                >
                  {searching
                    ? <ActivityIndicator color={Colors.white} size="small" />
                    : <Text style={{ color: Colors.white, fontWeight: "600" }}>Buscar</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {scanState === "found" && scannedAsset && (
          <View style={{ padding: Spacing.lg }}>
            {/* Success banner */}
            <View style={styles.successBanner}>
              <View style={styles.successIconBox}>
                <Ionicons name="checkmark-circle" size={28} color={Colors.success} />
              </View>
              <View>
                <Text style={styles.successTitle}>QR leído correctamente</Text>
                <Text style={styles.successSub}>Activo identificado en el sistema</Text>
              </View>
            </View>

            {/* Asset info */}
            <Card style={styles.assetCard}>
              <Text style={styles.assetName}>{scannedAsset.name}</Text>
              <Text style={styles.assetCode}>{scannedAsset.code}</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <AssetStatusBadge status={scannedAsset.status} />
                {scannedAsset.category && (
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{scannedAsset.category.name}</Text>
                  </View>
                )}
              </View>
              {[
                { label: "Ubicación esperada", value: scannedAsset.location?.name },
                { label: "Responsable esperado", value: scannedAsset.responsible_user?.name },
                { label: "Marca / Modelo", value: scannedAsset.brand ? `${scannedAsset.brand}${scannedAsset.model ? " " + scannedAsset.model : ""}` : undefined },
                { label: "N° de serie", value: scannedAsset.serial_number },
              ].filter(r => r.value).map(({ label, value }) => (
                <View key={label} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{label}</Text>
                  <Text style={styles.infoValue}>{value}</Text>
                </View>
              ))}
            </Card>

            {/* Audit registration */}
            <Card>
              <Text style={styles.sectionLabel}>Registrar en auditoría</Text>

              {/* Session selector */}
              {sessions && sessions.length > 0 ? (
                <View style={{ marginBottom: 14 }}>
                  <Text style={styles.fieldLabel}>Auditoría activa *</Text>
                  {sessions.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.sessionChip, activeSession === s.id && styles.sessionChipActive]}
                      onPress={() => setActiveSession(s.id)}
                    >
                      <Text style={[styles.sessionChipText, activeSession === s.id && { color: Colors.white }]}>
                        {s.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.noSessionsBox}>
                  <Text style={styles.noSessionsText}>No hay auditorías activas. Crea una desde la pestaña Auditorías.</Text>
                </View>
              )}

              {/* Result buttons — 2 per row */}
              <Text style={styles.fieldLabel}>Resultado del escaneo *</Text>
              <View style={styles.resultGrid}>
                {RESULT_ORDER.map((r) => {
                  const c = RESULT_COLORS[r]
                  const selected = auditResult === r
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.resultBtn,
                        { borderColor: c.border, backgroundColor: selected ? c.active : Colors.white },
                      ]}
                      onPress={() => setAuditResult(r)}
                    >
                      <Text style={[styles.resultBtnText, { color: selected ? c.text : c.border }]}>
                        {RESULT_LABELS[r]}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              {/* Detected location (for relocated) */}
              {(auditResult === "reubicado") && (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Ubicación detectada</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="¿Dónde se encontró el activo?"
                    value={detectedLocation}
                    onChangeText={setDetectedLocation}
                    placeholderTextColor={Colors.textMuted}
                  />
                </>
              )}

              {/* Detected responsible */}
              {(auditResult === "reubicado") && (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Responsable detectado</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Nombre de quien tiene el activo"
                    value={detectedResponsible}
                    onChangeText={setDetectedResponsible}
                    placeholderTextColor={Colors.textMuted}
                  />
                </>
              )}

              {/* Observations */}
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>
                Observaciones {RESULTS_REQUIRING_NOTES.includes(auditResult ?? "presente") ? "*" : "(opcional)"}
              </Text>
              <TextInput
                style={styles.notesInput}
                placeholder={
                  auditResult === "danado"
                    ? "Describe el daño encontrado..."
                    : auditResult === "faltante"
                    ? "Explica por qué no se encontró..."
                    : auditResult === "no_aplica"
                    ? "Justifica por qué no aplica..."
                    : "Agrega notas sobre el estado del activo..."
                }
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                placeholderTextColor={Colors.textMuted}
                maxLength={500}
              />
              <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted, textAlign: "right", marginTop: 2 }}>
                {notes.length}/500
              </Text>

              {/* Severity */}
              {auditResult && auditResult !== "presente" && auditResult !== "no_aplica" && (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Severidad de la observación</Text>
                  <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                    {(["baja", "media", "alta", "critica"] as ObservationSeverity[]).map((s) => {
                      const colors = {
                        baja:   { bg: Colors.successBg, border: Colors.success, text: Colors.success },
                        media:  { bg: "#fef9c3",        border: Colors.warning,  text: Colors.warning },
                        alta:   { bg: Colors.dangerBg,  border: "#f97316",       text: "#f97316" },
                        critica:{ bg: "#fce7f3",        border: Colors.danger,   text: Colors.danger },
                      }[s]
                      return (
                        <TouchableOpacity
                          key={s}
                          style={[
                            styles.severityChip,
                            { borderColor: colors.border, backgroundColor: severity === s ? colors.border : colors.bg },
                          ]}
                          onPress={() => setSeverity(severity === s ? null : s)}
                        >
                          <Text style={[styles.severityText, { color: severity === s ? "#fff" : colors.text }]}>
                            {SEVERITY_LABELS[s]}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </>
              )}

              {/* Evidence */}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
                Evidencias fotográficas {auditResult === "danado" ? "*" : "(opcional)"}
              </Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <TouchableOpacity style={styles.evidenceBtn} onPress={takeEvidencePhoto}>
                  <Ionicons name="camera-outline" size={18} color={Colors.brand} />
                  <Text style={styles.evidenceBtnText}>Cámara</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.evidenceBtn} onPress={pickEvidenceFromGallery}>
                  <Ionicons name="images-outline" size={18} color={Colors.brand} />
                  <Text style={styles.evidenceBtnText}>Galería</Text>
                </TouchableOpacity>
              </View>
              {evidences.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  {evidences.map((uri, idx) => (
                    <View key={idx} style={styles.evidenceThumb}>
                      <Image source={{ uri }} style={styles.evidenceImg} />
                      <TouchableOpacity style={styles.evidenceRemove} onPress={() => removeEvidence(idx)}>
                        <Ionicons name="close" size={10} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              <Button
                title="Guardar resultado"
                onPress={handleRegisterAudit}
                loading={saving}
                style={{ marginTop: 12 }}
              />
              <Button
                title="Cancelar"
                onPress={resetScan}
                variant="secondary"
                style={{ marginTop: 8 }}
              />
            </Card>

            <View style={{ height: Spacing.xxl }} />
          </View>
        )}

        {scanState === "not_found" && (
          <View style={styles.notFoundBox}>
            <View style={styles.notFoundIconBox}>
              <Ionicons name="help-circle-outline" size={48} color={Colors.textMuted} />
            </View>
            <Text style={styles.notFoundTitle}>Activo no registrado</Text>
            <Text style={styles.notFoundSub}>
              El código QR no corresponde a ningún activo registrado en el sistema.{"\n"}
              Puede que el QR esté dañado o sea de otro sistema.
            </Text>
            <Button title="Volver a escanear" onPress={resetScan} style={{ marginTop: 20 }} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  offlineBanner:  { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fef3c7", paddingVertical: 8, paddingHorizontal: 16, justifyContent: "center" },
  offlineText:    { fontSize: FontSize.xs, color: "#92400e", fontWeight: "600" },
  header:         { backgroundColor: Colors.brand, padding: Spacing.xl, paddingBottom: Spacing.lg },
  headerTitle:    { fontSize: FontSize.xl, fontWeight: "600", color: Colors.white },
  headerSub:      { fontSize: FontSize.sm, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  cameraContainer:{ position: "relative", margin: Spacing.lg, borderRadius: Radius.xl, overflow: "hidden", height: 260 },
  camera:         { flex: 1 },
  corner:         { position: "absolute", width: 32, height: 32, borderColor: "#4FC3F7", borderWidth: 3 },
  tl:             { top: 16, left: 16, borderRightWidth: 0, borderBottomWidth: 0, borderRadius: 4 },
  tr:             { top: 16, right: 16, borderLeftWidth: 0, borderBottomWidth: 0, borderRadius: 4 },
  bl:             { bottom: 16, left: 16, borderRightWidth: 0, borderTopWidth: 0, borderRadius: 4 },
  br:             { bottom: 16, right: 16, borderLeftWidth: 0, borderTopWidth: 0, borderRadius: 4 },
  torchBtn:       {
    position: "absolute", bottom: 12, right: 12,
    backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 24,
    width: 44, height: 44, alignItems: "center", justifyContent: "center",
  },
  torchBtnActive: { backgroundColor: "rgba(255,215,0,0.6)" },
  scanningOverlay:{
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center",
  },
  manualBox:      { margin: Spacing.lg, marginTop: 0 },
  manualLabel:    { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 8, lineHeight: 16 },
  manualRow:      { flexDirection: "row", gap: 8 },
  manualInput:    {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: FontSize.base,
    backgroundColor: Colors.white, color: Colors.textPrimary,
  },
  searchBtn:      { backgroundColor: Colors.brand, borderRadius: Radius.md, paddingHorizontal: 16, justifyContent: "center", minWidth: 70, alignItems: "center" },
  successBanner:  {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.successBg, borderRadius: Radius.lg, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: "#86efac",
  },
  successIconBox: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.successBg, alignItems: "center", justifyContent: "center" },
  successTitle:   { fontSize: FontSize.base, fontWeight: "600", color: "#166534" },
  successSub:     { fontSize: FontSize.xs, color: "#16a34a", marginTop: 2 },
  assetCard:      { marginBottom: 12 },
  assetName:      { fontSize: FontSize.md, fontWeight: "600", color: Colors.textPrimary },
  assetCode:      { fontSize: FontSize.sm, color: Colors.brand, fontFamily: "monospace", marginTop: 2 },
  infoRow:        { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, marginTop: 6 },
  infoLabel:      { fontSize: FontSize.sm, color: Colors.textMuted, flex: 1 },
  infoValue:      { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: "500", flex: 1, textAlign: "right" },
  chip:           { backgroundColor: Colors.infoBg, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  chipText:       { fontSize: FontSize.xs, color: Colors.info, fontWeight: "600" },
  sectionLabel:   { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary, marginBottom: 14 },
  fieldLabel:     { fontSize: FontSize.sm, fontWeight: "500", color: Colors.textSecondary, marginBottom: 6 },
  resultGrid:     { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  resultBtn:      { paddingVertical: 10, paddingHorizontal: 12, borderRadius: Radius.md, borderWidth: 1.5, minWidth: "30%", alignItems: "center" },
  resultBtnText:  { fontSize: FontSize.xs, fontWeight: "600" },
  textInput:      {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: 10, fontSize: FontSize.sm, color: Colors.textPrimary, backgroundColor: Colors.white,
  },
  notesInput:     {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: 10, fontSize: FontSize.sm, minHeight: 72, color: Colors.textPrimary, backgroundColor: Colors.white,
  },
  sessionChip:    { padding: 10, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, marginBottom: 6 },
  sessionChipActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  sessionChipText:   { fontSize: FontSize.sm, color: Colors.textPrimary },
  severityChip:   { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1.5 },
  severityText:   { fontSize: FontSize.xs, fontWeight: "600" },
  noSessionsBox:  { backgroundColor: Colors.warningBg, borderRadius: Radius.md, padding: 12, marginBottom: 14 },
  noSessionsText: { fontSize: FontSize.sm, color: Colors.warning, textAlign: "center" },
  evidenceBtn:    {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 10,
    backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.brand, minWidth: 90,
  },
  evidenceBtnText:{ fontSize: FontSize.xs, color: Colors.brand, fontWeight: "600" },
  evidenceThumb:  { position: "relative", marginRight: 8 },
  evidenceImg:    { width: 72, height: 72, borderRadius: Radius.md, backgroundColor: Colors.border },
  evidenceRemove: {
    position: "absolute", top: -6, right: -6, width: 20, height: 20,
    backgroundColor: Colors.danger, borderRadius: 10, alignItems: "center", justifyContent: "center",
  },
  permissionBox:     { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  permissionIconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.infoBg, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  permissionTitle:   { fontSize: FontSize.lg, fontWeight: "700", color: Colors.textPrimary, marginBottom: 12, textAlign: "center" },
  permissionSub:     { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: "center", lineHeight: 22 },
  notFoundBox:       { alignItems: "center", justifyContent: "center", padding: 40 },
  notFoundIconBox:   { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.white, alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border },
  notFoundTitle:     { fontSize: FontSize.lg, fontWeight: "700", color: Colors.textPrimary },
  notFoundSub:       { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: "center", marginTop: 8, lineHeight: 22 },
})
