# Disposable PostgreSQL verification

Task 5D.3B.3A prepares this procedure and the integration harness. Task
5D.3B.3A.1 confirms root lint, typecheck, all 331 offline regression tests,
and the Git diff check on reviewed commit `3d3d7a7`. Each live stage
requires separate authorization and a reviewed, disposable target.
Use a direct local PostgreSQL 17 instance for B and C. The production server
version and intended transaction pooler remain unconfirmed. Keep
MOBILE_AUTH_API_ENABLED unset throughout. The only migration copies used
are the SQL files already committed in this repository.

| Stage | Scope |
| --- | --- |
| 5D.3B.3B | PostgreSQL 17 direct connection. Empty history replay, upgrade over fictional web data, mobile executor, session lifecycle and distributed rate limits |
| 5D.3B.3C | Independent web schema, Prisma 7.10.1 adapter and web feature verification |
| 5D.3B.3D | Separately approved disposable transaction-mode pooler using the intended topology, with independent direct observation |

## Task 5D.3B.3B results

The authorized direct PostgreSQL run passed on `mobile-dev` at
`c1da8031eb4c21ae829cb77764308facc99e798a`. The harness matched
`3d3d7a7`. The fixture used PostgreSQL 17.12 from the pinned Linux amd64
image below, on Docker Engine 29.9.3, exposed only at `127.0.0.1:55437`.
The bootstrap confirmed the fixture marker and system identifier through
the container socket. The runner attested the database, role, server
major version, encrypted connection and instance identity, then took
the stage advisory lock. Trusted TLS succeeded. The untrusted CA and
hostname mismatch tests returned certificate-specific errors.

| Command, run once | Result |
| --- | --- |
| `npm run test:postgres-fixture -- migrate fresh` | Passed TLS preflight, empty-schema check, replay of all 12 committed migrations, and catalog assertions. |
| `npm run test:postgres-fixture -- migrate upgrade` | Passed TLS preflight, web migration replay and fictional data seed, both mobile migrations, and catalog and data assertions. |
| `npm run test:postgres-fixture -- mobile upgrade` | **33 passed, 0 failed**. Two preflight, 19 executor, and 12 authentication and rate-limit cases. |

The catalog checks covered the expected tables, keys, indexes, mobile
constraints and initialized capacity singleton. The two replays checked
`numeric(14,2)` for transactions, planned bills, planned income and
balance adjustments. The upgrade preserved one fictional expense of
`999999999999.99` exactly, with its date, user ownership, account
subject, USD currency, UTC time zone, category and legacy `Tag` /
`tagId` relationship.

- **Executor** Confirmed commit and rollback, connection dispositions and
  reuse, `SET LOCAL` reset, exhaustion and admission limits, and late
  checkout disposal before `BEGIN`. Each exercised failure in the
  executor fault group asserted one disposition. The tests do not
  explicitly assert discard versus release for each of those faults.
  Statement and lock timeouts
  reported SQLSTATE `57014` and `55P03` in their cases. Delayed startup,
  callback deadlines, active backend interruption, failed terminal
  commands and an unexpected `ROLLBACK` tag reached the expected
  failure assertions. Independent observations checked committed state,
  transaction and lock clearance within the eight-second cleanup window,
  pool recovery, and a later commit that survived a separate rollback.
- **Authentication** Challenge consumption was exclusive under
  concurrent exchange. Exact Google subject matching, verified unlinked
  consumption, and rollback on session insertion failure passed. The
  concurrent unlink and deletion cases removed the row before exchange
  could lock it. The reverse order remains unverified. Concurrent
  refresh rotated once and
  committed replay revocation without revoking another device or user.
  Replay preceded the saturated budget check. Failed rotation rolled back
  its budget admission. Both refresh/logout orders observed a database
  lock wait. With the session lock held until database-clock expiry,
  rotation was rejected without an admission. That expiry case did not
  separately sample the rotating backend's wait state.
