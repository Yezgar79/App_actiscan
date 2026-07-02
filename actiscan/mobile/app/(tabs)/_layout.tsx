import { Tabs } from "expo-router"
import { View, Text } from "react-native"
import { Colors } from "@/theme"

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
    </View>
  )
}

export default function TabsLayout() {
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
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: "Inventario",
          tabBarIcon: ({ focused }) => <TabIcon emoji="📦" focused={focused} />,
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
              marginBottom: 16, shadowColor: Colors.brand,
              shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4,
              shadowRadius: 8, elevation: 6,
            }}>
              <Text style={{ fontSize: 22 }}>📷</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="audits"
        options={{
          title: "Auditorías",
          tabBarIcon: ({ focused }) => <TabIcon emoji="✅" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  )
}
