import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";

import { colors } from "@/theme/colors";

export default function RootLayout() {
  const theme = useColorScheme() === "dark" ? "dark" : "light";

  return (
    <>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ contentStyle: { backgroundColor: colors[theme].background } }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
