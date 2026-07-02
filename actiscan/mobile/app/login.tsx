import { useState } from "react"
import {
  View, Text, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, Alert
} from "react-native"
import { useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useAuthStore } from "@/store/auth"
import { Input, Button } from "@/components/ui"
import { Colors, Spacing, Radius, FontSize } from "@/theme"

const schema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
})

type FormData = z.infer<typeof schema>

export default function LoginScreen() {
  const router = useRouter()
  const { login, loading } = useAuthStore()
  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      await login(data.email, data.password)
      router.replace("/(tabs)/home")
    } catch {
      Alert.alert("Error de acceso", "Correo o contraseña incorrectos")
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoBox}>
              <Text style={styles.logoIcon}>📦</Text>
            </View>
            <Text style={styles.title}>ActiScan</Text>
            <Text style={styles.subtitle}>Gestión de activos con QR</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.formTitle}>Iniciar sesión</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Correo electrónico"
                  placeholder="usuario@empresa.mx"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={value}
                  onChangeText={onChange}
                  error={errors.email?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Contraseña"
                  placeholder="••••••••"
                  secureTextEntry
                  value={value}
                  onChangeText={onChange}
                  error={errors.password?.message}
                />
              )}
            />
            <Button
              title="Iniciar sesión"
              onPress={handleSubmit(onSubmit)}
              loading={loading}
              style={{ marginTop: Spacing.sm }}
            />
            <View style={styles.securityNote}>
              <Text style={styles.securityText}>🔒 Sesión protegida con JWT y SSL</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.brand },
  scroll:   { flexGrow: 1, justifyContent: "center", padding: Spacing.xl },
  header:   { alignItems: "center", marginBottom: Spacing.xxl },
  logoBox:  {
    width: 72, height: 72, backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: Radius.xl, alignItems: "center", justifyContent: "center", marginBottom: Spacing.lg,
  },
  logoIcon:   { fontSize: 32 },
  title:      { fontSize: FontSize.xxl, fontWeight: "700", color: Colors.white, marginBottom: 4 },
  subtitle:   { fontSize: FontSize.sm, color: "rgba(255,255,255,0.6)" },
  form:       {
    backgroundColor: Colors.white, borderRadius: Radius.xl,
    padding: Spacing.xl, shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 5,
  },
  formTitle:    { fontSize: FontSize.lg, fontWeight: "600", color: Colors.textPrimary, marginBottom: Spacing.lg },
  securityNote: { alignItems: "center", marginTop: Spacing.lg },
  securityText: { fontSize: FontSize.xs, color: Colors.textMuted },
})
