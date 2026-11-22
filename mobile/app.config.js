const googleClientIdSuffix = ".apps.googleusercontent.com";
const productionHosts = ["cashcontour.com", "www.cashcontour.com"];

function readGoogleClientId(value) {
  const id = value?.trim();
  return id && /^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i.test(id) ? id : null;
}

function readVerifierOrigin(value) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.href === url.origin + "/" &&
      !productionHosts.includes(url.hostname.replace(/\.$/, ""))
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

module.exports = ({ config }) => {
  const webClientId = readGoogleClientId(process.env.EXPO_PUBLIC_GOOGLE_PROOF_WEB_CLIENT_ID);
  const iosClientId = readGoogleClientId(process.env.EXPO_PUBLIC_GOOGLE_PROOF_IOS_CLIENT_ID);
  const verifierOrigin = readVerifierOrigin(process.env.EXPO_PUBLIC_GOOGLE_PROOF_VERIFIER_ORIGIN);
  const plugins = [...(config.plugins ?? [])];

  if (iosClientId) {
    plugins.push([
      "react-native-nitro-google-signin",
      { iosUrlScheme: "com.googleusercontent.apps." + iosClientId.slice(0, -googleClientIdSuffix.length) },
    ]);
  }

  return {
    ...config,
    plugins,
    extra: { ...config.extra, googleProof: { webClientId, iosClientId, verifierOrigin } },
  };
};
