# Cyber Skunk — production brief v1

## Superseding vent presentation — Dylan, 2026-10-30 (Cancún)

Dylan rejects pipes overlapping/cropping normal symbols and the workaround that shrinks/repositions symbols into a corner. Preserve the game mechanic; change its visual sequence to a two-sided symbol card.

1. **Land:** every card shows its normal symbol at the ordinary centred size, fully contained. A vent-bearing card has a distinct restrained cyan outline; a sticky vent also keeps an unambiguous latched-border treatment. No pipe artwork on the front, no diagonal symbol translation, and no vent-specific symbol scaling.
2. **Reveal:** after landing is readable, outlined cards flip around their vertical centre to a reverse face containing one complete centred pipe/vent mechanism. Keep the card footprint fixed and contain the mechanism with clear margins in every outlet rotation. Use separate front/back layers; hide the backface so neither symbol nor lettering appears mirrored. Starting timing: about 150–200 ms landing hold and a 250–320 ms flip, tuned by Claude for pace. Reveal the available route before the mascot fires; do not force a long serial flip for every cell.
3. **Act:** the spray follows the existing authoritative route. The centred mechanism turns/redirects the spray and shows its real pressure when hit. Route connections may animate over the grid during the action but must not permanently cover symbol artwork. Vent direction stays consistent with the actual route, not a new random flip result.
4. **Resolve:** show the authoritative final paying face before win evaluation is presented: a full readable WILD plus live multiplier for converted vent cells, ordinary symbols for untouched/unconverted cells. Do not flip a converted WILD back to its original symbol during award display. Sticky location/direction persist in game state and the border remains identifiable; on subsequent landings, show the newly landed front and repeat the reveal as appropriate.

Implementation targets for Claude: replace the `.cell:has(> .vent-art) .sym{scale:.78}` and direction-specific `translate` treatment in runtime/styles.css; replace simultaneous front-symbol plus vent-overlay markup in app.js cellHTML with explicit visual faces/state. Reuse the existing isolated vent artwork on the reverse first; request art changes from ChatGPT only if it cannot fit cleanly. Rules/intro examples must describe outlined cards revealing vents, rather than pipes permanently on top of symbols.

This is presentation only: symbol IDs, route, awards, sticky state, costs and RNG remain unchanged. Skip/turbo must resolve to exactly the same final face, multiplier, balance and route outcome. Reduced motion uses an immediate face change or short fade. Verify all four vent rotations, several simultaneous/sticky vents, scatter handling, no-spray rounds, next-spin reset, mid-flip skip and phone widths 360/390/430 plus desktop. Capture landing, reverse/action and award frames to prove symbols and mechanisms are complete and centred. This supersedes older overlay/corner-placement art directions.



## Explicit symbol restriction — Dylan, 2026-10-30
Do not add skunks to any reel symbols. No skunk characters, faces, silhouettes or tails on low symbols, premiums, WILD or FS. The rejected generated skunk-on-A draft is not a production asset and must never be integrated. Keep A/K/Q/J/10 plain and readable, premiums as industrial objects, FS as plain letters. Use a character-free industrial WILD badge; remove the earlier skunk-stripe motif requirement. The mascot is a separate animated character outside the reels.


## Superseding art/layout feedback — 2026-10-30
Dylan likes the concept but rejects the general art and the skunk consuming half the screen. Earlier full-height mascot/style-frame proportions are superseded. Preserve mechanics/math. Use compact expressive skunk, broad readable black/ivory shapes, short utility vest and small goggles; consistent painted 2.5D art with selective shading, restrained brass and minimal microtexture. Reels are the focus. Mobile target header <=20–22% usable height, cabinet approximately 22–76%, complete accessible controls below; small upper-body mascot behind ledge, tucked tail, no cell occlusion. Desktop reel/controller group centred, supporting mascot roughly 15–20% screen width. Claude owns immediate layout/nozzle-anchor correction and browser verification; ChatGPT revises art before completing old rig layers. Old A/K drafts uncommitted, not accepted production. New mockups are design references, not gameplay or pixel-perfect layout evidence. See latest HANDOFF.

