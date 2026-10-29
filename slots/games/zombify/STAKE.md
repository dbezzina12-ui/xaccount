# Zombify on Stake Engine

> Owned by Claude. Dylan asked on 2026-10-29 to get Zombify ready to upload to Stake Engine ("Engine").

## Build the upload

```
npm run studio:prepare      # once: the game's art
npm run stake:zombify       # tools/stake/build-zombify.mjs, about 3 minutes
```

The build writes `dist/stake/zombify/`:

| Folder | What it is | Where it goes in Engine |
| --- | --- | --- |
| `frontend/` | The static game, `index.html` at its root, about 115 MB. It holds only the art the game refers to, with nothing loaded from other sites. | Files page → import the folder → **Publish Game → Front End** |
| `math/` | `index.json`, then one lookup table (`lookUpTable_<mode>_0.csv`) and one books file (`books_<mode>.jsonl.zst`) per bet mode, about 10 MB. | Files page → import the folder → **Publish Game → Math** |
| `zombify-frontend.zip`, `zombify-math.zip` | The same two folders zipped, for handing over. | Unzip them first, then import the folders. |

To test, open **Developer → Start game session → Launch in New Tab** in Engine.

## Bet modes

Figures come from `math/stake-summary.json`, which is written by `tools/stake/zombify-export.mjs` from the published tables. Every mode returns **exactly 96.0000%**, and the most any round can pay is **25,000× the base bet**.

| Engine mode | Cost (× base bet) | What it is | Outcomes | Hit rate | 25,000× max |
| --- | --- | --- | --- | --- | --- |
| `base` | 1 | Base spin; a bonus starts 1 in 275 (90% Outbreak, 9% Super, 1% Hidden). | 110,116 | 26.49% | 1 in 2,286,373 |
| `enhanced` | 3.3 | Enhanced spin; a bonus starts 1 in 50. | 110,116 | 28.22% | 1 in 415,704 |
| `outbreak` | 100 | Buy Outbreak. | 32,000 | 99.50% | 1 in 1,078,749 |
| `super` | 250 | Buy Super Outbreak. | 30,000 | 99.25% | 1 in 12,099 |
| `mystery` | 460 | Buy Mystery: 90% Super, 10% Hidden (Hidden pays 1,000×+). | 54,116 | 99.32% | 1 in 837 |
| `secondlife` | 10 | Second Life spin: 2–4 zombies, hearts give respins. | 36,611 | 53.09% | 1 in 5,617,978 |

**Volatility.** Stake's math SDK compares each mode with its "3-star" volatility limits (`utils/rgs_verification.py`). It warns when a mode goes over them; it does not reject the upload.
- **Base game:** inside every limit.
- **Every other mode:** over `etl40b`, the expected win from rounds paying 40× the mode's cost or more. Super and Mystery are also over `etl10k`, the expected win from rounds paying 10,000× or more.
- **Why:** these limits are measured in multiples of the base bet. Any 100×+ bonus buy in a game with a 25,000× max goes over them, so expect Engine to rate those modes above three stars.

## How a round works on Engine

- **Format checks.** Engine picks every outcome from the lookup table. Its rows and books are matched by position. All weights and payouts are whole numbers, and every payout is a multiple of 10 (0.1×), as Engine requires. The export runs Engine's own upload checks on what it writes.
- **What a book holds.** Each book's single event is a recipe, which the game replays with its own engine: `outcome-model.js` `roundFromBook`. The recipe types are:
  - `spin`: a seed and a scatter count, or a natural bonus (trigger spin + bonus seed);
  - `bonus`: a tier and a seed;
  - `secondLife`: a seed, hearts and spins.

  The game refuses a round whose replay does not pay the book's `payoutMultiplier`. The export replays all 372,959 books before writing.
- **Free-play pairing.** Base and enhanced spins pair each bonus outcome with one trigger spin, and the trigger spins are dealt out evenly. That pairing differs a little from the free-play game's. To compensate, the no-bonus weights are adjusted until the mode returns exactly 96%.
- **The paytable.** Since 2026-10-29 every line pay is a whole 0.1×. The 3- and 4-of-a-kind pays were raised to the next 0.1×, and all catalogs were rebuilt at 96%; see `MATH.md`. The rules show the full line paytable.

## The game on Engine

The game uses `runtime/stake.js` and `runtime/stake-session.js`. Engine opens the game with `?sessionID=…&rgs_url=…&lang=…&device=…`.

- **The RGS.** It calls `/wallet/authenticate`, `/wallet/play` (base bet in millionths, plus the mode name), `/wallet/end-round` (only for a win) and `/bet/replay/…`.
- **Balance and bets.** The balance, currency (all of Engine's, including Stake.us Gold Coins and Stake Cash) and bet levels come from Engine.
- **Hidden on Engine.** Free-play credits, the credit reset, free previews and the prototype badge are not shown.
- **Unfinished rounds.** A round left unfinished is replayed and settled after the welcome screen.
- **Replay links.** A replay link (`replay=true&game=…&version=…&mode=…&event=…`) shows that round and never touches the wallet.
- **Stake.us (`social=true`).** No betting or buying words: BUY BONUS becomes PLAY BONUS, BET becomes PLAY, and so on.
- **Jurisdiction switches.** These turn their features off in both the desktop and phone controls: `disabledTurbo`, `disabledAutoplay`, `disabledBuyFeature`, `disabledSlamstop` (Skip), `disabledSpacebar`. `minimumRoundDuration` holds each round open at least that long.

## Tests

- `tests/stake.test.mjs`: launch parameters, money, words, books, and the RGS session against a stand-in RGS.
- `tests/browser/stake.e2e.mjs`: the real game against a stand-in RGS. It covers money to the cent for a base spin, Super, Outbreak and Mystery→Hidden, plus refusals, resume, replay, Stake.us words and jurisdiction.
- `STAKE_BUILD=1 node --test tests/browser/stake.e2e.mjs` runs the same tests on the built upload and fails on any missing file.

## Not done yet / to check on Engine

- **Engine's docs.** Claude's environment cannot reach stake-engine.com. This build follows Stake's published SDKs (`StakeEngine/math-sdk`, `StakeEngine/web-sdk`). Check the current upload and approval rules on Engine itself.
- **Languages.** English only. The game reads `lang` but has no translations.
- **Jurisdiction displays.** `displaySessionTimer`, `displayNetPosition` and `displayRTP` are not built. The rules always show the 96.00% RTP.
- **Size.** The front end is about 115 MB of art. Converting the large PNGs to WebP would shrink it a lot; that is art work (ChatGPT).
