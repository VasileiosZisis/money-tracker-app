import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { isRunningInExpoGo } from "expo";
import { useFonts } from "expo-font";
import { Image, ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GoogleSignInProof } from "@/components/google-sign-in-proof";
import { colors } from "@/theme/colors";

export default function WelcomeScreen() {
  const palette = colors[useColorScheme() === "dark" ? "dark" : "light"];
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_600SemiBold });
  const showGoogleProof = __DEV__ && !isRunningInExpoGo();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.intro}>
          <Image
            accessible={false}
            source={require("../../assets/icon.png")}
            style={styles.icon}
          />
          <Text
            accessibilityRole="header"
            style={[
              styles.title,
              { color: palette.foreground },
              fontsLoaded && styles.titleFont,
            ]}
          >
            CashContour
          </Text>
          <Text
            style={[
              styles.description,
              { color: palette.mutedForeground },
              fontsLoaded && styles.descriptionFont,
            ]}
          >
            This is the mobile development version.
          </Text>
          {showGoogleProof && <GoogleSignInProof palette={palette} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  intro: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
  },
  icon: {
    width: 80,
    height: 80,
    borderRadius: 22,
    marginBottom: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: "600",
    textAlign: "center",
  },
  titleFont: {
    fontFamily: "Inter_600SemiBold",
    fontWeight: "normal",
  },
  description: {
    marginTop: 10,
    fontSize: 16,
    textAlign: "center",
  },
  descriptionFont: {
    fontFamily: "Inter_400Regular",
  },
});