- **Rate limits and cleanup** Five of eight challenge admissions
  succeeded across concurrent pairs. The source and challenge admission
  rows were committed before the synthetic Google certificate lookup.
  Two requests competed for the last of 10,000 slots, with exactly one
  allocation. Concurrent cleanup removed 200 expired buckets and left
  the capacity ledger equal to the persisted bucket count. The active
  challenge bucket count matched the accepted race outcome. Exact row
  retention for a preseeded active bucket was outside this assertion.
  Authentication cleanup respected its batch bounds and user deletion
  cascaded to sessions and refresh credentials.

Teardown rechecked the fixture labels and resource IDs before removal.
The container, network, and private temporary directory were verified
absent. Port 55437 had no remaining listener and the fixture process
cleared its credentials and environment variables. The pinned image
remains local.

Direct SQL replay leaves Prisma migration-history bookkeeping open.
The instrumented fixture pool leaves the production mobile pool open.
The withheld COMMIT and the withheld result after an independently
observed commit exercise different database outcomes at the driver
boundary. Packet-level interruption and lost network acknowledgements
remain open. This run used synthetic Google keys and service-level
authentication. The intended pooler, deployed runtime, actual ingress,
and live Google integration remain unverified. Both migrations remain
unapplied to application databases, and the mobile API stays disabled.

## Task 5D.3B.3C results

The web-only run passed on `mobile-dev` at
`3cabaf5042d138b69e6ba2d1ec80c953878991f2`, with the harness unchanged
from `3d3d7a7`. Manifest, lockfile and installed Prisma CLI, client and
PostgreSQL adapter versions matched at 7.10.1. The generated client was
7.10.1. The installed and locked pg and pg-pool were 8.20.0 and 3.13.0.

A new fixture used the pinned image below on Docker Engine 29.9.3
at `npipe:////./pipe/dockerDesktopLinuxEngine`. It ran PostgreSQL 17.12
with one web-stage database, a distinct role and instance marker, and a
new private CA. Connections used `127.0.0.1:55437`, verified the CA and
IP identity, and matched the role, database, system identifier, marker and
server major version. Both stages obtained the advisory lock. Both
rejected an untrusted CA and mismatched name.

| Command, run once | Result |
| --- | --- |
| `npm run test:postgres-fixture -- migrate web` | Passed TLS and replay of the ten committed web migrations through `20260817120000_add_user_time_zone`. The catalog matched only the expected web tables, excluding all five mobile tables. |
| `npm run test:postgres-fixture -- web web` | **11 passed, 0 failed**. Two preflight cases, three production-style cases and six small-pool experiments. |

The migration runner replayed direct SQL into an empty schema and then
seeded the fictional web data. It verified web keys and indexes, four
`numeric(14,2)` column definitions, and the seed's exact
`999999999999.99` expense, user, linked account subject, date, currency,
time zone, category and legacy `Tag`/`tagId` mapping. Both mobile
migrations were excluded. Prisma migration-history bookkeeping was
outside this run.

- **Web persistence** The actual NextAuth v4 adapter correctly linked a
  fictional Google account and created, retrieved and deleted its
  session. The category detail action added a subcategory backed by
  `Tag`. Planned bill and income handling generated the expected
  expense and income with their category and subcategory associations.
  Undo removed the generated transactions.
- **CSV and decimals** Preview left the fixture user's transaction count
  at zero. Confirmation wrote the two scoped amounts `999999999999.99`
  and `0.01`, and the first row retained its subcategory. Prisma Decimal
  addition and independent PostgreSQL `SUM` both returned exactly
  `1000000000000.00`.
- **Production-style pool defaults** Batch creation committed. A failed
  batch rejected with `P2002`, rolled back its attempted insert and
  preserved both earlier records. Ten occupied leases caused an
  eleventh transaction to reject with Prisma startup timeout `P2028`.
  After releasing the holders, the observer confirmed pool recovery
  and an independent commit.
