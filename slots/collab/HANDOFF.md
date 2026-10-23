# Handoff log

Newest on top. Format is in `AGENTS.md`.

---

### 2026-10-23 · ChatGPT → Claude + Dylan · PAUSE GAME 001 — build the studio around Zombify

**Dylan's current direction (supersedes the theme kickoff):** "Let's not do that, let's load zombify and make our studio engine." He authorized ChatGPT to implement the editor and coordinate engine work. Do not start a new game or theme concept pass.

**Doing:** Visual studio on branch `codex/studio-zombify-editor`: separate desktop/mobile scenes, editable backgrounds/layers, reel grid/size controls, color grading, drag/resize, undo/save/export, real Zombify integration. Preserve existing Zombify walking/infection/Second Life mechanics; do not relabel Game 001's math as Zombify.

**Next for Claude:** Review the adapter boundary and reel animation integration once the editor branch lands. Keep Game 001 math untouched. A new grid is a presentation experiment until a compatible mechanics adapter and validated math exist. Do not rewrite Zombify's math to fit Game 001.

**Ownership for this task:** Dylan's direct instruction authorizes ChatGPT's scoped studio/editor/adapter changes. Keep unrelated xaccount work untouched. No math retune in this task.

**Source:** Zombify v125, existing Sites source commit `ae3ab40fde5106eb0484f0b9fd41fe1af160702e`. Live Zombify remains separate.

---


### 2026-10-23 · Claude → ChatGPT + Dylan · Game 001 is playable; needs a theme and art

**Did:**
- Built the studio repo and the rules for how we work (`AGENTS.md`).
- Designed and verified Game 001's math: exact calculation plus 1 billion simulated spins. RTP 96.28%, hit rate 28.3%, free spins 1 in 268, bonus buy 96.43%, high volatility, 10,000x max (`games/game-001/MATH.md`).
- Built the engine with placeholder gems and card ranks:
  - motion-blurred reels with overshoot landing, and scatter anticipation;
  - paylines, win pulses and light sweeps;
  - BIG/MEGA/EPIC win count-ups with coin rain;
  - the free-spins intro, multiplier badges on wilds, and retriggers;
  - bonus buy, turbo, autoplay, synth sound, and a phone layout.

**Files:** `games/game-001/ART_SPEC.md` (exactly what to make), `games/game-001/shots/*.jpg` (how it looks now), `games/game-001/theme.json` (skin values).

**Play it:** https://claude.ai/artifact/5BxfZPrsxZdrChBEfVeBbG (private to Dylan). Add `#feature` to the link to start on a real bonus trigger, or `#bigwin` / `#epic`.

**Next for ChatGPT:**
1. Propose **three original theme concepts** for Game 001. Each needs: name, one-line hook, mood, 6-color palette (hex), one Google Font, a symbol list (H1–H4 premium, L1–L5 lows, W wild, S scatter) with a one-line visual for each, and a base vs free-spins background idea. Make the multiplier-wild mechanic part of the fantasy: wilds that charge up and stack.
2. After Dylan picks, make one **style frame** (1536×1024 full-screen mockup).
3. Then symbols, then backgrounds, then logo, banners and coin, all to `ART_SPEC.md`.

**Questions for Dylan:**
- Approve the mechanic (D-002), or tell me what to change: max win, bonus frequency, volatility, buy price.
- Pick a theme once ChatGPT proposes.

**Blocked on:** nothing.
