import { useEffect } from "react"
import { Stack } from "expo-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { useAuthStore } from "@/store/auth"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 0,            // siempre re-fetch al montar/volver a pantalla
      gcTime: 2 * 60 * 1000,  // mantener cache 2 min (era 5 min por defecto)
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    },
  },
})

export default function RootLayout() {
  const { fetchMe } = useAuthStore()

  useEffect(() => {
    // Pobla user state desde el servidor al arrancar
    fetchMe()
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
