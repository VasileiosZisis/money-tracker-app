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

For Windows and enrolled test devices on the private tailnet, use this chain:

```text
Android → Tailscale Serve HTTPS :443 → Caddy HTTP 127.0.0.1:8789
        → verifier HTTP 127.0.0.1:8787
```

The development [Caddyfile](Caddyfile) binds IPv4 loopback, disables the admin
endpoint and automatic HTTPS, and forwards only the two exact POST targets.
Unknown paths, methods, query strings, and Funnel-marked requests received by
Caddy get a generic `404`. Tailscale Serve can discard malformed query
parameters before forwarding, so the exact request-target check applies at
Caddy's ingress. The proxy limits uploads to 12288 bytes and bounds header
size, client timeouts, and upstream wait times. It discards Caddy runtime logs and leaves access logging
off. It strips cookies, authorization, and Tailscale identity headers before
forwarding. Proxied responses, route rejections, and Caddy handler errors
carry `Cache-Control: no-store`. Keep HTTP tracing and request captures off.
The verifier must remain on port `8787` for this configuration. Allow it to
fetch Google's public signing keys over HTTPS and keep the host clock synced.
[Caddy global options](https://caddyserver.com/docs/caddyfile/options) ·
[Request body limits](https://caddyserver.com/docs/caddyfile/directives/request_body) ·
[Caddy error handling](https://caddyserver.com/docs/caddyfile/directives/handle_errors) ·
[Tailscale Serve proxy source](https://github.com/tailscale/tailscale/blob/v1.104.7/ipn/ipnlocal/serve.go)

The challenge store and rate counters live in process memory. Restarting the
service drops challenges and resets counters, so testers should start over if
the service restarts. Keep exactly one replica and one Node process. Multiple
workers or replicas would have separate challenge state and separate limits.

### Check tailnet access

In Administrator PowerShell, inspect the existing state before activating
Serve. If `tailscale` is unavailable on PATH, run
`& "$env:ProgramFiles\Tailscale\tailscale.exe"` with the same arguments.

```powershell
tailscale serve status
tailscale funnel status
```

Confirm the node's HTTPS port `443` is free of existing Serve or TCP mappings
and that Funnel is inactive on this node. The Caddy Funnel marker check is an
additional safeguard. If either status check fails, have the
tailnet owner resolve it before starting the proof. Existing services should
stay in place until their owner approves a change.

In **Access controls** in the Tailscale admin console, review effective
permissions to the Windows host on `tcp:443`. Allow that connection from the
approved test devices using their Tailscale IPs or device-specific selectors.
Review every matching grant and ACL, including defaults and wildcards,
group or owner-wide access, and any device shares. Grants are additive, so a
narrow rule still leaves broader matching permissions in effect. Use the
policy editor's tests or preview to check an approved device can connect
and an unapproved device is denied. Have the tailnet owner make any needed
policy edits before activation. [Grants and matching](https://tailscale.com/docs/features/access-control/grants/grants-explained) ·
[Device selectors](https://tailscale.com/docs/reference/targets-and-selectors) ·
[Policy tests](https://tailscale.com/docs/reference/syntax/policy-file#tests)

### Validate and launch on Windows

From the repository root in PowerShell, validate with a current Caddy 2 release.
Validation loads and provisions the configuration without starting the proxy.

```powershell
Set-Location .\tools\google-proof-verifier
caddy validate --config .\Caddyfile --adapter caddyfile
```

Once startup is approved, run Caddy in the foreground from the same directory:

```powershell
caddy run --config .\Caddyfile --adapter caddyfile
```

Use the full executable path with PowerShell's `&` operator for either Caddy
command if `caddy.exe` was installed outside PATH. The proxy is quiet because
its runtime logs are discarded. Keep the verifier and Caddy
running in separate terminals. Then open a separate **Administrator
PowerShell** terminal and run Serve in the foreground:

```powershell
tailscale serve --https=443 http://127.0.0.1:8789
```

Copy the `https://…ts.net` origin printed under **Available within your
tailnet**. In another terminal, run `tailscale serve status` and
`tailscale funnel status` again. Confirm the HTTPS root maps to
`http://127.0.0.1:8789`, is marked tailnet-only, and has no Funnel exposure.
Set the verified origin alone in `EXPO_PUBLIC_GOOGLE_PROOF_VERIFIER_ORIGIN` in
the ignored `mobile/.env.local`, with no endpoint suffix or query string.
[Caddy command line](https://caddyserver.com/docs/command-line) ·
[Tailscale Serve CLI](https://tailscale.com/docs/reference/tailscale-cli/serve) ·
[Tailscale Funnel status](https://tailscale.com/docs/reference/tailscale-cli/funnel#get-the-status)

### Check connectivity with fictional requests

After integration testing is approved, use a separate **PowerShell 7**
terminal. The probes below print only an HTTP status and a cache-control
check. Finish the local probes before sending requests through Serve.

```powershell
$listeners = @(Get-NetTCPConnection -State Listen -LocalPort 8789 -ErrorAction SilentlyContinue)
$listeners | Select-Object LocalAddress, LocalPort, OwningProcess
if ($listeners.Count -ne 1 -or $listeners[0].LocalAddress -ne '127.0.0.1') {
  throw 'Expected exactly one listener on 127.0.0.1:8789.'
}

function Test-ProofProxy {
  param([string]$Name, [string]$Uri, [string]$Method, [int]$ExpectedStatus, [string]$Body, [hashtable]$Headers)
  $options = @{
    Uri = $Uri
    Method = $Method
    NoProxy = $true
    TimeoutSec = 25
    MaximumRedirection = 0
    SkipHttpErrorCheck = $true
    ErrorAction = 'Stop'
  }
  if ($PSBoundParameters.ContainsKey('Body')) {
    $options.Body = $Body
    $options.ContentType = 'application/json'
  }
  if ($Headers) { $options.Headers = $Headers }
  try {
    $reply = Invoke-WebRequest @options
  } catch {
    throw "Probe '$Name' failed to obtain an HTTP response."
  }
  $status = [int]$reply.StatusCode
  $noStore = ($reply.Headers['Cache-Control'] -join ',') -match '(^|,)\s*no-store\s*(,|$)'
  [pscustomobject]@{ Probe = $Name; Status = $status; NoStore = $noStore }
  if ($status -ne $ExpectedStatus -or -not $noStore) {
    throw "Probe '$Name' returned an unexpected status or cache policy."
  }
}

$localProofProxy = 'http://127.0.0.1:8789'
Test-ProofProxy Challenge "$localProofProxy/google-proof/challenge" POST 200 '{}'
Test-ProofProxy VerifyFixture "$localProofProxy/google-proof/verify" POST 401 '{"challengeId":"fictional-challenge-id","idToken":"abc.def.ghi"}'
Test-ProofProxy UnknownPath "$localProofProxy/other" POST 404 '{}'
Test-ProofProxy WrongMethod "$localProofProxy/google-proof/challenge" GET 404
Test-ProofProxy QueryString "$localProofProxy/google-proof/challenge?probe=fixture" POST 404 '{}'
Test-ProofProxy TrailingSlash "$localProofProxy/google-proof/challenge/" POST 404 '{}'
Test-ProofProxy FunnelMarker "$localProofProxy/google-proof/challenge" POST 404 '{}' @{ 'Tailscale-Funnel-Request' = '?1' }
$atLimit = '{}' + (' ' * 12286)
Test-ProofProxy ExactLimit "$localProofProxy/google-proof/challenge" POST 200 $atLimit
Test-ProofProxy OverLimit "$localProofProxy/google-proof/challenge" POST 413 ($atLimit + ' ')
```

The limit probes send a declared content length. The Caddy body reader also
caps requests streamed without one. During an approved failure test with the
verifier stopped and Caddy still running, the same challenge probe should
return `502` with `NoStore` true. Bring the verifier back before continuing.

To check the private HTTPS route from PowerShell on an approved device, use
the same probe function and the origin reported by Serve:

```powershell
$tailnetProofOrigin = (Read-Host 'Private Serve HTTPS origin').TrimEnd('/')
if ($tailnetProofOrigin -notmatch '^https://[a-z0-9.-]+\.ts\.net$') {
  throw 'Enter only the HTTPS origin reported by Serve.'
}
Test-ProofProxy TailnetChallenge "$tailnetProofOrigin/google-proof/challenge" POST 200 '{}'
Test-ProofProxy TailnetQuery "$tailnetProofOrigin/google-proof/challenge?probe=fixture" POST 404 '{}'
```

On the enrolled Android phone, keep Tailscale connected and open the HTTPS
origin with `/google-proof/challenge` appended in Chrome. The browser sends a
GET, so the expected result is **Proof route unavailable.** over trusted
HTTPS. A certificate warning or connection error is a failed reachability
check. This is the phone's TLS and reachability check. The signed development
app will exercise the Android POST flow in the later device verification.

### Stop the proof proxy

Press **Ctrl+C** in the Serve terminal first. Confirm with
`tailscale serve status` and `tailscale funnel status` that this mapping is
gone. If it remains and the status confirms it is this proof mapping, remove
it from Administrator PowerShell:

```powershell
tailscale serve --https=443 http://127.0.0.1:8789 off
```

Then press **Ctrl+C** in the Caddy terminal. Run the status commands again to
check the proof mapping is gone. Before requesting an Android build, confirm
the allowlist and private HTTPS checks pass and retain the
[signed Android build checklist](../../mobile/README.md#create-a-signed-android-development-build).

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