- **Small-pool experiments** The delayed start returned `P2028`, completed
  at the adapter after the deadline and invoked no application callback.
  The observer confirmed backend cleanup and safe subsequent work.
  Statement and lock timeout scenarios, the deferred constraint at COMMIT,
  withheld result after real commit, and backend termination during a
  rollback attempt passed. Independent observations confirmed absent
  writes after rejected terminal SQL and a durable write before the
  simulated acknowledgement loss. Later writes committed and survived
  separate rollbacks. Observed transactions, locks, waiters and
  checked-out clients cleared within the eight-second window.

The application cases use a guarded injected pool and one synthetic
identity. The results cover category updates with the existing name and
generated-transaction undo. Category renaming, undo of linked transactions,
cross-user denial, non-UTC date boundaries, live Google and browser
sessions remain outside this evidence. The CSV post-confirmation
checks query the acting user's rows and assert both amounts and the
first subcategory. They do not assert full persisted row details or
look for writes outside that user. The non-startup fault cases require a rejected operation and
check database state and pool recovery. They do not match the exact
SQLSTATE for each failure or prove that recovery used the same physical
backend. The simulated acknowledgement loss acts at the adapter boundary.
Packet-level loss and exact deployed pool behavior remain open.

Teardown verified the fixture labels before removing the container and
network. The exact temporary directory, container, network and port
listener were confirmed absent. Fixture credentials were cleared and
the pinned image was retained. The independent main-based release
candidate, its pooler/runtime verification and its deployment require
separate authorization. Keep the mobile API disabled.

## Available local infrastructure

Docker Desktop 4.100.1 is running on the WSL 2 `docker-desktop` backend.
The Windows CLI is installed at
`%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe`.
The current context is `desktop-linux` at
`npipe:////./pipe/dockerDesktopLinuxEngine`. The client is
29.9.3 on Windows amd64 and the reachable server is 29.9.3 on Linux amd64.
Neither a local listener nor an active TCP connection used port 55437 at
discovery time. The port was outside the Windows TCP exclusion ranges
for both IPv4 and IPv6. Recheck it at provisioning.

Use Windows PowerShell and the explicit CLI path. This keeps the existing
Windows bind mount and teardown commands usable with the WSL 2 backend.
The product owner pulled the official `docker.io/library/postgres:17-bookworm`
image. Local inspection confirmed the tag and immutable reference resolve
to the same Linux amd64 image:

```text
docker.io/library/postgres@sha256:1eff563f6c868b9b433566e9f3cf6e5c79fbd3b95bf70ec7277d376cdbfc50d7
```

