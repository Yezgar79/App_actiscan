import { useState, useRef } from "react"
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ScrollView } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { CameraView, useCameraPermissions } from "expo-camera"
import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { Asset, AuditSession } from "@/types"
import { Button, Card, AssetStatusBadge } from "@/components/ui"
import { Colors, Spacing, Radius, FontSize } from "@/theme"

type ScanState = "scanning" | "found" | "not_found"

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions()
  const [scanState, setScanState] = useState<ScanState>("scanning")
  const [scannedAsset, setScannedAsset] = useState<Asset | null>(null)
  const [manualCode, setManualCode] = useState("")
  const [activeSession, setActiveSession] = useState<string | null>(null)
  const [auditResult, setAuditResult] = useState<"presente" | "faltante" | "alerta" | null>(null)
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const scannedRef = useRef(false)

  const { data: sessions } = useQuery<AuditSession[]>({
    queryKey: ["audits", "active"],
    queryFn: () =>
      api.get("/api/audits").then((r) =>
        (r.data as AuditSession[]).filter((s) => s.status === "en_curso")
      ),
  })

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scannedRef.current) return
    scannedRef.current = true

    // Parse actiscan://asset/{id}?code={code}
    const match = data.match(/actiscan:\/\/asset\/([^?]+)\?code=(.+)/)
    const code = match ? match[2] : data

    try {
      const res = await api.get(`/api/assets/by-code/${code}`)
      setScannedAsset(res.data)
      setScanState("found")
    } catch {
      setScanState("not_found")
    }
  }

  const handleManualSearch = async () => {
    if (!manualCode.trim()) return
    try {
      const res = await api.get(`/api/assets/by-code/${manualCode.trim()}`)
      setScannedAsset(res.data)
      setScanState("found")
    } catch {
      Alert.alert("Activo no encontrado", `No existe el código ${manualCode}`)
    }
  }

  const handleRegisterAudit = async () => {
    if (!auditResult) { Alert.alert("Selecciona un resultado", "Elige Presente, Faltante o Alerta"); return }
    if (!activeSession) { Alert.alert("Selecciona una auditoría", "Elige la auditoría activa"); return }
    setSaving(true)
    try {
      await api.post(`/api/audits/${activeSession}/scan`, {
        asset_id: scannedAsset!.id,
        result: auditResult,
        notes: notes || undefined,
      })
      Alert.alert("✅ Registrado", `${scannedAsset!.name} marcado como ${auditResult}`, [
        { text: "Continuar", onPress: resetScan }
      ])
    } catch {
      Alert.alert("Error", "No se pudo registrar el escaneo")
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
    scannedRef.current = false
  }

  if (!permission) return <View style={styles.safe} />

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.permissionBox}>
          <Text style={styles.permissionTitle}>Acceso a cámara requerido</Text>
          <Text style={styles.permissionSub}>ActiScan necesita la cámara para leer los códigos QR de los activos.</Text>
          <Button title="Permitir acceso" onPress={requestPermission} style={{ marginTop: 20 }} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Escanear QR</Text>
        <Text style={styles.headerSub}>
          {scanState === "scanning" ? "Apunta al código del activo" : scannedAsset?.code ?? "Activo encontrado"}
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
                onBarcodeScanned={handleBarCodeScanned}
              />
              {/* Corners overlay */}
              <View style={[styles.corner, styles.tl]} />
              <View style={[styles.corner, styles.tr]} />
              <View style={[styles.corner, styles.bl]} />
              <View style={[styles.corner, styles.br]} />
            </View>

            {/* Manual input */}
            <View style={styles.manualBox}>
              <Text style={styles.manualLabel}>O ingresa el código manualmente</Text>
              <View style={styles.manualRow}>
                <TextInput
                  style={styles.manualInput}
                  placeholder="Ej. ACT-2024-0058"
                  value={manualCode}
                  onChangeText={setManualCode}
                  autoCapitalize="characters"
                  placeholderTextColor={Colors.textMuted}
                />
                <TouchableOpacity style={styles.searchBtn} onPress={handleManualSearch}>
                  <Text style={{ color: Colors.white, fontWeight: "600" }}>Buscar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {scanState === "found" && scannedAsset && (
          <View style={{ padding: Spacing.lg }}>
            {/* Success banner */}
            <View style={styles.successBanner}>
              <Text style={styles.successIcon}>✅</Text>
              <View>
                <Text style={styles.successTitle}>QR leído correctamente</Text>
                <Text style={styles.successSub}>Activo identificado en el sistema</Text>
              </View>
            </View>

            {/* Asset info */}
            <Card style={styles.assetCard}>
              <Text style={styles.assetName}>{scannedAsset.name}</Text>
              <Text style={styles.assetCode}>{scannedAsset.code}</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <AssetStatusBadge status={scannedAsset.status} />
                {scannedAsset.category && (
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{scannedAsset.category.name}</Text>
                  </View>
                )}
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Ubicación</Text>
                <Text style={styles.infoValue}>{scannedAsset.location?.name ?? "—"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Responsable</Text>
                <Text style={styles.infoValue}>{scannedAsset.responsible_user?.name ?? "—"}</Text>
              </View>
              {scannedAsset.brand && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Marca / Modelo</Text>
                  <Text style={styles.infoValue}>{scannedAsset.brand} {scannedAsset.model}</Text>
                </View>
              )}
            </Card>

            {/* Audit registration */}
            <Card>
              <Text style={styles.sectionLabel}>Registrar en auditoría</Text>

              {/* Session selector */}
              {sessions && sessions.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={styles.fieldLabel}>Auditoría activa</Text>
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
              )}

              {/* Result buttons */}
              <Text style={styles.fieldLabel}>Resultado del escaneo</Text>
              <View style={styles.resultRow}>
                {(["presente", "faltante", "alerta"] as const).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.resultBtn,
                      {
                        borderColor: r === "presente" ? Colors.success : r === "faltante" ? Colors.danger : Colors.warning,
                        backgroundColor: auditResult === r
                          ? (r === "presente" ? Colors.success : r === "faltante" ? Colors.danger : Colors.warning)
                          : Colors.white,
                      }
                    ]}
                    onPress={() => setAuditResult(r)}
                  >
                    <Text style={{
                      fontSize: FontSize.sm, fontWeight: "600", textTransform: "capitalize",
                      color: auditResult === r ? Colors.white
                        : r === "presente" ? Colors.success
                        : r === "faltante" ? Colors.danger
                        : Colors.warning,
                    }}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Notes */}
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Observaciones (opcional)</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Agrega notas sobre el estado del activo..."
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                placeholderTextColor={Colors.textMuted}
              />

              <Button
                title="Guardar y continuar"
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
            <Text style={styles.notFoundIcon}>❓</Text>
            <Text style={styles.notFoundTitle}>Activo no encontrado</Text>
            <Text style={styles.notFoundSub}>El código QR no corresponde a ningún activo registrado</Text>
            <Button title="Volver a escanear" onPress={resetScan} style={{ marginTop: 20 }} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: Colors.bg },
  header:     { backgroundColor: Colors.brand, padding: Spacing.xl, paddingBottom: Spacing.lg },
  headerTitle:{ fontSize: FontSize.xl, fontWeight: "600", color: Colors.white },
  headerSub:  { fontSize: FontSize.sm, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  cameraContainer: { position: "relative", margin: Spacing.lg, borderRadius: Radius.xl, overflow: "hidden", height: 250 },
  camera:     { flex: 1 },
  corner:     { position: "absolute", width: 32, height: 32, borderColor: "#4FC3F7", borderWidth: 3 },
  tl:         { top: 16, left: 16, borderRightWidth: 0, borderBottomWidth: 0, borderRadius: 4 },
  tr:         { top: 16, right: 16, borderLeftWidth: 0, borderBottomWidth: 0, borderRadius: 4 },
  bl:         { bottom: 16, left: 16, borderRightWidth: 0, borderTopWidth: 0, borderRadius: 4 },
  br:         { bottom: 16, right: 16, borderLeftWidth: 0, borderTopWidth: 0, borderRadius: 4 },
  manualBox:  { margin: Spacing.lg, marginTop: 0 },
  manualLabel:{ fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 8 },
  manualRow:  { flexDirection: "row", gap: 8 },
  manualInput:{
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: FontSize.base,
    backgroundColor: Colors.white, color: Colors.textPrimary,
  },
  searchBtn:  {
    backgroundColor: Colors.brand, borderRadius: Radius.md,
    paddingHorizontal: 16, justifyContent: "center",
  },
  successBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: Colors.successBg, borderRadius: Radius.lg, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: "#86efac",
  },
  successIcon:  { fontSize: 24 },
  successTitle: { fontSize: FontSize.base, fontWeight: "600", color: "#166534" },
  successSub:   { fontSize: FontSize.xs, color: "#16a34a", marginTop: 2 },
  assetCard:    { marginBottom: 12 },
  assetName:    { fontSize: FontSize.md, fontWeight: "600", color: Colors.textPrimary },
  assetCode:    { fontSize: FontSize.sm, color: Colors.brand, fontFamily: "monospace", marginTop: 2 },
  infoRow:      { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, marginTop: 6 },
  infoLabel:    { fontSize: FontSize.sm, color: Colors.textMuted },
  infoValue:    { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: "500" },
  chip:         { backgroundColor: Colors.infoBg, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  chipText:     { fontSize: FontSize.xs, color: Colors.info, fontWeight: "600" },
  sectionLabel: { fontSize: FontSize.base, fontWeight: "600", color: Colors.textPrimary, marginBottom: 12 },
  fieldLabel:   { fontSize: FontSize.sm, fontWeight: "500", color: Colors.textSecondary, marginBottom: 6 },
  resultRow:    { flexDirection: "row", gap: 8 },
  resultBtn:    {
    flex: 1, paddingVertical: 10, borderRadius: Radius.md,
    borderWidth: 1.5, alignItems: "center",
  },
  sessionChip:  { padding: 10, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, marginBottom: 6 },
  sessionChipActive: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  sessionChipText: { fontSize: FontSize.sm, color: Colors.textPrimary },
  notesInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    padding: 10, fontSize: FontSize.sm, minHeight: 72, color: Colors.textPrimary, backgroundColor: Colors.white,
  },
  permissionBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  permissionTitle: { fontSize: FontSize.lg, fontWeight: "600", color: Colors.textPrimary, marginBottom: 8 },
  permissionSub:   { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: "center" },
  notFoundBox: { alignItems: "center", justifyContent: "center", padding: 40 },
  notFoundIcon: { fontSize: 48, marginBottom: 12 },
  notFoundTitle: { fontSize: FontSize.lg, fontWeight: "600", color: Colors.textPrimary },
  notFoundSub: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: "center", marginTop: 6 },
})
