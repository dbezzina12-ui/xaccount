# Served-asset verifier, validated against local fixtures

Base source `39f283ceb9a4958f0eb262780423216f95e45f3e`. New read-only checker: `tools/cyber-skunk-served-parity.mjs`. Production runtime, art, rig, math, catalogs and audio are unchanged; all 119 runtime files match Git (`source-audit.json`). No hosted artifact was contacted or republished in this batch.

The checker invokes the real artifact builder to derive the current **115 exported files**, then records SHA-256 and byte lengths. It additionally extracts static `?v=` references from runtime HTML/JS: **132 requests** in total on this source. This catches a stale versioned CSS response even when the bare URL is fresh. JavaScript must use `text/javascript` or `application/javascript`, CSS `text/css`, and SVG `image/svg+xml`; MIME parameters are allowed. Other file types receive byte checks. Expected hashes and version paths come from the local checkout, rather than a manually maintained file list.

From `slots/`, after publishing and identifying a directly fetchable asset root:

```sh
node tools/cyber-skunk-served-parity.mjs https://assets.example/game/ served-report.json
```

Use the actual asset directory, ending in `/`, with no credentials/query/fragment in that root argument. The checker supplies no API keys, cookie headers or login flow. Access walls and redirects stop the run with an incomplete failure. Keep the existing private audience. If the artifact service rewrites paths or requires an authenticated service-specific mapping, its owner must provide authorized served-response evidence; this generic direct-root checker cannot establish that integration by itself.

Exit **0** means every expected request passed bytes and required MIME checks; **1** means mismatched, missing, inaccessible or unchecked resources; **2** means setup/arguments/report writing failed. Uncommitted runtime changes cannot pass. Output contains relative asset paths, static cache keys, expected/actual hashes, HTTP status and counts. It omits target URLs, redirect locations, bodies and raw network errors. `expectedEntryFragmentSha256` is a local reference only: the hosted entry document/wrapper is **not verified**. Browser cache behavior, rendering, audio, devices and release sign-off remain separate gates.

## Validation

Five focused tests pass. Full core: **139 passed, three existing skips** (142 total). The prior 58-case browser result remains valid for unchanged runtime and was not repeated. Node 24.22.1; this checker needs only Node built-ins. The fresh clone initially lacked the repository's existing SDK dependency, so three core test files failed to import (`initial-core-dependencies.txt`). Installing declared dependencies with lifecycle scripts disabled restored the suite; no provider configuration or embedded chat activation changed.

| Local fixture | Result |
|---|---|
| Full current package | 115 assets / 132 requests pass |
| Stale `entry-shop.css?v=neon-ident-1`, fresh bare CSS | versioned request fails byte comparison |
| Missing `launch.js` | both bare/versioned requests fail with 404 |
| Correct module bytes, wrong MIME | requests fail despite matching hashes |
| 403, HTML login page, redirect | stop after at most four in-flight requests; unchecked remainder cannot pass |
| URL-bearing network error; dirty local runtime | failure reports omit raw error URL; dirty source performs no requests |

`cli-smoke.json` also records actual CLI exits: full clean fixture **0**, stale version fixture **1**. Missing-argument usage returns **2**. The negative cases are deliberately failed local fixtures, not live production failures; some use small subsets of the package. `clean.json` is local-fixture proof only, never evidence of the existing private artifact's served parity.

Reproduce the focused fixtures without contacting a hosted service:

```sh
CYBER_SKUNK_PARITY_EVIDENCE=/tmp/parity-fixtures node --test tests/cyber-skunk-served-parity.test.mjs
npm test
```

Claude's next step remains the preview sampler repair, then refreshed package hashes/frozen browser checks and republishing the existing artifact. Run this checker against the actual authorized asset root if supported, and separately prove the entry markup/current source, phone/desktop rendering, lobby, physical devices and owner sign-off before completion.