Kickoff: 2026-10-30 08:25 UTC. Target reviewable full build: 2026-10-31 08:25 UTC.
Owner: Dylan. Art/UI: ChatGPT. Math/engine/rigging/audio: Claude.
Coordination branch: claude/blissful-rubin-xou20i. Project: slots/games/cyber-skunk.
Status: design + first style frame; NOT a playable or math-validated release.

## Authorization and scope
Dylan requested this new game, autonomous GitHub handoffs and hourly pickup, full art/audio/pay/buy screen/controller, properly rigged mascot, desktop/mobile polish. His follow-up explicitly requires Regular, Super, Hidden, Enhanced Spins and Feature Spins. This new project supersedes the old new-game pause for Cyber Skunk only. Do not alter Zombify/Night Fall math, resurrect embedded AI chat, provision keys or publish real-money functionality.
ChatGPT hourly continuation is enabled. Claude must arrange his own pickup with Dylan; a Git commit does not start his session.
No additional concept approval is required: advance the build. Report evidence and blockers honestly.

## Creative hook: Backpressure
A skunk saboteur hacks an industrial ventilation network with a pressurized scent trail. Elbow vents redirect the trail through the reels; sealed reservoirs bank pressure and release it on a later spin. The defining visual is a readable route and a visibly charging mechanical reservoir, not random neon explosions.
This is an original proposal, not a verified claim of global novelty.
Title remains CYBER SKUNK. Backpressure describes the mechanic, not a required subtitle.

## Proposed mechanical contract for Claude to implement and calibrate
6 reels x 4 rows, left-to-right fixed paylines; provisionally 20 lines. Four premium IDs H1-H4, five low IDs L1-L5, W, S. Vent and reservoir geometry are overlays, never silently change a paying symbol ID.
One authoritative pure outcome function supplies renderer and simulator. Decide every grid, route, pressure change, award and final total before animating.
1. On a spray event, enter at a selected boundary cell. Advance orthogonally through cells; elbow overlays turn the route.
2. Touched ordinary cells become wild for that resolution. Scatter cells stay scatter and are not wild substitutes.
3. Stop at board exit, obstruction or an already visited cell. Each cell is visited at most once per route. Explicit bound of 24 steps; no loops or recursive explosions.
4. Evaluate one final transformed grid once, not both pre/post grids. Scatter trigger is evaluated once. If more than one route touches a cell, it is still one wild.
5. Reservoir overlays can bank bounded pressure tokens and release on a later bonus spin. Proposed rule: a sealed reservoir stops incoming trail, gains one token, and releases at the start of the next spin. It is then reset; release tokens map to additive capped wild multipliers, never recursively multiplied across intersecting trails.
6. Pressure persistence is confined to the current bonus; base and paid feature spins are self-contained. At the last bonus spin release any scheduled stored pressure before final evaluation, with a defined order. No invisible unawarded carryover.
Claude: finalize exact route probabilities, charge-to-multiplier mapping, simultaneous release order, reservoir caps, line multiplier combination, retrigger cap and total award cap in MATH.md. If this design cannot meet distribution goals, change parameters or simplify with a handoff; do not silently substitute ordinary sticky wilds.

## Required modes
| Mode | Working name | Intended behavior | Cost / rates |
|---|---|---|---|
| Base | Base Spins | Occasional spray and natural entry into all three bonus tiers | 1x base bet |
| Enhanced | Signal Boost | Higher total natural bonus frequency; same visible rules, persistent selection until disabled | Target 3x cost if feasible; actual uplift must be measured, not equated with price |
| Feature Spins | Spray Job | Guaranteed bounded spray event on each purchased spin; no guaranteed payout | Provisional 10x, calibrate |
| Regular bonus | Vent Break | 10 free spins; routing spray and a limited pressure reservoir | Provisional 100x buy |
| Super bonus | Overpressure | 10 free spins; more persistent reservoir capacity and richer route opportunities | Provisional 250x buy |
| Hidden bonus | Blackout Protocol | Distinct opening network activation and strongest bounded reservoir setup; rare natural entry | No direct buy required; do not invent a price or guaranteed minimum |

