# Cosmic Clash math handoff

This is the runnable free-play game with the rounded Feature Spins and Bonus Buys menu. The existing model is the starting point for Dylan’s math redesign. No replacement targets have been chosen.

## Run the game

From this directory, run `python3 -m http.server 8000 --directory dist`. Open `http://localhost:8000`, enter the game and choose **Buy Bonus**. The project uses native ES modules. No npm install is needed.

## Super Ante handoff

Dylan wants to redo the math. Super Ante is wired end to end as a free-play starting point. At a $2 base bet, Enhanced Spins costs $6 and Super Ante costs $12. Activation is free, each paid spin is charged once, and both bonus tiers settle against the original base bet.

The trial mix in `dist/config.js` allocates 14,669,752 of a billion tickets to Last Stand, 955,248 to God Mode, and the remaining 984,375,000 to the ordinary Enhanced pool. Every tier reuses its existing round books. The price, tier mix, profit rate and cap frequency are tunable for the redesign. After changing them, regenerate the reports and review the tier-boundary, settlement and RTP tests. The screenshot Dylan supplied is a layout and price-ratio reference.

## Reproduce the baseline

| Command | Result |
| --- | --- |
| `npm test` | Runs mechanics, settlement, menu, controller and presentation tests. |
| `npm run odds` | Audits the shipped weighted pools against the report, replays each pool’s highest outcome, and regenerates the full odds report and menu data. |
| `npm run math` | Rebuilds the deterministic outcome catalog and math reports, then refreshes the menu odds. Full generation evaluates over 300,000 candidate rounds and can take time. |

| File | Role |
| --- | --- |
| `dist/config.js` | Base bets, prices, Mystery Buy tier weights, paytable, paylines and payout cap. Payouts use hundredths of a base-bet multiple. |
| `dist/math.js` | Seeded round generation, duel and bonus events, wins, multipliers, cap and replay. |
| `scripts/generate-math.mjs` | Candidate counts, bonus frequencies, calibration targets, distribution constraints, ticket weights and mode RTP. Review cost and return targets here when changing prices. |
| `scripts/calibrate-medium.mjs`, `distribution.mjs`, `rounding.mjs` in `scripts/` | Weight fitting, exact distribution calculations and integer rounding. |
| `dist/outcomes.json` | Shipped catalog. Each entry holds a seed, cumulative ticket weight and payout. Probabilities come from differences between successive cumulative weights. |
| `dist/session.js` | Tier selection, uniform ticket selection, replay validation, pricing and settlement. |
| `math/odds.json`, `math/report.json`, `dist/math-report.json` | Complete-mode odds and calibration reports. Historical baseline and comparison reports live under `math/`. |
| `scripts/report-odds.mjs` → `dist/shop-odds.js` → `dist/feature-menu.js` | Generates the menu’s profit and max-win odds from the current catalog. The Mystery split comes from the same configuration as tier selection. |
| `dist/app.js`, `dist/index.html` | Shop interaction, Game Info, the intro and gameplay. Review player-facing copy when changing the rules. |

## Current model

The cap is 25,000× base bet. Every paid mode has an exact weighted theoretical return rounding to 96.00%. Profit means the full round returns more than its paid price. Forty-five percent profit chance on a bonus is measured per complete bonus.

| Mode | Price in base bets | Current behavior |
| --- | ---: | --- |
| Base | 1× | Natural bonus about 1 in 250 |
| Enhanced Spins | 3× | Natural bonus about 1 in 83 |
| Super Ante | 6× | A bonus lands exactly 1 in 64 paid spins and is always Last Stand or God Mode |
| Duel Spins | 50× | Guaranteed wild reels, Crossfire on about 8.2% of paid rounds |
| Showdown | 100× | Regular free spins, cap 1 in 100,000 purchases |
| Last Stand | 250× | Super free spins, cap 1 in 25,000 purchases |
| Mystery Buy | 250× | 40% Showdown, 50% Last Stand, 10% God Mode |

Use the generated report’s `outcomesSha256` to identify the baseline. After a redesign, compare cost, RTP, strict profit chance, bonus/feature frequencies, cap odds and return distribution for each paid mode. Conditional God Mode outcomes are reported separately in the audit.
