type GoogleClientIds = {
  webClientId: string;
  iosClientId: string | null;
};

export type GoogleSignInFailure = {
  status: "google-error";
  step: "checkPlayServices" | "configure" | "presentExplicitSignIn" | "proof";
  code: "DEVELOPER_ERROR" | "IN_PROGRESS" | "ONE_TAP_START_FAILED" | "UNKNOWN"
    | "CONFIG_PARAMS_BRIDGE" | "STRING_VARIANT_BRIDGE" | "NATIVE_LINKAGE"
    | "NATIVE_CONTEXT_UNAVAILABLE" | "ARGUMENT_CONVERSION" | "JS_TYPE_ERROR";
};

function classifyConfigureFailure(error: unknown): GoogleSignInFailure["code"] {
  if (!(error instanceof Error)) return "UNKNOWN";
  const message = error.message;
  // Return fixed categories because bridge exceptions can include argument values.
  if (message.includes("OneTapConfigureParams")) return "CONFIG_PARAMS_BRIDGE";
  if (message.includes("Variant_NullType_String")) return "STRING_VARIANT_BRIDGE";
  if (/NoSuch(?:Method|Field)Error|ClassNotFoundException|NoClassDefFoundError|UnsatisfiedLinkError/.test(message)) {
    return "NATIVE_LINKAGE";
  }
  if (message.includes("React Native context is not available yet.")) return "NATIVE_CONTEXT_UNAVAILABLE";
  if (/Cannot convert|cannot be converted|invalid argument type/i.test(message)) return "ARGUMENT_CONVERSION";
  return error instanceof TypeError ? "JS_TYPE_ERROR" : "UNKNOWN";
}

// Nitro creates its native object on import, so load it inside the dev-client flow.
const loadGoogleSignIn = () => import("react-native-nitro-google-signin").catch(() => null);

export async function requestGoogleIdToken(
  config: GoogleClientIds,
  nonce: string,
  loadNative = loadGoogleSignIn,
) {
  const native = await loadNative();
  if (!native) return { status: "native-unavailable" } as const;

  const { GoogleOneTapSignIn, isErrorWithCode, statusCodes } = native;
  let step: GoogleSignInFailure["step"] = "checkPlayServices";
  try {
    await GoogleOneTapSignIn.checkPlayServices(false);
    step = "configure";
    GoogleOneTapSignIn.configure({
      webClientId: config.webClientId,
      // Leave the unused iOS field out of Android's native configuration.
      ...(config.iosClientId === null ? {} : { iosClientId: config.iosClientId }),
      nonce,
    });
    step = "presentExplicitSignIn";
    const result = await GoogleOneTapSignIn.presentExplicitSignIn();
    if (result.type === "cancelled") return { status: "cancelled" } as const;
    if (result.type !== "success") return { status: "no-credential" } as const;

    // The native SDK may cache Google credentials. Clear its active session after the proof sign-in.
    try {
      await GoogleOneTapSignIn.signOut();
    } catch {
      return { status: "cleanup-error" } as const;
    }

    const idToken = result.data?.idToken;
    if (!idToken) return { status: "no-credential" } as const;
    return { status: "token", idToken } as const;
  } catch (error) {
    const code = isErrorWithCode(error) ? error.code : null;
    if (code === statusCodes.SIGN_IN_CANCELLED) return { status: "cancelled" } as const;
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { status: "play-services-unavailable" } as const;
    }
    const failure: GoogleSignInFailure = {
      status: "google-error",
      step,
      code: code === statusCodes.DEVELOPER_ERROR
        || code === statusCodes.IN_PROGRESS
        || code === statusCodes.ONE_TAP_START_FAILED
        ? code
        : step === "configure" ? classifyConfigureFailure(error) : "UNKNOWN",
    };
    return failure;
  }
}