All costs above except base are design targets, not approved math facts. All three bonus tiers must be reachable through base play, with Enhanced odds documented. Suggested scatter counts 3/4/5 for Regular/Super/Hidden, subject to actual reel model. Feature Spins trigger eligibility must be explicit in rules and report.
No Mystery buy requested at this stage. Do not add one at the expense of the required five modes.
At 96% RTP, provisional 100x / 250x / 10x / 3x modes require unconditional mean awards 96x / 240x / 9.6x / 2.88x of base bet respectively, including all nested features and caps. These are identities, not simulation results.

## Math acceptance gates — Claude owns
- Target 96.00% theoretical RTP per paid mode, denominator is actual charged cost. No fabricated exactness from Monte Carlo.
- Prefer exact weighted support plus complete book replay; otherwise report sample size, seeds, standard error/CI, convergence and unresolved rare-tail uncertainty.
- Max award target 25,000x BASE BET, capped once across complete round including nested bonus/retriggers. Cap is not a payout target.
- Initial design goal: unconditional base max roughly one in millions; conditional Hidden max no more frequent than 1/1,000. These are requested tail constraints, NOT achieved claims. Report actual frequencies for every mode and Hidden separately; change cap/frequencies if infeasible instead of forcing every Hidden into huge awards.
- Do not balance only the mean. Report zero-return rate; hit rate; return >= cost; median; p90/p99/p99.9; payout buckets; natural Regular/Super/Hidden rates; max odds; RTP contribution by feature; fraction of RTP supplied by rare tail. Include 100-round paid-mode session distribution.
- Genuine losses and ordinary/midrange wins must exist. Never use a fixed max-win script as default bonus preview. Random previews sample the same conditional distribution as that tier and cannot affect balance.
- Currency uses integer minor units or exact ticks. State rounding rule and verify cost/payout accounting across bet levels. Keep any 0.1x export quantization explicit and validate AFTER rounding.
- Prices, mode eligibility, rules and confirmation screen derive from one shipping config. No hidden odds changes from art, animation, turbo, skip or frame timing.
- Replay every finite catalog entry through shipping evaluation if catalogs are used; record source hashes and mismatch counts. RNG injection for tests only, no test seed left as normal play.
- Invariants: finite routes, one-time scatter evaluation, no duplicated intersecting awards, no negative balance, total cap, deterministic replay, no wager during unresolved round, bonus completion returns control.

## Art direction
Reference: art/inbox/cyber-skunk-style-v1.webp (first style frame; layout inspiration only, not production layers).
Palette: midnight #101820, graphite #252D31, ivory #EFE5CF, brass #AD7840, amber #EDA83C, pressure cyan #68C8C3.
75% restrained dark neutral area. Light comes from utility fixtures; no rainbow bloom, toxic-green wash, cluttered city billboards or saturated full-screen particles.
Mascot: adult black/ivory skunk saboteur, huge stripe tail, sly expression, amber welding goggles, cropped charcoal utility jacket, brass mechanical shoulder fittings, one industrial gauntlet, boots grounded on floor grill. Stylized painted dimensional art; coherent silhouette at phone scale.
Cabinet: front-on parallel rectangular edges, strong bevel, matte graphite body, brass inner lip, gauge outside symbol rectangle. Do not stretch decorative corner radii or bitmap art to different aspect ratios. Use separate rails/corners (nine-slice) or a clean scalable frame.
Symbols: H1 amber battery, H2 ventilation rotor, H3 cyan plasma canister, H4 circuit key. L1-L5 A,K,Q,J,10 in clean ivory. W skunk stripe badge; S large plain FS. Keep the FS lettering as a separate crisp layer.
Style frame is 1536x1024 and is NOT evidence of exact gameplay or working controls. Build all text/controls dynamically. Do not crop the frame into final symbol assets.

