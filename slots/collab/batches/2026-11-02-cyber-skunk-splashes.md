# Cyber Skunk opening splashes and Mystery copy — 2026-11-02

Production inputs:

| File | Contract | Integration check |
|---|---|---|
| `games/cyber-skunk/art/ui/splash-desktop.png` | Exact 1920×1080 indexed PNG; lower 40% calm | Intro cards and PLAY remain readable at 1366×768 and 1920×1080; logo, mascot, trail and cabinet crop cleanly |
| `games/cyber-skunk/art/ui/splash-mobile.png` | Exact 1080×1920 indexed PNG; lower 45% calm | Intro cards and PLAY remain readable at 360×800, 390×844 and 430×932; no scroll or safe-area crop |

The deterministic source, hashes, luminance checks and review sheet are in `games/cyber-skunk/art/source/splash-v1/`. The images use approved production art only and contain no prices, rules, controls or outcomes. The flattened splash mascot does not replace the registered articulated v4.1 runtime rig.

The Mystery maintenance pass now names **Overpressure** and **Blackout Protocol** instead of generic Super/Hidden labels, and exposes the configured 40× minimum plus Blackout's 1,000× floor. Price, 90/10 tickets and all outcomes remain unchanged.

The real prep pipeline now emits `runtime/assets/ui/splash-{desktop,mobile}.webp`, and the intro selects them responsively through `styles.css?v=20`. The invisible live logo retains the layout/accessibility slot without drawing a second logo over the baked splash logo.

Validation on current source:

- art prep: 49/49 inputs, 16/16 registered mascot pieces, no problems;
- Cyber Skunk: 27/27;
- core: 127 pass, 3 existing rig-data skips;
- browser: not executed here because the Playwright Chromium download returned a zero-byte/truncated archive.

Exact next tasks for Claude:

1. Run the 25-test browser suite and verify the splash crop, single visible logo, cards, copy, controls, no scroll, first-open, close, focus restore, “don't show again” and reduced motion at 360×800, 390×844, 430×932, 1366×768 and 1920×1080.
2. On the three phone widths, measure `betPicker` at ≥44px, exercise BET and circular −/+, and confirm the Mystery pass shows Overpressure 90.00%, Blackout Protocol 10.00%, 40× minimum and Blackout 1,000× minimum without clipping.
3. Capture intro, ticket and controller evidence; rerun 27 game and 127 core tests; republish the existing private artifact and verify served-file/hash parity, including both splash WebPs and `styles.css?v=20`.
4. Return CS-06/CS-07 to done only after those checks. Do not claim this source revision is live before republish/parity succeeds.
