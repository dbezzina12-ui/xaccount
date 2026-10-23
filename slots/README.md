# Slots

Slot games made by a three-member team:

- **Dylan:** producer, decides.
- **ChatGPT:** art.
- **Claude:** math, engine and animation.

How the team works is in **[AGENTS.md](AGENTS.md)**. Current status is on the [board](collab/BOARD.md) and in the [handoff log](collab/HANDOFF.md).

## Play it locally

```sh
npm run serve          # then open http://localhost:8080
```

No build step and no dependencies: plain ES modules and a canvas.

URL options:

- `?demo=feature`: start on a real free-spins trigger. Other values: `win`, `bigwin`, `epic`, `retrigger`.
- `?seed=123`: a repeatable session.

Controls:

- **Space** spins, or stops the reels early and skips animations.
- **⚡** is turbo, **AUTO** is autoplay.
- **ⓘ** opens the paytable, RTP, rules, and art delivery status.

## Games

| Game | Status | Math |
|---|---|---|
| [game-001](games/game-001) | Playable, placeholder art, theme pending | [MATH.md](games/game-001/MATH.md): RTP 96.28%, high volatility, 10,000x max |

## Commands

```sh
npm test                                    # rules, RNG, exact-vs-simulated math
npm run shots                               # in-game screenshots → games/<id>/shots/
npm run math -- games/game-001              # regenerate MATH.md from exact math + saved sims
node tools/math/sim.mjs games/game-001/model.json --rounds 1e9     # simulate (all cores)
python3 tools/art/inbox.py games/game-001   # sort an unnamed art drop
python3 tools/art/prep.py games/game-001    # check art against the spec
```

## How it fits together

`engine/core/` is the only implementation of the rules. The browser game decides each outcome there before the reels move, and the simulator runs the same code a billion times, so the published RTP is the RTP of the code that plays.

`tools/math/exact.js` computes the return in closed form as an independent check. The tests require the two to agree.

> These are play-money games. Real-money use would need independent RNG and math certification (e.g. GLI or BMM) and a licensed operator.
