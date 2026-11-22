const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");
const { compileModsAsync, withStaticPlugin } = require("expo/config-plugins");
const appConfig = require("../app.config");

const variable = {
  web: "EXPO_PUBLIC_GOOGLE_PROOF_WEB_CLIENT_ID",
  ios: "EXPO_PUBLIC_GOOGLE_PROOF_IOS_CLIENT_ID",
  verifier: "EXPO_PUBLIC_GOOGLE_PROOF_VERIFIER_ORIGIN",
};
const webClientId = "12345-web.apps.googleusercontent.com";
const iosClientId = "12345-ios.apps.googleusercontent.com";
const testOrigin = "https://mobile-proof.example.test";
const baseConfig = require("../app.json").expo;
const basePlugins = baseConfig.plugins;

function resolveConfig(values) {
  const previous = Object.fromEntries(Object.values(variable).map((key) => [key, process.env[key]]));
  try {
    for (const [name, key] of Object.entries(variable)) {
      if (values[name] === undefined) delete process.env[key];
      else process.env[key] = values[name];
    }
    return appConfig({ config: { ...baseConfig, extra: { fixture: true } } });
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("unconfigured and Android-only installs resolve without an iOS plugin", () => {
  const unconfigured = resolveConfig({});
  assert.deepEqual(unconfigured.plugins, basePlugins);
  assert.deepEqual(unconfigured.extra.googleProof, {
    webClientId: null,
    iosClientId: null,
    verifierOrigin: null,
  });

  const android = resolveConfig({ web: webClientId, verifier: testOrigin + "/" });
  assert.deepEqual(android.plugins, basePlugins);
  assert.deepEqual(android.extra.googleProof, { webClientId, iosClientId: null, verifierOrigin: testOrigin });
});

test("the iOS plugin callback scheme is derived from the same client ID used by the app", () => {
  const config = resolveConfig({ web: webClientId, ios: iosClientId, verifier: testOrigin });
  assert.deepEqual(config.plugins, [
    ...basePlugins,
    ["react-native-nitro-google-signin", { iosUrlScheme: "com.googleusercontent.apps.12345-ios" }],
  ]);
  assert.equal(config.extra.googleProof.iosClientId, iosClientId);
  assert.equal(config.extra.fixture, true);
});

test("invalid client IDs are dropped independently of the verifier", () => {
  const config = resolveConfig({ web: "invalid", ios: "invalid", verifier: testOrigin });
  assert.deepEqual(config.plugins, basePlugins);
  assert.deepEqual(config.extra.googleProof, {
    webClientId: null,
    iosClientId: null,
    verifierOrigin: testOrigin,
  });
});

test("unsafe verifier origins are dropped independently of the client IDs", () => {
  for (const verifier of [
    "http://mobile-proof.example.test",
    "https://user:secret@mobile-proof.example.test",
    "https://mobile-proof.example.test/verify",
    "https://mobile-proof.example.test/?test=1",
    "https://mobile-proof.example.test/#test",
    "https://cashcontour.com",
    "https://www.cashcontour.com.",
  ]) {
    const config = resolveConfig({ web: webClientId, ios: iosClientId, verifier });
    assert.deepEqual(config.extra.googleProof, {
      webClientId,
      iosClientId,
      verifierOrigin: null,
    }, verifier);
  }
});

test("Expo disables request body inspection in both native development builds", async () => {
  const config = resolveConfig({});
  const plugin = config.plugins.find((name) => name === "./plugins/without-network-inspector.js");
  assert.ok(plugin);

  const projectRoot = path.resolve(__dirname, "..");
  const configured = withStaticPlugin(config, { plugin, projectRoot });
  const result = await compileModsAsync(configured, {
    projectRoot,
    introspect: true,
    platforms: ["android", "ios"],
  });
  const key = "EX_DEV_CLIENT_NETWORK_INSPECTOR";
  const { android, ios } = result._internal.modResults;

  assert.equal(android.gradleProperties.find((property) => property.key === key)?.value, "false");
  assert.equal(ios.podfileProperties[key], "false");
  assert.equal(require("../eas.json").build.development.env[key], "false");
});
