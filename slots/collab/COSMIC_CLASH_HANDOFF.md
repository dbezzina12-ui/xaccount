# Cosmic Clash math redesign

The game lives in `slots/games/cosmic-clash/` on `codex/cosmic-clash`. The source baseline is `715774486fc6b7aafbdf18566162d558bfabc6cf`. Run the commands below from the game directory.

## Dylan’s decisions for Claude

- Keep exactly three bonus tiers: Showdown (Regular), Last Stand (Super), and God Mode (Hidden). Use the highest comparable reference tier for God Mode. Omit reference-only bonus rows.
- Every Mystery Buy awards a complete bonus. Use 20% Showdown, 70% Last Stand and 10% God Mode. The baseline currently implements 40% / 50% / 10% at 250×. Update the runtime selection, tests, reports and player-facing copy together.
- Compare all paid modes with the supplied menu, using total paid price for profit chance and one complete paid round for maximum-win frequency. Show how the existing Duel Spins price performs against the requested 32% profit rate. Provide a second, higher-priced scenario near 1,000× with a 1-in-1,500 cap target. Let Dylan choose between the scenarios.
- Set the final Mystery price after tuning. Divide the weighted mean win of the three complete bonus tiers by 0.96. Use Cosmic Clash names throughout the repository.

## Verified baseline

| Mode or rule | Value |
| --- | --- |
| Win cap | 25,000× base bet across the complete round |
| Enhanced Spins / Super Ante / Duel Spins | 3× / 6× / 50× base bet. On a $2 base bet these cost $6 / $12 / $100 per paid spin. |
| Regular / Super / Hidden mean payout | Approximately 96× / 240× / 816× base bet, conditional on entering that bonus. |
| God Mode minimum | 0×. There are 58,229 zero-return tickets per billion God Mode tickets. |
| Duel Spins profit / cap frequency | 44.21% strict profit against the 50× price. A 25,000× cap occurs once per 50,000 Duel Spins. |
| Mystery pricing example | At current tier means, the new mix pays 268.8× on average and implies approximately 280× at 96% RTP. Recompute after changing the tier math. |

At a proposed 20× ante and a Hidden chance of 1 in 43, the present Hidden mean contributes about 18.98× of the 19.20× return budget per spin. That leaves about 0.22× for all other returns. Measure those returns before deciding whether to change the mean, trigger frequency or price.

## Run the math

```sh
cd slots/games/cosmic-clash
npm run odds
npm test
```

`npm run odds` audits the shipped weighted catalog and writes `math/odds.json` and the menu odds. For a full rebuild, run `npm run math`. It enumerates deterministic candidate rounds, fits ticket weights and runs the odds report. The standalone generator uses `dist/math.js` to produce rounds by seed. The raw candidate population and the weighted, paid outcomes have different distributions.

The tuning inputs are in `dist/config.js`, `dist/session.js` and `scripts/generate-math.mjs`. Completed-round results live in `dist/outcomes.json` and `dist/math-report.json`. To play the baseline locally, run `python3 -m http.server 8000 --directory dist`.
