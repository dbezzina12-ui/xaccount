Repository copy of the native runtime art pack below. In this repository, omit the `dist/` prefix in runtime paths; the test is `presentation/vault-art.test.mjs`. Native source/evidence copies remain under `source-art/vault-perks/`.

# Return to Sender — five-light vault artwork and animation

2026-11-06, Codex. Implements the vault portion of Claude's 2026-11-07 01:29 UTC art brief at `97d8cf8`. Dylan approved the look in chat ("Nice"). Art preview only: the `perks` / `dld-six-8` engine and golden fixtures have not been handed off. No old variant or default route has been changed.

## Files

- `dist/art/night-mail/vault/vault-atlas.png`: original generated RGBA atlas, 1774×887, 1,702,116 bytes. Left square is the open housing and blank award plate; right square is the separate door. CSS selects each half without destructive image editing. SHA-256 `fe41940edc885aefda66682ed0aee12f5c4222c65664e767d33abb572a5dba3e`.
- `dist/presentation/vault.mjs`, `vault.css`: reusable presentation, five independent lamps, source-cell key flights, hinged reveal, runtime lettering, post-reveal award treatments.
- `dist/vault-preview.html`, `presentation/vault-preview.mjs`, `vault-preview.css`: isolated art fixture page. Explicit sample amounts; no RNG, bets, balance or session storage. Hold/Continue is an inspection control only.
- `tests/vault-art.test.mjs`: carried progress, multiple fills, missing/excess awards and treatment boundaries.
- `phone-reveal.jpg`: 390×844 viewport proof inside the responsive QA harness; sample +1,000× after prior demo increments. This is not a settled game result.

## Runtime contract for the perks presenter

Import `mountVault` from `presentation/vault.mjs` and load `vault.css`. Put the dock in bonus-only HUD space; do not cover Frank, the controller or the six-by-five board. The separate preview composition is not a replacement game layout.

```
const view = mountVault(host, {
  onReveal(value, {starting}) {
    // Update presentation from the matching engine event.
    // Starting values replace the displayed meter; regular reveals add to it.
    // Never debit, credit or calculate an authoritative outcome here.
  }
});
await view.ready;
view.setNotches(savedNotches);
await view.collect({
  sources: newlyLandedKeyTileElements,
  fromNotches: previousNotches,
  awards: engineRevealValuesInOrder,
  signal: currentSpinAbortSignal,
  quick: turboEnabled
});
await view.revealStarting(engineStartingValue, {signal});
// On unmount: view.destroy();
```

Supply **only newly landed keys** from the first board or the current refill. Never pass surviving keys again. One award is required per full group of five, including multiple fills in one event; incorrect event counts throw rather than inventing or dropping values. The component serializes fills and retains the remainder. The authoritative engine must provide event order and values; the presenter must checkpoint/resume them using the established replay flow before real integration.

Reveal timing: 240 ms focus, 200 ms latch movement, 280 ms door swing, 560 ms reading, 180 ms exit = 1.46 seconds, plus key flights (420 ms, 85 ms stagger). Turbo shortens the reveal. Reduced motion removes flight/door movement and retains a readable static award. Skip resolves to the supplied award once, restores controls and resets a completed ring. The value and celebration class are not put in the reveal DOM until the door is open. +1–24 uses the restrained treatment; +25–999 adds a bloom; +1,000 and above uses mint rays. Lost & Found uses the same door and shows a starting value without a plus sign.

## Verified

20 native presenter/ledger tests pass, including 3 new presentation-contract tests; existing engine outcomes remain unchanged. Studio framework build passes. Native, Studio source and built static bytes match for all six added runtime files. Chromium inspected at 390×844, 375×667 and 1366×768, with landscape 844×390 inspection/skip. Desktop fits the 768-pixel viewport. One-key progress persists; remaining keys complete the ring; +3 moves 5→8; +25 moves 5→30; +1,000 moves 5→1,005; Hidden opening replaces the sample meter with 25. Skip after a +25 sequence adds exactly 25 and leaves no overlay. The proof screenshot uses the explicit hold control; normal timings remain 1.46 seconds.

Not verified here: physical devices, audio, real `perks` event mapping, resumed settled gameplay or new math. Perk intro cards, markers and premium trigger effects from Claude's wider brief remain outstanding. Next owner: Claude supplies the fitted engine, event payload and goldens; Codex maps them into the presenter and completes in-game layout/QA. No production branch merge.

## Generation

Built-in image generation, with the existing gold/emerald KEY as style reference. Prompt: production two-cell transparent atlas, front-facing cartoon postal vault in dark teal enamel and antique brass, left cell open housing with blank cream/brass plaque and hinge sockets, right cell matching detached door with locking wheel, emerald hub, keyhole and subtle envelope emblem. Matched scale, crisp silhouettes and chunky bevels. No bulbs, numbers, labels, coins, background or loose particles. Runtime adds five lights and all numbers. Original generated image retained unchanged.
