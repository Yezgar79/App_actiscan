import { Stack } from "expo-router"
import { Colors } from "@/theme"

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.brand },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: "700", fontSize: 17 },
        headerBackTitle: "Atrás",
        contentStyle: { backgroundColor: Colors.bg },
      }}
    />
  )
}
