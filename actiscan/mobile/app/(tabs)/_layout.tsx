import { Tabs, Redirect } from "expo-router"
import { View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Colors } from "@/theme"
import { useAuthStore } from "@/store/auth"

type IoniconName = React.ComponentProps<typeof Ionicons>["name"]

function TabIcon({ outline, filled, focused }: { outline: IoniconName; filled: IoniconName; focused: boolean }) {
  return (
    <Ionicons
      name={focused ? filled : outline}
      size={22}
      color={focused ? Colors.brand : Colors.textMuted}
    />
  )
}

export default function TabsLayout() {
  const { user, initialized } = useAuthStore()
  const isAdmin = user?.role === "admin" || user?.role === "super_admin"

  // Si fetchMe ya corrió y no hay usuario válido → token expirado → ir a login
  if (initialized && !user) {
    return <Redirect href="/login" />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.brand,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
          paddingBottom: 8,
          height: 64,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Inicio",
          tabBarIcon: ({ focused }) => (
            <TabIcon outline="home-outline" filled="home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: "Inventario",
          tabBarIcon: ({ focused }) => (
            <TabIcon outline="cube-outline" filled="cube" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Escanear",
          tabBarIcon: ({ focused }) => (
            <View style={{
              width: 52, height: 52, borderRadius: 26,
              backgroundColor: focused ? Colors.brand : Colors.brandMid,
              alignItems: "center", justifyContent: "center",
              marginBottom: 16,
              shadowColor: Colors.brand,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4,
              shadowRadius: 8,
              elevation: 6,
            }}>
              <Ionicons name="qr-code" size={24} color={Colors.white} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="audits"
        options={{
          title: "Auditorías",
          tabBarIcon: ({ focused }) => (
            <TabIcon outline="clipboard-outline" filled="clipboard" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          tabBarButton: isAdmin ? undefined : () => null,
          tabBarIcon: ({ focused }) => (
            <TabIcon outline="shield-outline" filled="shield" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ focused }) => (
            <TabIcon outline="person-outline" filled="person" focused={focused} />
          ),
        }}
      />
    </Tabs>
  )
}
