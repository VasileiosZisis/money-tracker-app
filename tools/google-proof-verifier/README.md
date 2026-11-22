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
| `GOOGLE_PROOF_ALLOWED_SUBJECTS` | Required. Comma-separated, exact Google OIDC `sub` values for the dedicated test accounts. Use their verified subjects from an approved Google OIDC enrollment flow, such as a controlled local sign-in with the development Web client. Transfer only the verified subject directly into the server environment. Keep this list out of Git, the Expo bundle, and logs. |
| `GOOGLE_PROOF_PORT` | Optional. Loopback HTTP port, default `8787`. |

Google's library uses its public signing keys for this verification. The service
requires no OAuth client secret, service account key, or database credentials.
The tests use fixtures and mock Google's verifier. [Google backend verification](https://developers.google.com/identity/sign-in/web/backend-auth) ·
[Google OIDC claims](https://developers.google.com/identity/openid-connect/openid-connect)

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
