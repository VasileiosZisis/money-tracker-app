import Constants from "expo-constants";
import { fetch } from "expo/fetch";
import { useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { runGoogleProof, type GoogleProofConfig } from "@/auth/google-proof";
import { requestGoogleIdToken } from "@/auth/google-sign-in";
import { colors } from "@/theme/colors";

const feedback = {
  idle: "Use a dedicated test Google account.",
  running: "Waiting for Google and the test verifier.",
  verified: "The test verifier accepted the signed Google token and challenge.",
  cancelled: "Google sign-in was cancelled. You can try again.",
  "no-credential": "Google did not return an ID token. Check the test account on this device.",
  "native-unavailable": "Install a development build that includes native Google sign-in.",
  "play-services-unavailable": "Google Play Services is unavailable. Check for an update on this device.",
  "google-error": "Google sign-in could not finish. Check the development OAuth configuration.",
  "cleanup-error": "The native Google session could not be cleared. Restart or clear the development app before trying again.",
  "challenge-error": "The test verifier did not issue a valid challenge. Check its configuration and network access.",
  "verification-error": "The test verifier did not accept this attempt. Check its redacted diagnostics.",
};

export function GoogleSignInProof({ palette }: { palette: (typeof colors)[keyof typeof colors] }) {
  const [status, setStatus] = useState<keyof typeof feedback>("idle");
  const running = useRef(false);
  const settings = Constants.expoConfig?.extra?.googleProof as Partial<GoogleProofConfig> | undefined;
  const { webClientId, iosClientId, verifierOrigin } = settings ?? {};
  const config = webClientId && verifierOrigin && (Platform.OS === "android" || iosClientId)
    ? { webClientId, iosClientId: iosClientId ?? null, verifierOrigin }
    : null;
  const disabled = !config || status === "running" || status === "cleanup-error";

  async function handlePress() {
    if (!config || disabled || running.current) return;
    running.current = true;
    setStatus("running");
    try {
      setStatus(await runGoogleProof(config, { fetch, requestGoogleIdToken }));
    } catch {
      setStatus("google-error");
    } finally {
      running.current = false;
    }
  }

  return (
    <View style={styles.proof}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled, busy: status === "running" }}
        disabled={disabled}
        onPress={handlePress}
        style={[styles.button, { backgroundColor: palette.primary }, disabled && styles.disabled]}
      >
        <Text style={[styles.buttonLabel, { color: palette.primaryForeground }]}>
          Test Google sign-in
        </Text>
      </Pressable>
      <Text accessibilityLiveRegion="polite" style={[styles.feedback, { color: palette.mutedForeground }]}>
        {config ? feedback[status] : "Set up the development OAuth clients and HTTPS test verifier to run this proof."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  proof: {
    alignSelf: "stretch",
    marginTop: 28,
    gap: 12,
  },
  button: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  disabled: {
    opacity: 0.6,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  feedback: {
    fontSize: 14,
    textAlign: "center",
  },
});
