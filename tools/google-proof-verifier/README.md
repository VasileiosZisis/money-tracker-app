# CashContour development Google proof verifier

This standalone Node.js service verifies ID tokens for the signed-device proof
in the [mobile app](../../mobile/README.md#native-google-sign-in-proof). It
returns a proof result and has no CashContour account, session, or database
integration.

## Configuration

Use Node.js LTS 22.13 or newer. Run these commands from this directory. Use only
the development Google Cloud project and dedicated test Google accounts.

```sh
npm ci --ignore-scripts
npm test
```

Set the following values in the service environment. For local configuration,
copy [`.env.example`](.env.example) to the ignored `.env.local` and populate it
using the same values. Start the service with `npm start` if the runtime
provides the variables, or with `node --env-file=.env.local server.mjs`.

| Variable | Value |
| --- | --- |
| `GOOGLE_PROOF_AUDIENCE` | Required. The dedicated development **Web application** OAuth client ID. It must match `EXPO_PUBLIC_GOOGLE_PROOF_WEB_CLIENT_ID` on the phone. |
| `GOOGLE_PROOF_ALLOWED_PRESENTERS` | Required. Comma-separated, exact development OAuth client IDs allowed as `azp` when the claim is present. Include the dedicated Web ID and the approved platform clients used for the proof. |
| `GOOGLE_PROOF_ALLOWED_SUBJECTS` | Required when running the verifier. Comma-separated, exact Google OIDC `sub` values for the dedicated test accounts. The [local enrollment utility](#enroll-a-test-account-on-windows) can populate it. Keep this list out of Git, the Expo bundle, and logs. |
| `GOOGLE_PROOF_PORT` | Optional. Loopback HTTP port, default `8787`. |

Google's library uses its public signing keys for this verification. The service
requires no OAuth client secret, service account key, or database credentials.
The tests use fixtures and mock Google's verifier. [Google backend verification](https://developers.google.com/identity/sign-in/web/backend-auth) ·
[Google OIDC claims](https://developers.google.com/identity/openid-connect/openid-connect)

## Enroll a test account on Windows

In the dedicated development project, open **Google Auth Platform → Clients**
and edit the **Web application** client used as `GOOGLE_PROOF_AUDIENCE`. Add
this exact entry to **Authorized redirect URIs** and save it.

```text
http://127.0.0.1:8788/google-proof/enrollment/callback
```

If the project's audience is **External** and its publishing status is
**Testing**, add the dedicated Google account to **Test users**. Use the Web
client's own client secret for the local code exchange.
[Google Web server OAuth setup](https://developers.google.com/identity/protocols/oauth2/web-server) ·
[Google OIDC reference](https://developers.google.com/identity/openid-connect/reference)

From the repository root, use an interactive Windows PowerShell terminal with
Node.js 22.13 or newer. Install from the existing lockfile first if dependencies
are missing, then prepare the verifier's own local environment file.

```powershell
Set-Location .\tools\google-proof-verifier
if (-not (Test-Path -LiteralPath .\node_modules\google-auth-library\package.json)) {
  npm ci --ignore-scripts
  if ($LASTEXITCODE -ne 0) { throw 'Verifier dependency installation failed.' }
}
if (-not (Test-Path -LiteralPath .\.env.local)) {
  Copy-Item -LiteralPath .\.env.example -Destination .\.env.local
}
notepad .\.env.local
```

Set `GOOGLE_PROOF_AUDIENCE` to the dedicated Web client ID. Set
`GOOGLE_PROOF_ALLOWED_PRESENTERS` to a comma-separated list of the same Web ID
and the approved native client IDs. Leave `GOOGLE_PROOF_ALLOWED_SUBJECTS`
empty for the first enrollment or keep its existing entries. Save and close
the editor. Keep the verifier configuration separate from `mobile/.env.local`.

When ready to start the local callback and Google sign-in, run the following in
the same terminal. The masked prompt keeps the Web client secret out of
PowerShell command history. The temporary environment variable is removed on
exit, and the utility removes its copy from the environment before launching
the browser.

```powershell
$secret = Read-Host 'Development Web OAuth client secret' -AsSecureString
try {
  $env:GOOGLE_PROOF_ENROLLMENT_CLIENT_SECRET = [System.Net.NetworkCredential]::new('', $secret).Password
  node .\enroll.mjs
} finally {
  Remove-Item Env:GOOGLE_PROOF_ENROLLMENT_CLIENT_SECRET -ErrorAction SilentlyContinue
  $secret.Dispose()
  Remove-Variable secret
}
```

1. In the terminal, enter the intended test account's email. In the browser,
   select that Google account. The callback accepts one state-matched form
   POST on loopback. The code exchange uses S256 PKCE and requests online
   access with only `openid email`.
2. Return to the terminal. The utility verifies the ID token and checks the
   signed nonce, audience, issuer, expiry, Web presenter when present, and
   verified email. Type `ENROLL` only after confirming this is the dedicated
   test account.
3. The utility appends the verified `sub` to
   `GOOGLE_PROOF_ALLOWED_SUBJECTS` in the ignored verifier `.env.local`.
   It preserves existing entries, skips duplicates, and leaves the subject
   out of terminal and browser output. Use a separate run for each test
   account.

Use `Ctrl+C` to cancel if you close the browser tab. The callback stops after
one accepted result, cancellation, or a five-minute timeout. Keep the secret
out of local env files, mobile configuration, EAS, and Git. After enrollment,
the verifier itself uses only Google's public signing keys.

Enrollment serializes allowlist updates. If an interrupted process leaves
`.env.local.enrollment-lock` behind, confirm that no enrollment is running
before removing the lock and trying again.

## Dedicated HTTPS origin

1. Run one Node process on an approved non-production host. Put a TLS reverse
   proxy on the same host in front of `127.0.0.1:8787` or the configured
   loopback port. Use a dedicated hostname and a certificate trusted by the
   test phones. Allow outbound HTTPS to Google's public signing-key endpoint and
   keep the host clock synchronized.
2. Restrict the HTTPS listener to enrolled devices on a private tester network
   or VPN, or to an approved tester egress IP allowlist. Only forward the two
   exact POST paths below. Keep the loopback port private and configure the
   proxy's request body limit to at most 12 KiB. Serve the endpoints directly
   over HTTPS without redirects or a browser login page in the request path.
3. Exclude request and response bodies, headers, and query strings from proxy,
   application, tracing, and error reporting logs for these routes. Keep the
   verifier process and its environment separate from production and avoid
   proxy caching. Give the phones only the approved HTTPS origin and their
   public OAuth client IDs via [the Expo configuration](../../mobile/README.md#google-cloud-setup).

The challenge store and rate counters live in process memory. Restarting the
service drops challenges and resets counters, so testers should start over if
the service restarts. Keep exactly one replica and one Node process. Multiple
workers or replicas would have separate challenge state and separate limits.

## HTTP contract

Both endpoints take UTF-8 JSON. All responses carry `Cache-Control: no-store`.

| Endpoint | Request | Success |
| --- | --- | --- |
| `POST /google-proof/challenge` | `{}` | `200` with a random `challengeId` and a random 64-character lowercase hex `nonce`, valid for five minutes. |
| `POST /google-proof/verify` | `{ "challengeId": "...", "idToken": "..." }` | `200` with `{ "verified": true }` after verification and single-use challenge consumption. |

Google verifies the signature against its keys. The verifier enforces the
issuer, dedicated Web audience, current expiration, signed nonce, allowlisted
subject, and any presented `azp`. Invalid claims, invalid signatures, expired
challenges, and reused challenges get a generic `401`. Successful verification
consumes the challenge in a synchronous check-and-delete in the same process.
Concurrent successful attempts for one challenge yield at most one success.

The service rejects malformed bodies with `400`, bodies over 12 KiB with
`413`, and unsupported media types or compression with `415`. It rate-limits
the entire instance to 20 challenge requests and 30 verification requests per
one-minute window. A `429` includes `Retry-After`. If 80 challenges are live or
eight Google verifications are in flight, the corresponding endpoint returns
`503` while saturated. Limits apply to all testers behind the same proxy.

The phone sends the ID token directly over HTTPS, and the service only passes
it to the local Google library for verification. Only the challenge response
returns the issued nonce. Record result categories and device/build details
when collecting evidence. A retry after a lost response should start with a new
challenge.
