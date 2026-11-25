# CashContour mobile development app

This iOS and Android app opens a branded welcome screen in the device's light or
dark appearance. The welcome screen runs without a backend or local environment
variables. A signed development build can exercise native Google sign-in
against a dedicated test verifier.

## Versions and layout

- Expo SDK 58 with Expo Router 58, React Native 0.88.1, and React 19.3.0.
  `package.json` declares the SDK-compatible ranges and `package-lock.json` records
  the exact installed versions. [Expo SDK 58](https://expo.dev/changelog/sdk-58)
- `src/app/` contains the Expo Router stack and welcome screen. `src/theme/` holds
  the light and dark CashContour colors. `assets/icon.png` is derived from the
  existing CashContour symbol and is used by the development launcher and welcome
  screen.
- `app.json` holds the base Expo configuration. `app.config.js` adds optional
  Google proof configuration. The only EAS profile in `eas.json` is
  `development`, an internal development-client profile.

## Run locally

Use Node.js LTS (22.13 or newer) and npm. From the repository root:

```sh
cd mobile
npm ci
npm start -- --go
```

- **iPhone** — Install a version of Expo Go that supports SDK 58, join the same
  network as the computer, and open the QR code with the Camera app. To use the
  iOS Simulator, run on a Mac with Xcode installed and press `i` in the Expo CLI.
- **Android** — Install SDK 58-compatible Expo Go and scan the QR code from Expo
  Go, or launch an Android Studio emulator and press `a` in the Expo CLI.
- **Development client** — Once an authorized build is signed and installed, run
  `npm start -- --dev-client` from `mobile/` and open the QR code in that client.

The [Expo Go download page](https://expo.dev/go) lists supported SDK versions
and installation options. The [Expo CLI docs](https://docs.expo.dev/more/expo-cli/#launch-target)
describe the launch targets.

With the welcome screen open, switch the system appearance between light and
dark, check the title and text at a large system text size, and check that content
clears the notch and system bars on both platforms.

## Local checks

From `mobile/` after installing dependencies:

```sh
npm run lint
npm run typecheck
node --experimental-strip-types --test tests/google-proof-config.test.cjs tests/google-proof.test.cjs
npx expo config --type introspect
npx expo install --check
```

Expo's configuration introspection resolves plugins and native settings without
generating native projects. The dependency check compares package versions
against the selected SDK. If it offers to install changes, decline while
verifying an existing checkout.

## Isolation from the web project

Run Expo and mobile npm commands from `mobile/`. The directory has its own
package manifest, lockfile, `node_modules/`, TypeScript config, and ESLint
config. The root TypeScript and ESLint configs exclude `mobile/`. The repository
has no npm workspaces and uses Expo's standard Metro configuration. The
`@/` alias inside the app resolves to `mobile/src/`.

Node and Metro may search parent directories when a dependency is missing
locally. Declare each mobile runtime dependency in the mobile package and verify
resolution from there. The mobile manifest pins React DOM to the same version
as React because Expo Router's transitive packages require it as a peer. The
web app's dependencies, Prisma code, and Next.js modules belong to the root
application.

## Development configuration

The provisional development identifiers are `com.cashcontour.dev` for both
platforms and `cashcontour-dev` for the custom scheme. The display name is
**CashContour Dev**. Confirm these identifiers before registering credentials.
An EAS account with project access and an explicitly linked project are needed
to use the cloud development profile.

Keep local overrides in `mobile/.env.local`. Use `EXPO_PUBLIC_*` only for
values safe to ship in the client. Keep Google client secrets, database
credentials, signing keys, and private tokens out of the client and Git.
[Expo environment variables](https://docs.expo.dev/guides/environment-variables/)

### Inspect the EAS upload archive

Before every EAS cloud build, inspect an archive produced from the same checkout,
platform, and profile the build will use. The repository-root
[.easignore](../.easignore) overrides Git ignore rules for EAS. It limits the
upload to this standalone Expo package and excludes local inputs and generated
files. Git ignore status alone does not establish archive safety.
[Expo upload exclusions](https://docs.expo.dev/build-reference/easignore/) ·
[Expo project upload process](https://docs.expo.dev/build-reference/project-upload/)

From the repository root in PowerShell, use Node 22.13 or newer and an existing
EAS login. The output directory is created under the OS temporary directory.
The archive-stage command creates a local copy for inspection.

~~~powershell
Set-Location .\mobile
$easVersion = npm view eas-cli@latest version --silent
if ($LASTEXITCODE -ne 0 -or $easVersion -notmatch '^\d+\.\d+\.\d+$') { throw "Could not resolve the EAS CLI version." }
$easCli = "eas-cli@$easVersion"
$archive = Join-Path ([IO.Path]::GetTempPath()) ("cashcontour-eas-archive-" + [Guid]::NewGuid().ToString("N"))
npx $easCli build:inspect --platform android --stage archive --profile development --output $archive
if ($LASTEXITCODE -ne 0) { throw "EAS archive inspection failed." }
node ..\tools\check-eas-archive.mjs $archive
if ($LASTEXITCODE -ne 0) { throw "EAS archive safety check failed. Do not upload." }
~~~

The checker requires the app sources, assets, dependency manifests, lockfile,
and build configuration. It fails on unexpected paths, links, files that differ
from the checkout, known local secret values, and recognizable signing or
credential data. Review changes to its file list when adding a new build input.
Stop if inspection fails, and rerun from a fresh directory after any changes.
After inspection, remove only the generated directory at the exact
`$archive` path under the OS temporary directory. Keep the resolved
`$easCli` value for the eventual build so packaging uses the same CLI version.

The development profile uses EAS-managed signing credentials. Keep exported
backups in an access-restricted directory outside the entire Git repository.
Use either a BitLocker-protected volume or an AES-256 encrypted 7-Zip archive.
Store the password separately in a password manager and enter it at the
local prompt. For an archive, check that the keystore entry uses AES-256 and
compare its decrypted bytes with the original in memory before removing the
original. Any removal requires explicit approval.
[7-Zip encryption](https://www.7-zip.org/7z.html)

## Native Google sign-in proof

The proof pins `react-native-nitro-google-signin@2.3.1` and its native peer
`react-native-nitro-modules@0.37.2`. Nitro offers Android Credential Manager
and iOS Google Sign-In with a supplied nonce in the explicit sign-in flow.
Its Expo plugin supports Google Cloud configuration without Firebase files.
The locked stack meets the published npm peer ranges. The upstream compatibility
matrix bundled with Nitro Google Sign-In lists React Native through 0.87.
The [signed Android proof](#signed-android-verification) passed on 0.88.1.
Signed iOS verification is pending.

The maintained public `@react-native-google-signin/google-signin` package uses
the legacy Android SDK. Its licensed Universal Sign-In edition offers Android
Credential Manager and custom nonce support and remains an alternative if the
Nitro device proof fails. Keep the native auth choice provisional until both
signed builds pass. [Expo comparison](https://docs.expo.dev/guides/google-authentication/) ·
[Nitro setup and releases](https://github.com/react-native-nitro-google-sign-in/google-signin) ·
[Universal Sign-In nonce support](https://react-native-google-signin.github.io/docs/security)

### Google Cloud setup

In a dedicated non-production Google Cloud project, configure Google Auth
Platform branding and audience. For an External app in Testing, add the
dedicated Google accounts as test users. Keep those accounts separate from
real financial records. Create these OAuth clients in the same project.

| OAuth client | Required configuration |
| --- | --- |
| **Web application** | Copy its client ID to `EXPO_PUBLIC_GOOGLE_PROOF_WEB_CLIENT_ID`. This is the expected Google ID token audience on both platforms. The Android client ID serves only as the package/signature registration. |
| **Android** | Register the approved development package `com.cashcontour.dev` and the SHA-1 of the certificate that signs the APK actually installed. Create a separate Android registration for each supported package/signing-certificate combination. |
| **iOS** | Register the approved development bundle ID `com.cashcontour.dev`. Copy its client ID to `EXPO_PUBLIC_GOOGLE_PROOF_IOS_CLIENT_ID`. Expo derives the reverse URL scheme from this ID and registers it in the signed app. |

`com.cashcontour.dev` is syntactically suitable and already configured for both
platforms. Confirm that you control the identifier and that it is available
for your team before registering it. The existing web OAuth client and redirect
URI stay dedicated to the web application. [Google OAuth clients](https://support.google.com/cloud/answer/6158849) ·
[Android Credential Manager setup](https://developer.android.com/identity/sign-in/credential-manager-siwg-implementation) ·
[Google Sign-In for iOS](https://developers.google.com/identity/sign-in/ios/start-integrating)

Copy [`.env.example`](.env.example) to `.env.local` under `mobile/`. Fill in the
Web client ID and `EXPO_PUBLIC_GOOGLE_PROOF_VERIFIER_ORIGIN`, the approved
device-reachable non-production HTTPS origin. Use the origin alone with no
credentials, path, query, or fragment. Leave the iOS ID empty for an
Android-only proof. When building iOS through EAS, supply the iOS ID in the
EAS `development` environment as public configuration, and use the same value
in the local Metro environment. Rebuild the iOS app after changing that ID or
its callback scheme. The proof is disabled when its required
configuration is missing. [EAS environments](https://docs.expo.dev/eas/environment-variables/)

### Create a signed Android development build

1. Keep `com.cashcontour.dev` as the development package. Confirm the Expo
   project owner and project ID. After linking is approved, link the existing
   project from `mobile/` with `npx eas-cli@latest init --id <project-id>` and
   check it with `npx eas-cli@latest project:info`. Project creation needs
   separate approval if there is no existing project.
2. Confirm the signing certificate for the development APK. Inspect the
   existing Android keystore in EAS credentials, or obtain the SHA-1 with
   `keytool -list -v -keystore <path-to-development-keystore> -alias <alias>`.
   Obtain separate approval if a new credential is required. Register the
   package and this SHA-1 on the Android OAuth client. A later Play-installed
   build uses the **Play App Signing** certificate fingerprint.
3. Set up the development Web OAuth client and test users in
   [Google Cloud](#google-cloud-setup). Configure their verified subjects,
   audience, and allowed presenters in the
   [standalone verifier](../tools/google-proof-verifier/README.md). Set the
   verifier's HTTPS origin and the Web client ID in `mobile/.env.local`.
4. After the [fresh archive check](#inspect-the-eas-upload-archive) passes,
   confirm the remote signing certificate and available build quota. Once the
   cloud build is authorized, run the following from `mobile/` in the linked project.
   EAS normally sends fingerprint sources separately from the project archive.
   For this proof build, skip that upload so the local verifier settings stay
   out of fingerprint metadata. The build still uses the configured EAS
   development environment and produces an installable Android APK.
   [EAS fingerprint behavior](https://github.com/expo/eas-cli/blob/main/packages/eas-cli/src/build/build.ts#L853-L875)

   ~~~powershell
   $env:EAS_SKIP_AUTO_FINGERPRINT = "1"
   npx $easCli build --platform android --profile development
   ~~~

5. Run `apksigner verify --print-certs cashcontour-dev.apk` on the downloaded APK
   and compare its signer's SHA-1 with the Android OAuth client registration.
   Install the APK using the internal build link, or use
   `adb install cashcontour-dev.apk` on an enrolled USB-debuggable phone. Confirm
   that Google Play Services is current and that a dedicated test Google
   account is available. Start Metro from `mobile/` with
   `npm start -- --dev-client`. Open the QR code in the installed CashContour
   development client, then tap **Test Google sign-in**. Expo Go can still show
   the welcome screen.
6. Record whether the build compiles, the native Nitro module loads, and the
   verifier accepts a fresh sign-in using the locked Expo SDK 58.0.26,
   React Native 0.88.1, Nitro Google Sign-In 2.3.1, and Nitro Modules 0.37.2.
   Repeat after cancelling and check that the next attempt uses a new
   challenge. This is the device compatibility gate for the pinned versions.

A native config plugin disables Expo's development Network Inspector on both
platforms so request bodies are excluded from Metro network capture. The
development EAS profile also sets `EX_DEV_CLIENT_NETWORK_INSPECTOR=false` for
iOS pod installation. Use a freshly rebuilt development client from this
configuration. For builds using existing native directories, confirm
`EX_DEV_CLIENT_NETWORK_INSPECTOR=false` in Android's `gradle.properties` and
`"EX_DEV_CLIENT_NETWORK_INSPECTOR": "false"` in iOS's `Podfile.properties.json`.
The SDK 58 Podfile reads that property when the shell variable is unset. For a
custom iOS Podfile, set `EX_DEV_CLIENT_NETWORK_INSPECTOR=false` in the shell
before installing pods and rebuilding the client.

[EAS internal distribution](https://docs.expo.dev/build/internal-distribution/) ·
[Android APK signer](https://developer.android.com/tools/apksigner)

### Signed Android verification

On 2026-11-25, a physical Android device passed fresh Google sign-in, cancellation,
and a fresh sign-in after cancellation. The standalone verifier accepted the
signed proof on both successful attempts.

- **Signing variant** — Internal EAS `development` APK for `com.cashcontour.dev`
  with the EAS-managed development certificate. The verified signer matched the
  development Android OAuth registration.
- **Tested dependencies** — Expo SDK 58.0.26, React 19.3.0, React Native 0.88.1,
  Nitro Google Sign-In 2.3.1, and Nitro Modules 0.37.2. The signed APK was built
  from `4cea040` and loaded the Android proof configuration fix (`4887d58`)
  through Metro.
- **Automated checks** — All 14 proof tests and mobile typecheck passed. The
  existing `__dirname` lint error in `tests/google-proof-config.test.cjs`
  still blocks formal Android closure.

Signed iOS verification remains pending.

### Prepare for an iPhone test

Use an Apple development team with signing access and register the iPhone for
development or EAS internal provisioning. The signed app must use the approved
bundle ID and the OAuth client registered for it. The native configuration
uses the iOS client ID and the Web client ID as `serverClientID`. The config
plugin adds the `com.googleusercontent.apps.<ios-client-id-prefix>` callback
scheme. After separate approval for iOS signing and build, install the signed
development client on the registered device, start Metro in development-client
mode, and confirm that the Google callback returns to the app.

### Verify a signed nonce

Run the [standalone verifier](../tools/google-proof-verifier/README.md) behind
the approved test HTTPS origin. It exposes these endpoints independently of
CashContour's server routes and sends `Cache-Control: no-store`.

| Request | Successful response |
| --- | --- |
| `POST /google-proof/challenge` with `{}` | `200` JSON with a fresh opaque `challengeId` (16–128 URL-safe characters) and a `nonce` (32 cryptographically random bytes encoded as 64 lowercase hex characters). Record the challenge server-side with a short expiry. |
| `POST /google-proof/verify` with `{ "challengeId": "...", "idToken": "..." }` | `200` JSON `{ "verified": true }` only after all checks pass and the server atomically consumes the challenge. Reject invalid, expired, wrong-audience, wrong-nonce, or reused challenges with a non-success status. |

Use Google's maintained token verification library and keys to validate the
signature, issuer, intended Web client audience, and expiration. Verify the
presenter when present, compare the signed nonce to the issued challenge, and
verify the nonempty subject against an allowlisted test fixture. The future
CashContour exchange will resolve a verified subject to an existing account.
Use fictional test accounts. Keep tokens, nonce values, Google subjects, and
profile details out of logs, traces, and the verification response. Return the
issued nonce only in the challenge response.
Record the platform, dependency versions, signing variant, and pass/fail
outcomes only. [Google ID token verification](https://developers.google.com/identity/sign-in/ios/backend-auth) ·
[CashContour device acceptance criteria](../docs/MOBILE_IMPLEMENTATION_PLAN.md#2-isolate-the-expo-project-and-verify-google-on-devices)

- Verify a fresh sign-in, cancel an attempt, then sign in again and confirm a
  fresh challenge succeeds. Double-tap the proof button and confirm only one
  attempt starts. Check that a missing or unreachable verifier prevents the
  Google interaction from starting. Confirm that Expo Go shows only the welcome
  screen and that a non-development bundle hides the proof.
- In the verifier's test harness, confirm that submitting an already consumed
  challenge again fails. Submit mismatched-nonce and invalid-signature fixtures
  and confirm the verifier rejects them. Keep any real token in memory during
  these checks.
- If Android reports cancellation after account selection without dismissal,
  check the package name, actual APK signer SHA-1, and Web client ID. Credential
  Manager can report OAuth misconfiguration as cancellation.
- If the development screen reports a Google error, record only its diagnostic
  step and code. The diagnostic helps distinguish the Play Services check,
  native configuration, and the credential request. It omits provider messages
  and credentials.
- The proof library may cache Google credentials during the provider flow.
  The app calls the SDK's local sign-out after successful sign-in, keeps the ID
  token in memory for the verifier request, and displays only a fixed result.
  On Android, local sign-out clears the active SDK session but can leave
  encrypted profile metadata. Clear the development app's data to remove that
  cache or if credential cleanup fails.
