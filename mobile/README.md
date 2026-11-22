# CashContour mobile development app

This iOS and Android app opens a branded welcome screen in the device's light or
dark appearance. It runs without a backend or local environment variables.

## Versions and layout

- Expo SDK 58 with Expo Router 58, React Native 0.88.1, and React 19.3.0.
  `package.json` declares the SDK-compatible ranges and `package-lock.json` records
  the exact installed versions. [Expo SDK 58](https://expo.dev/changelog/sdk-58)
- `src/app/` contains the Expo Router stack and welcome screen. `src/theme/` holds
  the light and dark CashContour colors. `assets/icon.png` is derived from the
  existing CashContour symbol and is used by the development launcher and welcome
  screen.
- `app.json` holds Expo configuration. The only EAS build profile in `eas.json`
  is `development`, an internal development-client profile.

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

If a later task needs environment variables, keep local overrides in
`mobile/.env.local` and use `EXPO_PUBLIC_*` only for values safe to ship in the
client, such as an approved test origin. Keep Google client secrets, database
credentials, and signing credentials out of the client and Git. Inspect the EAS
upload file list before the first authorized build because Expo can archive
files from the enclosing Git checkout. [Expo environment variables](https://docs.expo.dev/guides/environment-variables/) ·
[EAS upload exclusions](https://docs.expo.dev/build-reference/easignore/)

## Before Task 4B

- Confirm the development app IDs and select a nonce-capable Google native SDK
  compatible with the locked Expo stack.
- Create dedicated non-production Google OAuth credentials for the approved
  test environment, including the intended token audience. Register the iOS
  bundle identifier, OAuth client and reversed client-ID callback scheme. On
  Android, register the package and SHA-1 of the actual signing certificate.
- Arrange Apple development team and test-device provisioning for a signed iOS
  build. Arrange an Android signing key and a Google Play Services test device.
  Use signed development builds on both platforms for the Google verification.
- Select the non-production verifier or device-reachable HTTPS test origin and
  test accounts with fictional data. Verify fresh signed nonce, issuer,
  audience, subject, and cancellation behavior before selecting the integration.

See the [mobile implementation plan](../docs/MOBILE_IMPLEMENTATION_PLAN.md#2-isolate-the-expo-project-and-verify-google-on-devices)
for the device acceptance criteria.
