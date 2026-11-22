type GoogleClientIds = {
  webClientId: string;
  iosClientId: string | null;
};

export async function requestGoogleIdToken(config: GoogleClientIds, nonce: string) {
  // Nitro creates its native object on import, so load it inside the dev-client flow.
  const native = await import("react-native-nitro-google-signin").catch(() => null);
  if (!native) return { status: "native-unavailable" } as const;

  const { GoogleOneTapSignIn, isErrorWithCode, statusCodes } = native;
  try {
    await GoogleOneTapSignIn.checkPlayServices(false);
    GoogleOneTapSignIn.configure({
      webClientId: config.webClientId,
      iosClientId: config.iosClientId,
      nonce,
    });
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
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return { status: "cancelled" } as const;
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { status: "play-services-unavailable" } as const;
      }
    }
    return { status: "google-error" } as const;
  }
}
