import { Redirect } from "expo-router"
import { useEffect, useState } from "react"
import * as SecureStore from "expo-secure-store"
import { View, ActivityIndicator } from "react-native"
import { Colors } from "@/theme"

export default function Index() {
  const [ready, setReady] = useState(false)
  const [hasToken, setHasToken] = useState(false)

  useEffect(() => {
    SecureStore.getItemAsync("access_token").then((token) => {
      setHasToken(!!token)
      setReady(true)
    })
  }, [])

  if (!ready) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.brand }}>
      <ActivityIndicator color={Colors.white} />
    </View>
  )

  return <Redirect href={hasToken ? "/(tabs)/home" : "/login"} />
}