## Asset and rig contract
Claude: publish exact ART_SPEC.md and pivot guide FIRST; reuse tested rig architecture, but do not fake rigging by rotating a flattened whole character.
Suggested mascot registration canvas 1600x2000; baseline y=1880. Agree pivots before generating final layers. Parts: tail base/mid/tip, far leg/boot, far upper arm/forearm/hand, torso, near leg/boot, near upper arm/forearm/hand, head, jaw, eyelids, goggles, foreground shoulder/cuff occluders. Hidden joint overlap >=10% limb width; prepaint occluded areas. Same canvas/pixel registration for all PNGs. Tail root sits behind hips and can never detach.
Required clips: breathing idle with blink and tail follow-through; anticipation; turn/brace/spray/recoil/recover; reservoir release reaction; small win; big win; bonus entrance. Feet stay planted unless an explicit step is keyed. Layered bone/pivot rig, not video loop/sprite animation mislabeled as rigged.
Claude returns a rig browser preview and PNG guide with joint IDs/positions, extreme-pose examples, draw order and usable ranges. ChatGPT supplies/revises art to those guides.
Additional assets: separate desktop background 2560x1440 and mobile 1440x2560, quiet center; cabinet parts; 11 symbol assets 512px square; reservoir/vent overlays separate from symbols; logo; three separate bonus entrance panels; restrained effects atlas. Actual dimensions may be refined by Claude's ART_SPEC.
Keep filenames stable and asset inventory with hashes/dimensions/alpha. Original work only.

## Layout/UI
Desktop: title and mascot left of a centered play composition; cabinet main focus; controller directly below reel frame, never stretched. Mobile: purpose-built portrait composition, short title/header, large reel cabinet, mascot above/side or cropped behind a grounded ledge; tail never obscures playable cells. No uniformly shrinking desktop into phone.
Check 360x800, 390x844, 430x932, tablet portrait/landscape, 1366x768, 1920x1080. Safe areas and browser chrome accounted for. 44px minimum primary touch targets.
Standard controller: Play changes to Stop/Skip appropriately, separate +/- bet controls, circular Auto. Audio and menu reachable; mode active state visible. Opening menu during bonus must not mutate wager/outcome.
Buy menu: Feature Spins section FIRST (Enhanced + Feature); Bonus Buys SECOND (Regular + Super). Hidden shows discoverable tier information separately without implying a buy unless math supports a priced mode later. Separate confirmation: mode name, base bet, multiplier cost, total debit, balance, short feature rules; Cancel and Confirm. Insufficient balance disables confirmation. Auto stops on insufficient funds and respects user stop.
Separate bonus-entry panels, clear count of free spins, strong short names. Win tiers Nice / Big / Epic / Mythic / MAX WIN; triggers from actual awards and cap.
Support mute, reduced motion, keyboard focus and visibility pause. No fog layer over text or reels.

## Audio/animation — Claude owns
Original or properly licensed audio only. Base industrial breakbeat/electro groove with phase-aligned stems; bonus adds tension, Hidden sparse blackout pulse before release. Loop boundaries seamless; no phase drift when muting bass/keys; honor user gesture restrictions and hidden-tab suspend.
Events: button click, bet tick, reel spin/stop, vent turn, pressure charge, valve release, spray burst, scatter 1/2/3, anticipation resolve, bonus intro/outro, tier wins, cap sting. No generic deafening casino loop. Gain staging and limiter; music ducks under major wins.
Outcome-first replay: spin landing -> brief readable route cue -> articulated mascot spray -> trail stepping cell-by-cell -> reservoir response -> award. Skip resolves directly to same final state, total and balance; never strands an overlay.

## Timeline and definition of done
0-4h: Claude signs off rules and provides exact art/pivot contract; pure engine + first math run. ChatGPT style + asset production.
4-12h: integrate mascot layers, cabinet/symbols, six modes and correct UI; tune/report math.
12-20h: audio, effects, rig polish; mobile and desktop browser tests.
20-24h: final math replay, accounting tests, screenshots/video, playable hosted demo and handoff.
Done only with working playable link, actual assets/audio integrated, articulated rig preview, all six play modes exercised, coherent math report, passing tests and responsive screenshots. Claims of AAA are quality goals, not automatic completion labels. If blocked or deadline missed, state exactly what is incomplete.
