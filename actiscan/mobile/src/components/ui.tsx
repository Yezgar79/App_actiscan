import React from "react"
import {
  TouchableOpacity, Text, View, TextInput, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle
} from "react-native"
import { Colors, Spacing, Radius, FontSize } from "@/theme"
import { AssetStatus, AuditItemResult } from "@/types"

// ─── Button ───────────────────────────────────────────────────────────────────
interface ButtonProps {
  title: string
  onPress: () => void
  variant?: "primary" | "secondary" | "danger"
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
  icon?: React.ReactNode
}

export function Button({ title, onPress, variant = "primary", loading, disabled, style, icon }: ButtonProps) {
  const variantStyle = {
    primary:   { bg: Colors.brand,   text: Colors.white },
    secondary: { bg: Colors.white,   text: Colors.brand },
    danger:    { bg: Colors.dangerBg, text: Colors.danger },
  }[variant]

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        styles.btnBase,
        { backgroundColor: variantStyle.bg, borderColor: Colors.border },
        variant === "secondary" && { borderWidth: 1 },
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.text} size="small" />
      ) : (
        <View style={styles.btnInner}>
          {icon}
          <Text style={[styles.btnText, { color: variantStyle.text }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ color = Colors.brand, size = "small" as "small" | "large" }: { color?: string; size?: "small" | "large" }) {
  return <ActivityIndicator color={color} size={size} />
}

// ─── Input ────────────────────────────────────────────────────────────────────
interface InputProps {
  label?: string
  error?: string
  placeholder?: string
  value?: string
  onChangeText?: (v: string) => void
  secureTextEntry?: boolean
  keyboardType?: any
  autoCapitalize?: any
  style?: ViewStyle
  rightElement?: React.ReactNode
}

export function Input({ label, error, style, rightElement, ...props }: InputProps) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputRow, error ? styles.inputError : null]}>
        <TextInput
          style={[styles.input, { flex: 1, borderWidth: 0 }, style]}
          placeholderTextColor={Colors.textMuted}
          {...props}
        />
        {rightElement && (
          <View style={styles.inputRight}>{rightElement}</View>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>
}

// ─── Badge ────────────────────────────────────────────────────────────────────
const ASSET_BADGE: Record<AssetStatus, { label: string; bg: string; color: string }> = {
  operativo:     { label: "Operativo",     bg: Colors.successBg, color: Colors.success },
  mantenimiento: { label: "Mantenimiento", bg: Colors.warningBg, color: Colors.warning },
  baja:          { label: "Baja",          bg: "#F3F4F6",        color: Colors.textSecondary },
  no_localizado: { label: "No localizado", bg: Colors.dangerBg,  color: Colors.danger },
}

const RESULT_BADGE: Record<AuditItemResult, { label: string; bg: string; color: string }> = {
  presente:     { label: "Encontrado",    bg: Colors.successBg, color: Colors.success        },
  faltante:     { label: "No encontrado", bg: Colors.dangerBg,  color: Colors.danger         },
  danado:       { label: "Dañado",        bg: Colors.warningBg, color: Colors.warning        },
  reubicado:    { label: "Reubicado",     bg: Colors.infoBg,    color: Colors.info           },
  no_accesible: { label: "No accesible",  bg: "#f3e8ff",        color: "#9333ea"             },
  no_aplica:    { label: "No aplica",     bg: "#F3F4F6",        color: Colors.textSecondary  },
  alerta:       { label: "Alerta",        bg: Colors.warningBg, color: Colors.warning        },
}

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  const s = ASSET_BADGE[status]
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: s.color, fontSize: FontSize.xs, fontWeight: "600" }}>{s.label}</Text>
    </View>
  )
}

export function AuditResultBadge({ result }: { result: AuditItemResult }) {
  const s = RESULT_BADGE[result]
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: s.color, fontSize: FontSize.xs, fontWeight: "600" }}>{s.label}</Text>
    </View>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────
export function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={{ fontSize: FontSize.xs, fontWeight: "600", color: Colors.textMuted,
      textTransform: "uppercase", letterSpacing: 0.6, marginBottom: Spacing.sm }}>
      {title}
    </Text>
  )
}

// ─── Divider ──────────────────────────────────────────────────────────────────
export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginVertical: Spacing.sm }} />
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  btnBase: {
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  btnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  btnText:  { fontSize: FontSize.base, fontWeight: "600" },
  label:      { fontSize: FontSize.sm, fontWeight: "500", color: Colors.textSecondary, marginBottom: 5 },
  inputRow:   {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    backgroundColor: Colors.white,
  },
  input:      {
    paddingHorizontal: Spacing.md, paddingVertical: 11, fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  inputRight: { paddingRight: Spacing.md, justifyContent: "center" },
  inputError: { borderColor: Colors.danger },
  errorText:  { fontSize: FontSize.xs, color: Colors.danger, marginTop: 3 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    padding: Spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
})
