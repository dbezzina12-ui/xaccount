# Stake-limit pricing and cent-accounting QA — 2026-11-03

Base source: `3af617f7c2bcb8bb28d30a91294c0bde368ee6bf`, plus the `stake-prices-1` CSS patch. Node 24.22.1, Playwright 1.64.1, Chromium 153.0.8010.0. Desktop ticket stubs now use intrinsic price width: the longest values previously occupied 92.61px inside an 84px content area. Their new content width is 92.61px, preserving the font size and complete amount. CSS query and package hashes are refreshed. App logic, math, catalog, rig, audio and production art are unchanged.

**8/8 targeted browser cases pass.** The fixture discovers the current minimum/maximum from the real bet picker (10 and 10000 cents), reads prices from shipping `PLAY_OPTIONS`, and operates the real shop/confirmation UI. Desktop 1366×768 and touch phone 390×844 each check all five paid options at both limits: 20 rendered price combinations and 12 bonus confirmation/cancellation checks. Receipts show the correct base bet, multiplier, total and post-buy balance; cancellation does not debit credits. The appropriate shop −/+ boundary button is disabled.

| Option | Config cost | At $0.10 base bet | At $100 base bet |
|---|---:|---:|---:|
| Signal Boost | 3× | $0.30 | $300.00 |
| Spray Job | 10× | $1.00 | $1,000.00 |
| Vent Break | 100× | $10.00 | $10,000.00 |
| Overpressure | 250× | $25.00 | $25,000.00 |
| Mystery | 500× | $50.00 | $50,000.00 |

Four additional boundary cases cover Vent Break at each limit with exact credits and one cent less. Exact-credit receipts are confirmable and show `$0.00` remaining; they are cancelled. One-cent-short buttons are disabled and cannot open confirmation. These are confirmation/affordability checks, not purchases from an empty final wallet.

Two settlement cases buy the same positive-weight quiet shipping Vent Break row (seed 653812, 20 hundredths of the bet). At the minimum it costs 1000 cents and awards **2 cents**; at the maximum it costs 1000000 cents and awards **2000 cents**. Each yields exactly one matching history row and exact final balance. The expected award is required to be an integer before comparison, rather than rounded in the fixture. Presentation is fast-forwarded through guarded existing controls; the fixture waits for the ticket-tear confirmation transition before reading its fields.

The price/settlement pages use an isolated synthetic 100000000-cent wallet to cover the largest selectable buys. This changes no shipping balance or account. Boundary pages use the specified exact/short wallet values. Feature-spin debits at these limits, other bonus settlements, random rates, preview fidelity, physical devices and hosted parity are outside this batch.

`cases.json` contains all eight records; `browser-tests.txt` is the final eight-case run. Two existing shop regressions also pass (`browser-existing.txt`): **10 targeted browser passes**. Price-range probes at 360/390/430px portrait and 1366px desktop show all three high bonus prices fit with a 0.5px subpixel tolerance (`price-fit-before.json`, `price-fit-after.json`). `desktop-max-price.jpg` is the reviewed real browser frame. `runtime-delta.json` records the two changed runtime files (CSS and HTML); the other 117 still match the prior frozen audit.

Game tests: 29 passed. Core: 127 passed, three existing skips. Package: 115 files/39 detected static references/zero missing. Prior combined 36-case and targeted rare-keyboard results are historical evidence for their named sources; **no new combined 46-case pass** is claimed for this CSS follow-up. Preview sampling and hosted/device/sign-off gates remain open.

From `slots/`, with Playwright installed:

```sh
STUDIO_CHROMIUM_EXECUTABLE=/path/to/chromium node --test tests/browser/cyber-skunk-stakes.e2e.mjs
```

Set `CYBER_SKUNK_STAKE_EVIDENCE` to save JSON records. After a runtime change, run all five browser files with `node --test --test-concurrency=1 tests/browser/cyber-skunk*.e2e.mjs` and the same browser override when needed.