Approve this exact digest before creating the fixture. The Git for Windows
MinGW OpenSSL 3.2.3 executable was available during Task 5D.3B.3A.
[Docker Desktop WSL 2 backend](https://docs.docker.com/desktop/features/wsl/)
[Official PostgreSQL image](https://hub.docker.com/_/postgres)

If Docker is unavailable, separately approve official PostgreSQL 17
Windows binaries and a new isolated cluster. A native fixture must use a
private temporary data directory, explicit host and port, the dedicated
CA, the same role and marker, and a known process for scoped stop and
removal. Do not use an existing PostgreSQL service or persistent database.
[PostgreSQL Windows distribution options](https://www.postgresql.org/download/windows/)

## Provisioning after approval

Use a fresh PowerShell session at the repository root with the installed
Node.js and npm dependencies. Do not load application dotenv files or
export application secrets. Run each block sequentially and stop on the
first failure. If provisioning fails partway, use the cleanup procedure on
the resources already verified and created. A mutable image tag is used
only to discover a digest. Approve the digest before running it.
[Docker PostgreSQL image](https://hub.docker.com/_/postgres)
[Docker port publishing](https://docs.docker.com/engine/network/port-publishing/)

~~~powershell
$ErrorActionPreference = 'Stop'
$docker = (Get-Command docker.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1).Source
if (!$docker) {
  $docker = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'
}
if (!(Test-Path -LiteralPath $docker -PathType Leaf)) { throw 'Set the verified absolute path to docker.exe.' }
if (Test-Path Env:DOCKER_HOST) { throw 'Use an explicit local Docker context.' }
if (Test-Path Env:DOCKER_CONTEXT) { throw 'Use an explicit local Docker context.' }
& $docker --version
if ($LASTEXITCODE -ne 0) { throw 'Docker CLI unavailable.' }
$context = & $docker context show
if ($LASTEXITCODE -ne 0) { throw 'Cannot identify the Docker context.' }
$endpoint = & $docker context inspect --format '{{.Endpoints.docker.Host}}' $context
if ($LASTEXITCODE -ne 0) { throw 'Cannot identify the Docker endpoint.' }
if ($endpoint -notmatch '^npipe:/{4}\./pipe/(dockerDesktopLinuxEngine|docker_engine)$') {
  throw 'The approved local Windows named-pipe endpoint was not confirmed.'
}
function Invoke-Docker {
  & $docker --host $endpoint @args
  if ($LASTEXITCODE -ne 0) { throw 'Docker command failed. Stop and verify the fixture.' }
}
$engine = Invoke-Docker version --format '{{.Server.Os}} {{.Server.Version}}'
if ($engine -notmatch '^linux (\d+)\.') { throw 'A local Linux Docker engine is required.' }
if ([int]$Matches[1] -lt 28) { throw 'Docker Engine 28 or newer is required for this loopback-only procedure.' }
Invoke-Docker image ls --filter 'reference=postgres*' --format '{{.Repository}}:{{.Tag}} {{.ID}}'
# Only with separate approval if the image is absent:
# Invoke-Docker pull docker.io/library/postgres:17-bookworm
Invoke-Docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' postgres:17-bookworm
~~~

Set the approved digest and select the databases for the stage. For B use
fresh and upgrade. For C use web alone on its own instance. Confirm port
55437 is idle before creating the fixture. The random run ID determines
all names. The temporary directory carries only fixture-owned files and
must inherit a private ACL for the current user. The application role
receives no superuser, role creation or database creation privilege.
The bootstrap administrator is available only over the container's Unix
socket. [PostgreSQL TLS files and permissions](https://www.postgresql.org/docs/17/ssl-tcp.html)

~~~powershell
$image = 'postgres@sha256:REPLACE_WITH_APPROVED_64_HEX_DIGEST'
$stages = @('fresh', 'upgrade') # For C use @('web') on a separate fixture.
if ($image -notmatch '^(docker\.io/library/)?postgres@sha256:[0-9a-f]{64}$') {
  throw 'Set a reviewed official PostgreSQL image digest.'
}
$portInUse = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object LocalPort -eq 55437
if ($portInUse) { throw 'Fixture port 55437 is occupied.' }

$openssl = 'C:\Program Files\Git\mingw64\bin\openssl.exe'
function Invoke-OpenSSL {
  & $openssl @args
  if ($LASTEXITCODE -ne 0) { throw 'Fixture certificate generation failed.' }
}
function New-FixtureHex {
  $result = node -p "require('node:crypto').randomBytes(32).toString('hex')"
  if ($LASTEXITCODE -ne 0 -or $result -cnotmatch '^[0-9a-f]{64}$') {
    throw 'Fixture value generation failed.'
  }
  $result
}
function Write-FixtureFile($path, $body) {
  [IO.File]::WriteAllText($path, $body.Replace([string][char]13, ''))
}

$runId = [guid]::NewGuid().ToString('N')
$marker = New-FixtureHex
$password = New-FixtureHex
$bootstrapPassword = New-FixtureHex
$role = "cc_pgtest_role_$runId"
$tmp = node -p "require('node:fs').realpathSync(require('node:os').tmpdir())"
if ($LASTEXITCODE -ne 0 -or ![IO.Path]::IsPathRooted($tmp)) { throw 'Cannot resolve fixture root.' }
$root = Join-Path $tmp "cashcontour-pg17-$runId"
$mount = Join-Path $root 'container'
New-Item -ItemType Directory -Path $root | Out-Null
$ownerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$systemSid = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
$acl = Get-Acl -LiteralPath $root
$acl.SetAccessRuleProtection($true, $false)
foreach ($sid in @($ownerSid, $systemSid)) {
  $rule = [Security.AccessControl.FileSystemAccessRule]::new(
    $sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'
  )
  $acl.AddAccessRule($rule)
}
Set-Acl -LiteralPath $root -AclObject $acl
New-Item -ItemType Directory -Path $mount | Out-Null

$ca = Join-Path $root 'ca.crt'
$caKey = Join-Path $root 'ca.key'
$serverKey = Join-Path $mount 'server.key'
$serverCrt = Join-Path $mount 'server.crt'
$request = Join-Path $root 'server.csr'
$extensions = Join-Path $root 'leaf.ext'
Invoke-OpenSSL req -x509 -newkey rsa:2048 -nodes -sha256 -days 2 -subj '/CN=CashContour disposable fixture CA' -addext 'basicConstraints=critical,CA:TRUE' -addext 'keyUsage=critical,keyCertSign,cRLSign' -keyout $caKey -out $ca
Invoke-OpenSSL req -new -newkey rsa:2048 -nodes -subj '/CN=CashContour disposable fixture' -keyout $serverKey -out $request
Write-FixtureFile $extensions @'
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=IP:127.0.0.1
'@
Invoke-OpenSSL x509 -req -sha256 -days 2 -in $request -CA $ca -CAkey $caKey -CAserial (Join-Path $root 'ca.srl') -CAcreateserial -extfile $extensions -out $serverCrt
Invoke-OpenSSL verify -CAfile $ca -verify_ip '127.0.0.1' $serverCrt

$nl = [string][char]10
Write-FixtureFile (Join-Path $mount 'bootstrap.pass') ($bootstrapPassword + $nl)
Write-FixtureFile (Join-Path $mount 'pg_hba.conf') ((@(
  'local all cc_pgtest_bootstrap trust'
  "hostssl all $role 0.0.0.0/0 scram-sha-256"
) -join $nl) + $nl)
Write-FixtureFile (Join-Path $mount 'entrypoint.sh') @'
#!/bin/bash
set -eu
install -d -o postgres -g postgres -m 700 /run/cc-fixture
install -o postgres -g postgres -m 600 /fixture/server.key /run/cc-fixture/server.key
install -o postgres -g postgres -m 644 /fixture/server.crt /run/cc-fixture/server.crt
exec docker-entrypoint.sh postgres "$@"
'@

$networkId = Invoke-Docker network create --driver bridge --label "cashcontour.fixture=$runId" "cc-pg17-net-$runId"
$containerId = Invoke-Docker create --pull=never --name "cc-pg17-$runId" --label "cashcontour.fixture=$runId" --network $networkId --publish '127.0.0.1:55437:5432' --tmpfs '/var/lib/postgresql/data:rw,noexec,nosuid,size=512m' --mount "type=bind,source=$mount,target=/fixture,readonly" --env 'POSTGRES_USER=cc_pgtest_bootstrap' --env 'POSTGRES_PASSWORD_FILE=/fixture/bootstrap.pass' --env 'POSTGRES_DB=postgres' --entrypoint /bin/bash $image /fixture/entrypoint.sh -c 'ssl=on' -c 'ssl_cert_file=/run/cc-fixture/server.crt' -c 'ssl_key_file=/run/cc-fixture/server.key' -c 'hba_file=/fixture/pg_hba.conf' -c "cashcontour.fixture_marker=$marker" -c 'timezone=UTC' -c 'password_encryption=scram-sha-256'
if ($containerId -cnotmatch '^[0-9a-f]{64}$' -or $networkId -cnotmatch '^[0-9a-f]{64}$') {
  throw 'Could not confirm fixture resource IDs.'
}
if ((Invoke-Docker inspect --type container --format '{{index .Config.Labels "cashcontour.fixture"}}' $containerId) -cne $runId -or
    (Invoke-Docker network inspect --format '{{index .Labels "cashcontour.fixture"}}' $networkId) -cne $runId) {
  throw 'Container or network identity did not match.'
}
Invoke-Docker start $containerId | Out-Null
if ((Invoke-Docker port $containerId '5432/tcp') -cne '127.0.0.1:55437') {
  throw 'Fixture port is not bound to the approved loopback endpoint.'
}
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  & $docker --host $endpoint exec $containerId pg_isready -h 127.0.0.1 -p 5432 -q -t 1 2>$null
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep -Milliseconds 500
}
if (!$ready) { throw 'Fixture startup deadline exceeded.' }
$identity = (Invoke-Docker exec $containerId psql -XAt -U cc_pgtest_bootstrap -d postgres -c "SELECT current_setting('cashcontour.fixture_marker', true), (pg_catalog.pg_control_system()).system_identifier") -split '\|'
if ($identity.Count -ne 2 -or $identity[0] -cne $marker -or $identity[1] -cnotmatch '^[1-9][0-9]{8,19}$') {
  throw 'Disposable instance identity did not match.'
}

$bootstrap = @("CREATE ROLE $role LOGIN PASSWORD '$password' NOSUPERUSER NOCREATEDB NOCREATEROLE;")
foreach ($stage in $stages) {
  if ($stage -cnotin @('fresh', 'upgrade', 'web')) { throw 'Unexpected fixture stage.' }
  $dbName = "cc_pgtest_$($runId)_$stage"
  $bootstrap += "CREATE DATABASE $dbName OWNER $role;"
  $bootstrap += "\connect $dbName"
  $bootstrap += "GRANT EXECUTE ON FUNCTION pg_catalog.pg_control_system() TO $role;"
}
Write-FixtureFile (Join-Path $mount 'bootstrap.sql') (($bootstrap -join $nl) + $nl)
& $docker --host $endpoint exec $containerId psql -Xq -v ON_ERROR_STOP=1 -U cc_pgtest_bootstrap -d postgres -f /fixture/bootstrap.sql *> $null
if ($LASTEXITCODE -ne 0) { throw 'Fixture bootstrap failed. Tear down the identified instance.' }

$manifest = Join-Path $root 'manifest.json'
$manifestData = @{
  runId = $runId
  marker = $marker
  systemIdentifier = $identity[1]
  caSha256 = (Get-FileHash -LiteralPath $ca -Algorithm SHA256).Hash.ToLowerInvariant()
}
Write-FixtureFile $manifest ($manifestData | ConvertTo-Json -Compress)
$env:CASHCONTOUR_PG_TEST = 'local-disposable'
$env:CASHCONTOUR_PG_TEST_MANIFEST = $manifest
function Select-FixtureStage($stage) {
  if ($stage -cnotin $stages) { throw 'The stage was not provisioned on this fixture.' }
  $dbName = "cc_pgtest_$($runId)_$stage"
  $rootCert = [Uri]::EscapeDataString($ca)
  $env:CASHCONTOUR_PG_TEST_URL = "postgresql://$($role):$($password)@127.0.0.1:55437/$($dbName)?sslmode=verify-full&sslrootcert=$rootCert"
}
~~~

The runner requires the exact stage-specific role, database and port, and
rejects ambient PostgreSQL and application database variables. It accepts
only verify-full and the hashed, private fixture CA. It passes verified CA
bytes and explicit numeric-IP certificate identity checking to pg. Before
SQL work, each physical connection checks encrypted transport, PostgreSQL
major version, database, role, system identifier and the separate marker.
A session advisory lock covers each entire invocation. Each migration run
also requires a blank public schema. The TLS preflight uses the same local
endpoint for verified TLS, untrusted CA rejection and certificate name
mismatch. Unsupported DSN options are covered offline.
[node-postgres TLS options](https://node-postgres.com/features/ssl)

## Execute the approved stage

The runner applies the committed SQL verbatim and verifies the catalog.
It bypasses application Prisma CLI configuration and leaves out Prisma
migration bookkeeping. Prisma migration-history verification remains a
separate gate. For upgrade and web, it uses the reviewed cutoff
immediately before the mobile changes. The upgrade inserts fictional
Google account and financial rows before applying both mobile migrations.
It checks their ownership, currency, UTC time zone, exact decimal amounts
and legacy Tag and tagId relationships alongside the mobile catalog.
Provision a new fixture after an inconclusive or failed mutation. Save
the sanitized case output, then tear down the old fixture. Do not retry
ambiguous transactions.

Task 5D.3B.3B commands, after approving the specific local instance and the
bounded test faults on it.

~~~powershell
Select-FixtureStage fresh
npm run test:postgres-fixture -- migrate fresh
if ($LASTEXITCODE -ne 0) { throw 'Empty migration verification failed.' }
Select-FixtureStage upgrade
npm run test:postgres-fixture -- migrate upgrade
if ($LASTEXITCODE -ne 0) { throw 'Upgrade migration verification failed.' }
npm run test:postgres-fixture -- mobile upgrade
if ($LASTEXITCODE -ne 0) { throw 'Mobile integration verification failed.' }
~~~

Task 5D.3B.3C commands for the separately approved, exclusively web fixture.

~~~powershell
Select-FixtureStage web
npm run test:postgres-fixture -- migrate web
if ($LASTEXITCODE -ne 0) { throw 'Web schema verification failed.' }
npm run test:postgres-fixture -- web web
if ($LASTEXITCODE -ne 0) { throw 'Web Prisma verification failed.' }
~~~

The mobile suite exercises the real executor, auth services and registered
SQL through an instrumented fixture pool. The production mobile pool,
including its connection configuration and behavior under load, still
requires separate verification. Cases include confirmed commit and
rollback, exhaustion and late
acquisition, initialization and statement faults, commit and rollback
disposition, challenge and refresh races, replay before budget admission,
both refresh and logout lock orders, expiry, bounded maintenance, and
concurrent capacity allocation. Google tokens are signed by a generated
in-memory fixture key and certificate responses come from an in-process
stub. Route-level ordering remains covered offline while the API is disabled.

The web suite uses the actual client and adapter. Production-style pool
defaults exercise normal interactive and batch work, saturation, NextAuth,
category subcategories, planned bills and income, and preview/confirm CSV
with exact cents. The separate small-pool experiments exercise startup
timeouts and late startup, statement and lock faults, terminal failure,
interruption and recoverability. A main-based web release candidate and any
deployment require their own review and authorization.

## Cleanup evidence and transport limitations

Use an independent observer for each case. Allow up to eight seconds
after the terminal or deadline outcome for affected PIDs to disappear or
return to idle with no transaction timestamp or relevant locks. Check the
waiting queue is empty and the pool accounts for every client as idle or
disposed. Assert independent durable writes and a separate rollback. The
runner has per-case deadlines and a nine-minute suite deadline. Failed
attestation, unconfirmed cleanup, unexpected callback execution or
indeterminate database state fails the gate.

The real server can reject COMMIT and terminate a fixture-owned backend.
The test driver separately withholds a terminal command and withholds
delivery after an observer has seen the real commit. Those barriers prove
the two database outcomes and handler behavior at the driver boundary.
Deterministic packet-level interruption during COMMIT or ROLLBACK and a
lost network acknowledgement remain separate cases. They require
separately reviewed local transport controls with a way to identify the
exact terminal delivery phase while preserving verified TLS and the
independent observer. A harness-only error injection is evidence at the
delivery boundary.

## Teardown after any authorized live run

Use resource IDs from the current session. Inspect their fixture labels
again before removal. If a resource was never created, skip its branch.
If an ID or label fails validation, stop and reconcile the recorded
fixture identity. Never prune or remove arbitrary containers, networks or
volumes. Verify the exact resolved temporary path before recursive removal.

~~~powershell
if ($runId -cnotmatch '^[0-9a-f]{32}$') { throw 'Invalid teardown identity.' }
if ($containerId) {
  if ($containerId -cnotmatch '^[0-9a-f]{64}$' -or
      (Invoke-Docker inspect --type container --format '{{index .Config.Labels "cashcontour.fixture"}}' $containerId) -cne $runId) {
    throw 'Container teardown identity mismatch.'
  }
  Invoke-Docker rm --force --volumes $containerId
}
if ($networkId) {
  if ($networkId -cnotmatch '^[0-9a-f]{64}$' -or
      (Invoke-Docker network inspect --format '{{index .Labels "cashcontour.fixture"}}' $networkId) -cne $runId) {
    throw 'Network teardown identity mismatch.'
  }
  Invoke-Docker network rm $networkId
}
if ($root -and (Test-Path -LiteralPath $root -PathType Container)) {
  $expected = Join-Path $tmp "cashcontour-pg17-$runId"
  $actual = (Resolve-Path -LiteralPath $root).Path
  $entry = Get-Item -LiteralPath $actual -Force
  if ($actual -cne $expected -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw 'Fixture directory teardown identity mismatch.'
  }
  Remove-Item -LiteralPath $actual -Recurse -Force
}
Remove-Item -LiteralPath Env:CASHCONTOUR_PG_TEST,Env:CASHCONTOUR_PG_TEST_MANIFEST,Env:CASHCONTOUR_PG_TEST_URL -ErrorAction SilentlyContinue
Remove-Variable password,bootstrapPassword,bootstrap,marker -ErrorAction SilentlyContinue
~~~

## Transaction-mode pooler acceptance for Task 5D.3B.3D

Separately approve a disposable transaction-mode pooler and a direct
observer path that attest the same fixture. The direct runner intentionally
requires its local database endpoint. A pooler runner needs its own target
contract and reviewed correlation with the backend. Record server, pooler
and driver versions and the configured frontend and backend limits.

| Case | Required evidence |
| --- | --- |
| TLS | Approved CA and verified identity for the pooler endpoint and any separate direct observer. Untrusted CA and wrong endpoint name fail closed. Record pooler-to-server TLS configuration separately. |
| Transaction-local timeouts | Observe the expected settings inside the active transaction. A subsequent transaction on a reused backend observes its defaults, with no leaked request settings. |
| Acquisition limits and timeout interaction | Hold approved leases to capacity and compare peak frontends, queued acquisitions and backend counts to configured limits. Vary application, driver, pooler and PostgreSQL deadlines one at a time and record which boundary fired. |
| Termination and cleanup | Correlate a frontend checkout with the backend PID during its transaction. Disconnect during a blocked statement and terminal handling. Within eight seconds the independent observer sees no stranded transaction or lock. |
| Commit ambiguity and safe reuse | Observe absent writes when COMMIT was withheld and durable writes when the acknowledgement was lost. Demonstrate independent commit and subsequent rollback after disposal and reuse. |
| Mobile and web compatibility | Repeat the relevant mobile lock-order and limiter races, Prisma late startup, and normal web transactions independently. Check that shared records, exact data and resource counts are consistent after each case. |

Keep the API disabled and both production and shared-preview migrations
unapplied throughout. The database, pooler, intended runtime and deployment
gates stay open until their corresponding real verification passes.
