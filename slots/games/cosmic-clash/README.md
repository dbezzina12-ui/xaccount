## Supplied replacement sound pack — v105

Installs all 15 titled clips from the user's `sounds.zip`: Nice/Big/Epic/Max wins,
the bonus-buy button, rising/falling duel coin results, five reel landings, VS
opening, and two alternating revolver shots. Reel landing 1–5 maps directly to
reel 1–5 at the supplied pitch. Each shot triggers one variant; rapid Crossfire
shots can overlap briefly without stacking both variants on one event.

Only matching events use `dist/assets/audio/sfx/supplied-v105/`. Original music,
VS landing, regular wins, bonus/free-spin cues, tease, spin engagement, control
clicks, multiplier reveal/increase, Crossfire arming and God Mode impacts are
unchanged. Existing files remain available in the repository. Sound replacements
share the existing SFX volume/mute controls and never affect game outcomes.

`python scripts/import-supplied-sfx.py /path/to/sounds.zip` recreates the web MP3s
with constant gain to a -3 dBFS source peak. This makes the quiet reel clips
audible without compression, trimming or pitch changes. Supplied recordings
retain their own tails without added room reverb; the louder Max Win uses the
same playback gain as Epic Win. The opening cue fades into the shot over 60 ms.
`credits.json` records source names, hashes, durations and gain adjustments.

## Directional VS winner sounds — v104

A higher-valued duel winner plays a rising four-strike coin chime; a lower-valued
winner plays the matching descending phrase. Compare the recorded surviving
value with the defeated fighter, so 20× beating 5× rises and 5× beating 20× falls
regardless of which fighter was already on the reel. Equal values keep the
neutral reveal. Surviving challenger wins also receive the correct result cue.
Reel removals, unchanged caps and skipped presentations do not play a winner
chime. God Mode retains its separate doubling/upgrade cue at impact.

The two short original effects and their level report are in the existing detail
sound pack, reproduced by `scripts/render-detail-sfx.py`. Download failures use
the same ascending/descending pattern as a fallback. Music, gunshots and the
quieter VS landing are unchanged. No round rules or values were modified.

## Sound detail and mix pass — v103

Preserves the exact Outlaw main/bonus loop files, music routing/EQ and the
approved shooting sample at its existing gain. The VS landing sample is also
unchanged, with its gain reduced from 0.60 to 0.44 (about 2.7 dB quieter).

Seven small original effects add a mechanical spin engagement, three alternating
reel latches, a quiet control detent, Crossfire arming and a God Mode impact.
`python scripts/render-detail-sfx.py` reproduces them; the rendered files and
level/provenance report live in `dist/assets/audio/sfx/detail-v103/`. These cues
use their own short printed reflections instead of the older shared long reverb.
Reel latches pan gently with the five reels and allow bounded overlapping tails.

God Mode's cue fires when the token reaches the multiplier. Crossfire uses the
approved gunshot on actual placement events on both screen layouts; idle rig
events do not trigger it. Duel cleanup no longer cuts off reward and shot tails.
Win dismissal fades its sting over 100 ms. Effects mute/volume control both dry
and reverb paths; hidden tabs still stop audio, and failed downloads keep the
existing procedural fallbacks. No new paid assets or generation credits used.

## Readable Crossfire and God Mode boost announcements — v102

Crossfire now uses a beveled metallic title plate with the exact extra-wild
count. It holds for 1.1 seconds (0.7 in Turbo), then moves to a compact header
above the shots and remains for 0.6 seconds after them (0.35 in Turbo), before
fading out. It no longer vanishes before the shooting begins.

Ordinary God Mode doubling uses a framed purple-and-gold 2× BOOST badge. Its
1.4-second animation (0.9 minimum in Turbo) includes a stationary reading hold
before flying into the multiplier. The impact lasts 0.32 seconds (0.23 minimum).
Skip and reduced-motion behavior still resolve the recorded value exactly once;
already capped values do not show a fake double. Bonus rules, outcome books,
prices and payouts are unchanged. The 11 focused upgrade/Crossfire tests pass.

## Purchase-screen VS artwork — v101

The Duel Spins purchase card now uses the same orange-and-blue VS symbol as
the reel artwork, replacing the outdated DUEL thumbnail. Prices, purchase
actions, feature rules and outcomes are unchanged.

## Quiet winner lighting — v100

Replaces the v99 portrait breathing and sway with stationary character artwork.
Only existing emissive details (respirator, weapon strips and robot visors)
gently vary in brightness. Runtime masks are computed once from the source art
and inherit its exact responsive crop. A soft glint crosses the actual gold W
silhouette roughly every 12–14 seconds. Timing is staggered across reels; active
fights, pending reveals and defeated reels suppress both effects. Reduced motion
shows the original still art. Multipliers, lives and game outcomes are unchanged.

## Settled duel winner motion — v99 (superseded by v100)

Surviving duel portraits now have a gentle breathing rise and weight shift after
combat ends, including sticky reels between spins and capped winners. Each reel
uses a different duration and phase; gold Bosses move more slowly. The W emblem,
multiplier, life rail and frame stay stationary. Pending VS reveals, active fights
and defeated reels do not run the idle, and reduced motion disables it. Existing
artwork, outcome books and duel resolution are unchanged.

## Guaranteed duel lands inside the bonus — v72

God Mode now opens with clear reels. Its guaranteed 5× VS badge spins in on the first bonus spin, then uses the existing hinged opening and multiplier pulse (or gold Boss duel). A presentation adapter stages the selected starting fighter as a centered landing on its original reel. The authoritative outcome book, resolved boards, first-spin upgrade, all ten spins, payout weights and max-win odds are unchanged. Natural triggers, Mystery buys and free previews use this same sequence. Focused checks cover all five starting reels, normal fighters, Bosses, immutable outcomes and later-spin persistence.

## God Mode pacing and readable skipped results — v71 / math 0.12.0

God Mode keeps its 5× starting value, immortal reels, ordinary doubling and gold Boss multiplication. Starting reels 1–5 now have 10% / 15% / 15% / 30% / 30% of the weighted outcomes, replacing the old 83.37% concentration on reel 5. The first additional reel arrives on spins 2–6 in the 70% of bonuses that award another reel. Rare third through fifth reels arrive on the final spin. The existing maximum-reel count mix, 20% Boss frequency, 816× conditional mean and approximately 1-in-196 conditional max-win rate are protected. Mystery still awards God Mode 10% of the time; all six paid modes remain approximately 96% RTP. The other five outcome pools retain their exact seeds, awards and weights. The God Mode median moves from 415.28× to 421.60×; returns at or above the 250× Mystery price reference rise from 92.71% to 97.50%. That reference is not a direct God Mode purchase price.

Rebalanced fixed God Mode candidates include ordinary and disconnected symbol-strip variants, plus right-edge Crossfire target variants. Every shot still changes an eligible ordinary cell, every reel uses its displayed multiplier, and every award comes from evaluating the displayed board. These are offline candidate templates, not player-specific adjustments. `math/god-pacing-baseline.json` and `math/god-pacing-comparison.json` record the exact before/after distributions. Reproduce with `node scripts/generate-math.mjs --reuse-matching --refit=hidden`, `node scripts/report-odds.mjs` and `node scripts/report-god-pacing.mjs`. Earlier max-win comparison files describe their historical releases.

Ordinary God Mode doubles now send a brief 2× token into the multiplier badge, followed by a small impact pulse. Fresh reels retain the approved hinged VS/DUEL reveal. Gold Boss multiplication retains its duel presentation. Already capped ordinary reels do not show a misleading boost. Turbo, reduced motion and skips resolve the recorded value exactly once.

Skipping a spin now displays its complete final board, multiplier values and win or miss for 700ms before advancing. Repeated skips cannot remove that reading pause. Reduced motion also retains it. The pause does not carry over into the next spin or affect the selected award or wallet settlement.

## Separate background and smaller scene actors — v70

Removed the two baked-in characters from the desktop environment. Matching transparent Hunter and Outlaw sprites now stand close to the reel frame at a smaller scale, with responsive placement tied to the reel stage. Full-resolution PNG masters, grounded origins, independent motion layers and animation handoff notes are in `art/scene-v70/`. Portrait keeps the existing clean environment and full-size reels. This prepares the artwork and scene structure; articulated character animation is not enabled. Math, controls, duel footage and the title gleam are unchanged.

## Arcade-comic frontier art — v64

The western environment and two side characters now use bold ink contours, mature athletic proportions and angular cel shading, based on the supplied arcade-fighter visual reference. The Hunter keeps his orange coat and respirator; the robot Outlaw keeps his black cowboy hat and cyan accents. Matching portraits appear on expanded wilds and after duel victories.

Phones and narrower tablet viewports use the matching portrait environment to keep the reels clear. Wider screens show both characters grounded in the shared scene. The animated title, reel landing motion, combat footage, math and controls are retained. Original generation prompts and source paths are recorded in `docs/comic-frontier-v64.json`.

## Animated original title — v63

The title keeps the original gold BOUNTY, blue BREAKERS, cracked sheriff star, bullets and custom letter shapes, with a restrained cartoon finish. One approved six-second Higgsfield take adds a small settle, a gold glint and a blue electric flicker. Both the game masthead and welcome screen use transparent animated WebP images, with a smaller mobile source and a static PNG for reduced motion or browsers without WebP support. The last frames blend to the exact first pose to avoid a loop snap.

The title fits its reserved desktop, mobile and landscape header without cropping. Generation settings and source URL are in `docs/title-animation-v63.json`; `scripts/encode-title.py` reproduces the transparent exports. Gameplay, math, sound and reel landings are unchanged.

## Cartoon frontier and weighted reel landings — September 19

The desktop environment and its two gunslingers use new flat, inked cartoon art with a matching portrait frontier background on phones. The old anime-style header portraits and coat-video overlay are no longer mounted. Mobile reserves a compact title area.

Reels now roll at a steady pace with a short final brake, following Olaf’s stop timing. Settled symbols compress, rebound and recover in a brief bottom-to-top impact wave; Duel Badges and scatters have more weight. All landings join the existing skip controller, and Turbo uses a shorter settle. Reduced motion bypasses the deformation. Outcomes, math, prices and duel footage are unchanged. Artwork prompts are in `docs/cartoon-frontier-prompts.json`.

## Mobile counter overlays the title — v51

The active spin terminal no longer reserves an extra row on phones. Mobile uses the same 80px caption budget and ordinary 32px board header as base play (66px / 28px in short mobile landscape). The absolutely positioned terminal extends upward over the lower-right title area, while the real reel frame still conceals its mount and entrance. This keeps the reel square at its normal size when free spins or respins begin. Desktop layout and counter behavior are unchanged.

## Metal multiplier badges and pop-up spin terminal — v50

Combat multipliers use bevelled metal badges, warm/cyan fighter accents and larger high-contrast numerals. Three- and four-digit values size down within the same badge; character artwork and video framing are unchanged. A native inline SVG/CSS terminal replaces the gun-hand counter, rising straight up from behind the top-right reel in 380ms. Its large count, remaining-spins bar and completion state use the existing round events. Tier accents are amber, cyan or violet.

The compact terminal reserves 100px above the reels on desktop, 83px on mobile and 62px in short landscape layouts, recovering space previously reserved for the hand. Gun artwork is removed from active markup and preloading. Reduced motion, Turbo, skipping and count semantics are preserved. No Higgsfield generation or image credits were used. Existing focused presentation/counter tests, native SVG inspection and actual-font fit checks cover the update; math and outcomes are unchanged.

## Faster duels and dedicated Boss victory — v49

All four continuous duel takes play at 1.5× in normal mode (about 3.36 seconds for a 121-frame, 24fps take). Turbo reaches 4×. Gunshot cues follow video time and the result still waits for the actual end. The new 480p Boss-winning take keeps the gold armored Boss upright while the Outlaw falls, replacing the shared Hunter-winning footage. The original Boss-loss take remains selected for Boss defeats. The first 15-credit generation was rejected in visual review because both fighters fell. The accepted take edits the standing Hunter in the existing Outlaw-loss video into the gold Boss, preserving the complete action; its estimate is 15.12 credits (30.12 total across the two attempts).

Focused tests verify all fighter/winner combinations, playback rates, skip and media-failure cleanup, sequential resolution, capped reels and spin counters. Math, awards, prices and life rules are unchanged. New generation provenance is in `dist/assets/duel-v49/`.

## Complete 480p outcome takes — v48

Three five-second Seedance 2.5 videos reference the original v42 take, preserving its close overhead framing, coats and illustrated corridor. Each generated video includes the whole duel and one specific loser: Hunter, Outlaw or Boss. There are no temporal cuts, separate fall layers or background replacements. Native MP4 playback replaces the frame atlases; the result waits for the media ending, with the final video frame underneath the winner dissolve. Whole-scene rotation handles an Outlaw incumbent. Within the three-clip budget, Boss victories retain the earlier shared orange/gold champion scene, gold Boss label and Boss result portrait; only Boss defeats use the armored Boss take.

Videos preload as local blobs, play muted and inline, and follow Turbo speed. Skip, canceled guide demos and unavailable media release playback without changing settlement. Math, outcomes, multipliers, prices and spin counting are unchanged. Generation requests, IDs and the 45-credit estimate are recorded in `dist/assets/duel-v48/provenance.json`. Validation covers loser routing, continuous playback, media completion/errors, skips, capped reels, sequential duels and counters.

## Continuous defeat and winner reveal — v47

The post-flash scene uses a single illustrated background instead of repeating a tiny floor crop. The black flash fades out over 160ms with the next shot already prepared underneath. Each existing defeat clip plays at its source 24fps (33 frames / 1,375ms for Hunter and Boss; 23 frames / about 958ms for Outlaw), followed by an 80ms settling pause. A 420ms opacity dissolve replaces the old 360ms wipe that was interrupted by its 300ms phase. The defeated shot remains opaque beneath that dissolve, preventing a dark dip or sudden background change. Static holds stop their frame loop and duplicate atlas position writes are skipped. The original shootout, outcomes, multipliers, spin counter and skipping remain unchanged.

## Shootout, black cut and loser knockdown — v46

The original two-character Higgsfield take now plays as one continuous scene with its original shot order, detail and background. After the exchange, a 120ms black cut switches to the recorded losing character's existing animated knockdown, shown alone across the reel for 960ms. The defeated pose holds for 260ms before the winner portrait and multiplier. The previous composited sliding exit is removed. Hunter, Outlaw and Boss defeats reuse the v43 atlases; no new generations or credits. Normal sequence timing is about 3.41 seconds, plus a first-time Boss entrance where applicable. Turbo, skipping, reduced motion and capped-reel suppression remain intact; math and awards are unchanged.

## Original cinematic artwork restored — v45

Restores the v42 Higgsfield footage, jacket detail, lighting, floor and close-up framing. Two aligned windows share that original atlas; only the recorded loser receives a short composited hit/knockback exit, followed by the existing winner portrait and multiplier. This is an effect applied to the original scene, not a new articulated death video. A small floor patch was cropped from the same original generation for the revealed background. No new generations or credits. The separate v43 character videos remain preserved but are no longer loaded. Game math, outcomes, prices, counters, Turbo and skip behavior are unchanged.

## Close-up duel framing — v44

Existing fighter performances now use fixed close-up framing: 1.9× Hunter, 2.1× Outlaw and 1.55× Boss, accounting for their different source sizes. Faces and torsos fill more of the reel on desktop and mobile. The zoom remains constant through firing and defeat; the arena clips the enlarged artwork to its own reel. No new media generation or gameplay changes.

## Outcome-aware Higgsfield knockdowns — v43

Three reusable character performances cover Hunter, Outlaw and gold Boss matchups. The recorded loser's opening shot precedes the winner's reply; only that loser plays its articulated fall. The winning fighter remains upright, and the defeated pose holds for 350ms before the original winner portrait and multiplier appear. A fixed proportional frame keeps each entire performance inside its reel. Normal playback is about 2.94 seconds, with Turbo, Stop and reduced-motion behavior preserved. The intro guide uses the same presentation. No math, weights, life rules, prices or awards changed. Source clips, transparent atlases and provenance are in `dist/assets/duel-v43/`.

## Higgsfield duel and gun-hand spin counter — v42

One 4-second overhead draw/fire take replaces static fighting poses. Its 96-frame atlas follows the existing duel phases, Turbo and Stop. The recorded winner appears through a quick reveal with the original portrait. A gun-hand counter rises behind the top-right reel frame for free spins and life respins; its number comes directly from each round event. Reduced motion resolves directly. Math, outcomes, prices and soundtracks are unchanged. New assets and generation provenance are in `dist/assets/duel-v42/`.

## Cinematic duel update

Contained reel opening, short standoff, rapid shot exchange and winner takeover. Normal duels run about 2.4 seconds plus multiplier settlement when applicable. Sequential playback, skip handling, capped-reel suppression and round outcomes are preserved.

## Tumbleweed environment update

Characters are stationary on mobile and desktop. Occasional tumbleweeds roll behind the game, and the moon has a slow glow. Reduced-motion mode uses a steady glow and no tumbleweeds.

## Integrated scene update

Replaced the mobile banner with independent masked character layers and a transparent title over the continuous frontier environment. Subtle, staggered breathing and drifting atmosphere respect reduced-motion settings. No gameplay changes.

## September 12 visual update

Mobile uses one full-width Bounty Breakers header based on the supplied orange-moon composition, with only the game title and no peripheral sign lettering. The matching night frontier environment is used behind the game and intro. Desktop cast is static: no gun-draw/reload sequence, spin callback or idle-animation loop. Resize observation positions the illustrations without animating them. This visual update does not change math, bets or game mechanics.


## September 11 update — v0.11.0

Paid whole-round max-win odds are now Duel Spins 1 in 50,000, Showdown 1 in 100,000 and Last Stand 1 in 25,000. The maximum remains 25,000× base bet. These are exact integer-ticket probabilities, not Monte Carlo estimates. Rebalanced legal cap boards within existing feature groups; no awards are injected or changed during play. All paid modes remain approximately 96% RTP. Natural bonus frequency stays 1/250 and Enhanced remains 3× chance for 3× cost. Plain base, plain Enhanced and conditional God Mode outcome pools are byte-for-byte identical to v0.10.0.

The Duel hit rate remains 90%; Duel, Showdown and Last Stand retain 45% full-cost recovery. Median returns move 43→42.8×, 91.06→91.05× and 224.63→224.4× respectively. Cap funding slightly reduces other awards. God Mode remains about 1/196 conditional on receiving it; complete Mystery Buy now caps about 1/1,871. Base/Enhanced whole-round caps are about 1/4.29M and 1/1.43M. See `math/max-win-comparison.json` for the complete before/after audit and ≥500× / ≥1,000× / ≥5,000× frequencies.

The bet ladder now reaches $500 base bet in both the console and bonus shop. All prices and payouts use the same base stake: at $500, Enhanced costs $1,500, Duel $25,000, Showdown $50,000 and Last Stand/Mystery $125,000. Maximum cash payout is $12,500,000. Console amounts shrink to fit rather than showing ellipses. Insufficient demo credits still prevent purchases; free bonus previews remain available.

Original painted frontier artwork replaces the standing CGI presentation. Two illustrated six-pose character sheets and generated luminance masks support drawing, presenting and reloading their pistols. They take turns during play and periodically while idle, stop behind menus/on hidden tabs, and respect reduced motion. This is a compact pose animation, not a 3D/skeletal character rig. Supporting generated art and complete prompts are recorded in `dist/assets/scene-art-provenance.json`. Lossless WebP encoding preserves source detail. Existing reel symbols, duel animations, logo and console design are retained.

Local checks use the Engine math guidance read September 10: https://stake-engine.com/docs/approval-guidelines/math-verification . The $500 prototype base bet exceeds the 2-Star starting maximum round-cost allowance at the 250× buy price, while fitting the published 3-Star starting cost/exposure allowances. Production bet templates are assigned by Engine; this free-play build is not approval or certification. Existing RGS query parameters still fail closed until a proper Engine release is implemented.

Reproduce: `node scripts/generate-math.mjs --reuse-matching --refit=duel,regular,super`, `node scripts/report-odds.mjs`, `node scripts/report-max-win.mjs`, `npm test`.

# Bounty Breakers

Gamboligy Games' separate, free-play sci-fi frontier slot prototype. Relic of Profit is not modified.

## Run

Serve `dist/` with any static HTTP server. No bundler or runtime dependencies are required. `npm test` checks mechanics, finite outcome weights, demo wallet settlement and sequential auto spins. `npm run math` regenerates deterministic outcome pools and the measured math report. `node scripts/generate-math.mjs --reuse-matching` may reuse prior weights only for modes whose freshly generated seed/payout entries and target means match; the same return and feature checks still run. Add `--refit=base,enhanced,duel` when changing those pools' distribution preferences; a matching payout alone does not establish that new preferences were fitted.

## Mechanics

Five reels, five rows, 50 fixed paylines. Duel wild reels substitute for paying symbols. Multiplier values add on each winning line. Three or more symbols pay from the leftmost reel, and only the longest match on each line pays.

- **Showdown**: 10 spins; participating Duel wild reels reveal a multiplier and clear after that spin.
- **Last Stand**: 10 spins; Duel wild reels begin with three lives and remain on their reel. The incumbent keeps its multiplier and lives when it wins. A challenger victory replaces the reel owner and multiplier with the challenger’s own value and removes a life. The value can go up or down; fighters never combine multipliers in this mode. Zero-life Duel wild reels disappear before evaluating the spin.
- **God Mode**: 10 spins; one guaranteed Duel wild on a selected reel, all Duel wild reels immortal, normal fighters doubling every spin, and gold Bosses multiplying by the rival value. Two or more Duel wild reels create 2–4 temporary ordinary wilds on eligible spots through Crossfire.

Outside God Mode, fighters reveal an ordinary multiplier from 2× to 50× or a gold Boss value from 25× to 250×. The winner keeps its own revealed value, never adding or multiplying by the loser. Persistent reels can change owner when challenged. Gold Boss status is lost when a normal challenger takes over. Only God Mode starts at 5× and grows: normal fighters double (5 → 10 → 20×), while gold Bosses multiply by the rival value. `bossRoundProbability` reports Boss appearances over each weighted complete-round pool.

Per-reel multiplier cap: 256× normally, 1,024× only in God Mode. Total round cap: 25,000× base bet. Purchases: Showdown 100×, Last Stand 250×, Mystery 250× (40% / 50% / 10%). These new-game costs are prototype defaults. Bounty Vault scatters reveal 3 / 4 / 5 for regular / super / hidden, including Mystery purchases.

## DUEL word and scatter anticipation

The selected cel-shaded symbols use D/U/E/L as the four low symbols. Version 0.9.0 strengthens matching-symbol pays across the 50 unique lines; the information panel displays the updated values at the current base bet. Actual D–U–E–L letters on reels 1–4 along one of the 50 paylines award 100× base bet. Wilds cannot stand in for letters. An adjacent expanded Duel wild on reel 5 boosts the word by its multiplier, capped at 5×, so the word award is at most 500×. Even a 1,024× Duel uses only 5× for the word. One highest word award pays per spin, in addition to ordinary line wins, whose full multipliers are unchanged. A fifth-reel badge can qualify through the word alone. The paytable shows this award in currency at the current base bet. Outcome pools and reports have been regenerated to include the word while retaining the protected feature frequencies and approximately 96% mode RTP.

After the second current-spin scatter settles, unfinished reels slow down and their ordinary symbols become dim black and white. Scatter artwork retains colour, and a restrained gold outline follows the next reel to land. Remaining reels continue the tease through potential bonus upgrades. The effect reacts to settled columns only, never to filler symbols or the previous board, and cannot affect the selected outcome. Turbo uses a shorter tease; Spin skips it and reduced-motion mode bypasses it. Cleanup removes all dimming after the reveal, including a skip. Natural bonus and purchased bonus reveals share this presentation. No new losing scatter outcomes are introduced.

## Feature spins

- **Enhanced Spins**: 3× base-bet cost and exactly 3× each natural bonus trigger probability (about 1 in 83.33 spins overall, versus 1 in 250 base spins). A separate plain-spin pool preserves approximately 96% RTP on the full 3× cost. Bonus payouts continue to use the original base bet.
- **Duel Spins**: 50× base-bet cost. The opening spin always lands 2–5 distinct, expanded Duel wild reels, whether or not they connect. Exact reel-count probabilities: 82% / 16% / 1.9% / 0.1%. Fighters reveal individual values; the winner keeps its own multiplier, including a gold Boss. In 1% of paid rounds, every starting fighter has three lives and stays for up to 10 free respins after the opening spin. A challenger victory replaces the incumbent and its multiplier, and removes one life. Reels with zero lives disappear before that spin pays. No additional Duel reels or scatter bonuses are added. The round ends when all fighters are gone, the respin limit is reached, or the 25,000× cap is hit. Only the first spin is charged; the entire round settles once. Reel cap remains 256×. Maximum wins remain reachable; see the current frequency in `math/odds.json`.

The shop activates one feature at a time. The console shows the full per-spin cost in orange for Enhanced Spins or cyan for Duel Spins; the feature banner uses the existing gap above the controls without growing the page. The base bet remains visible in the shop and paytable. Autoplay uses the active mode's cost and stops for a natural bonus or a life-bearing Duel Spin. Bonus purchases retain the centred-card confirmation flow.

## Model and limitations

`math/report.json` contains exact weighted-pool expectations, conditional hit rates and conditional maximum-win frequencies for this build. `node scripts/report-odds.mjs` verifies the highest awards against the current mechanics and writes `math/odds.json`, including the combined natural-spin and Mystery Buy odds. Showdown can now reach 25,000× with exactly 10,000 tickets per billion (1 in 100,000 complete bonuses). A rare candidate template constructs legal five-reel gold Boss victories; every fight and line payout is still evaluated and replayable. This raw template frequency is not the paid probability. `dist/outcomes.json` contains fixed seed / cumulative integer weight / payout entries. A complete round is selected before any presentation. Crypto ticket draws reject the uneven 32-bit tail, keeping integer tickets unbiased even for the extremely rare Showdown max. Neither stake, animation skipping, wallet balance nor play history changes those weights. The raw generator is only a candidate generator; its branch probabilities are not the final weighted game probabilities.

God Mode calibration preserves maximum active reel counts of 1 / 2 / 3 / 4 / 5 with weighted probabilities 30% / 65% / 4.5% / 0.45% / 0.05%. Thus 70% of complete God Mode rounds gain another duel reel. Boss encounters are protected at 0.8% of plain base rounds, 25% of Showdown bonuses, and 20% of Last Stand and God Mode bonuses. Calibration groups by actual Boss presence, jointly with God Mode reel counts and starting positions. Duel Spins instead protect the joint initial-reel count and lives frequencies. Showdown cap books have a separate fixed ticket reserve. Offline calibration splits zero and positive awards inside protected feature groups, then applies a broad log-normal preference for medium returns. Plain base / Enhanced rounds fit 25% / 22% cost recovery; Duel Spins, Showdown and Last Stand fit 45%. All six paid modes hold approximately 96% RTP. Largest-remainder integer allocation and within-group rounding preserve the feature totals; every candidate retains at least one ticket. God Mode uses 240,000 candidate books and a 0.2% per-book calibration ceiling, with an effective-variety check. Other pools use a 0.8% ceiling. No player-specific adjustments occur. These are whole-round frequencies, not independent landing probabilities per spin.

All six chargeable demo modes target approximately 96% theoretical return. This is a finite prototype pool, not a certified production math release or an Engine upload package. Maximum-win rates differ by mode: Duel Spins are 1 in 50,000 complete rounds, while God Mode is about 1 in 196 conditional on receiving it. Repeated seeds are possible. The hidden tier can hit the cap much more often than base play; see the report for this exact model.

Free preview buttons use the same conditional bonus pools but neither charge nor credit the demo wallet. Autoplay stops when a bonus begins and on a hidden tab. Only one round can be pending or settled at a time. Base and bonus wins are displayed with count-up animations; tapping the spin button skips presentation. Each expanded reel contains its own vertically stacked duel: the incumbent above and challenger below, both fire, and the winner resolves in place. Portraits follow owner changes. Reel fights run one at a time, around 3.2 seconds each at normal speed, with a winning-value hold. A transfer effect plays only for God Mode growth; ordinary winners show their unchanged value immediately. A newly revealed Boss gets an extra 0.9-second gold entrance inside its own reel. Missed crossed-pistol badges stay unchanged as non-paying symbols. Golden W artwork marks ordinary and expanded wilds. Once a persistent reel is already at its mode’s multiplier cap, unchanged wins skip the fight, upgrade sound and inter-fight pause. The fight that first reaches the cap still plays. Capped Last Stand defeats apply their life loss and possible reel removal with a short status cue, without replaying the shootout. Spin skips the presentation, including its multiplier roll. A failed animation cannot change or discard the already selected demo award.

This build intentionally rejects Engine session parameters; it must not silently become a demo inside a paid session. A future Engine release needs server-authoritative outcome books, wallet calls, export validation and certification. No live-money integration is included in this first prototype.

## Artwork and audio

See `ARTWORK.md`, `art-prompts.json`, and the notices in `dist/assets/fonts/` and `dist/assets/audio/`. All generated raster assets are preserved unchanged and cropped only for display. The header groups the large title and mobile Hunter/Outlaw portraits into one compact composition, with crisp face crops, a dark backing and restrained amber/cyan lighting. The soundtrack consists of four original 140 BPM chiptune / dubstep arrangements with synthesized drums, wobble bass, chip leads and stereo delays. `python scripts/render-soundtrack.py` renders the loops using NumPy, SciPy and ffmpeg. All scenes share a 32-bar length and harmonic progression; bonus transitions preserve the beat position and crossfade over 320 ms. A music-only low shelf and broad upper-bass boost add weight while leaving effects and mute controls separate. Recorded loops keep synthesis work out of the browser. `credits.json` records rendered-file hashes and level checks.

Validation is code-based. No browser or visual QA is claimed for this build.

## Payline clarity and Duel Spin audit

Tap the 50 PAYLINES label or the information panel’s VIEW ALL 50 PAYLINES button to inspect every active path against the current board. Guide diagrams derive directly from `LINES`; row 1 is the top. Winning combinations draw one exact path at a time, stopping at the actual paid match, and clear when the next board starts. Reduced motion and fast presentation keep the first trace static. The guide groups the 50 paths into five pages of ten and derives every preview from the same `LINES` used by the evaluator.

The reported board (gun/blade/L/hunter/U, chip/L/gun/L/D, gun/gun/L/hunter/E, 10× Duel, 25× Duel) now pays three L lines: 22, 23 and 50. Each now pays 0.25× × (10 + 25) = 8.75× base bet, totalling 26.25×. It returned zero under the old 15 paths. Not every arbitrary left-to-right connection is a line; the guide shows all allowed paths.

## Bonus frequency and useful connections (0.10.0)

Natural bonuses occur with probability 0.004, or 1 in 250 paid base spins. Showdown / Last Stand / God Mode retain the prior conditional tier proportions (2700 / 330 / 27 out of 3057), with every tier about 30.85% more frequent. Enhanced Spins triple those probabilities at 3× cost: 0.012, or 1 in 83.33. The three conditional bonus outcome pools and their exact weights are unchanged, including purchases, Mystery's 40% / 50% / 10% selection, and God Mode's 816× conditional mean.

The increased frequency raises bonuses' share of total expected base return from 37.5% to 49.1%. Plain base / Enhanced rounds still pay something 55% / 65% of the time and recover their complete 1× / 3× cost 25% / 22% of the time. The tradeoff is smaller ordinary returns: at $1 base, their conditional medians move from $0.20 / $0.84 to $0.17 / $0.72, and their means from $0.6014 / $1.8154 to $0.4903 / $1.4829. Large ordinary outcomes contribute less; approximately 96% RTP remains across all six paid modes. These conditional ordinary-round metrics exclude bonus triggers.

Duel Spins keep 90% positive returns, 45% full 50× cost recovery, a 43× median, their exact 2–5-reel/life mix and reachable 25,000× cap. Offline weighting now favours opening boards where the wild reels participate in ordinary paying lines, using a bounded connection score alongside the existing medium-payout preference. With exactly two starting wild reels, both participate in paying lines about 87.01% of the time, up from 82.78%. Across all opening reel counts, all wilds participate about 87.19%, up from 83.22%. They can contribute to different lines. This changes fixed board frequencies, not multipliers, pay values, or a selected outcome during play. `math/bonus-frequency-baseline.json` and `math/bonus-frequency-comparison.json` record the measured change.

Each highlighted line now shows its symbol, match count, base-bet symbol payout, contributing multiplier and line award in the existing caption space. Only that line's cells and Duel reels are highlighted at a time. Short additive multiplier sums are shown directly; longer sums use the combined value with the full breakdown available as a tooltip. The formula uses the locked round stake, retains fractional-cent base-symbol amounts when necessary, respects the DUEL word's 5× multiplier cap, and labels pre-cap amounts when the round limit reduces the credited win. Total round winnings stay in the bottom console. The trace and formula clear together when the next board begins.

## Historical winner-keeps balance (0.9.0)

The following measurements describe the preceding release; the current frequency and ordinary-return allocation are documented above.

Ordinary fights retain the winner’s own value; only God Mode grows multipliers. The highest symbol’s 3 / 4 / 5-match pay is now 0.20× / 0.60× / 1.25× per line, up from 0.06× / 0.24× / 0.75×. All eight matching-symbol pays increased. The 100×–500× DUEL word award, 50 lines, Crossfire, feature prices and 25,000× round cap remain.

More return is allocated to ordinary spins. To preserve the same approximately 96% RTP and the same conditional bonus pools for natural triggers and purchases, natural trigger probabilities are now 0.0027 Showdown / 0.00033 Last Stand / 0.000027 God Mode. Together this is about 1 in 327.12 normal spins, compared with 1 in 220.26 before. Enhanced Spins still triple each probability, about 1 in 109.04. Bonus purchases keep their previous prices and conditional mean payouts. The naturally triggered bonuses’ share of expected base-game return falls from about 55.9% to 37.5%.

Plain base / Enhanced / Duel pools return something in 55% / 65% / 90% of rounds. Cost-recovery targets are 25% / 22% / 45%; Showdown and Last Stand also recover their purchase cost about 45% of the time. Partial returns remain losses. At $1 base bet, the $50 Duel median rises from $39.60 to $43; the $100 Showdown median rises from $83.90 to $91.06; the $250 Last Stand median rises from $202.56 to $224.63. These are fixed-pool statistics, not session guarantees. `math/winner-keeps-baseline.json` and `math/winner-keeps-comparison.json` record the change.

God Mode candidates now include a late-arrival pattern, with reel 5 held from the start and one or two additional right-side reels arriving on the final spin, alongside the existing arrivals across all reels. The candidate mix is not its final paid probability. The fixed weighted pool still preserves its 70% additional-reel chance, all five reel-count probabilities, 20% Boss-encounter rate, guaranteed starting wild, doubling and 1,024× cap. This supplies a wider range of medium outcomes after the symbol-pay increase. God Mode retains an 816× conditional mean; its median is 415.28× versus 429.17× before, while outcomes below the 250× Mystery Buy reference price fall from about 43.1% to 7.3%. This is conditional on God Mode already being awarded, not a direct-buy RTP.

Calibration re-anchors exponential weights after each ceiling allocation, preventing numerical underflow when fitting ordinary returns alongside very large legal outcomes. Every candidate retains at least one ticket and protected feature frequencies are still validated.

## Historical balance notes

The following version-specific measurements are historical. Use `math/report.json` and `math/odds.json` for the current model.

### Medium-return balance (0.7.0)

Duel Spins retain a 50× price, 2–5 guaranteed wild reels, 1% life rounds, 25,000× cap and approximately 96% theoretical return. The distribution now has 12% zero returns, 88% positive returns and approximately 40% returns at or above the full paid cost. Roughly 68.7% of rounds return between half and twice the cost, accounting for about 73.5% of total return. At $1 base bet / $50 cost, the median is $40.75. A partial return is explicitly a net loss, not a profitable round.

The plain base pool now pays something in 45% of rounds; the plain Enhanced pool in 60%. Natural bonuses remain separate and keep their existing trigger probabilities. Showdown and Last Stand are also weighted toward medium complete-bonus returns. God Mode retains its premium conditional average and existing reel/Boss frequencies, using a larger candidate catalogue for variety. Very large awards remain possible but carry less of the return in Duel Spins, Showdown and Last Stand.

`math/playability-baseline.json` preserves the 0.6.0 distributions. After generating outcomes, run `node scripts/report-odds.mjs` to refresh current odds and `math/playability-comparison.json` across all paid modes. The older `math/duel-distribution-audit.json` is a historical 0.6.0 diagnosis. Distributions describe the complete fixed pools, not guarantees or targets applied to individual sessions.

### Duel return adjustment (0.7.1)

Duel calibration broadens its positive-return spread from 0.65 to 0.75, preserving 12% zero returns, 40% recovery of the full paid cost, protected reel/life frequencies and approximately 96% theoretical RTP. Returns of at least twice the 50× spin cost increase from 3.968% to 4.557% (about 15% more frequent). The 2×–5× cost band increases from 1.967% to 2.555%; the 5×-cost-or-more band stays near 2%. The median at $1 base / $50 cost moves from $40.75 to $39.60. About 65.2% of rounds return between half and twice the price, carrying 70.9% of the total return. This is a measured tradeoff toward larger wins, not an increase in overall RTP. Other pools and all candidate seed/payout pairs are unchanged.

`math/duel-boost-baseline.json` preserves the 0.7.0 Duel pool statistics; `math/duel-boost-comparison.json` records this adjustment. Expanded Duel reels now use the original `golden-w.png` with a real alpha channel instead of the opaque feature atlas. The first standing-character attempt was not integrated because its backgrounds contained checkerboards; the replacement is completed in 0.8.0 below.

### Standing characters, lighting and Duel Crossfire (0.8.0)

The Hunter and Outlaw are now full-body 3D-style renders with subtle idle motion beside the desktop reels. Their heads/shoulders also replace the mobile header portraits. Original generated PNG pixels are preserved; these are rendered sprites, not rigged 3D meshes. The Outlaw is mirrored in CSS to face the board. The scene's existing neon signs flicker gently, with a slow ambient glow. Reduced-motion preferences disable these ambient/idle animations. Standing-figure prompts and hashes are recorded in `dist/assets/standing-figures-provenance.json`.

During Duel Spins, surviving Duel wild reels on both reel 1 and reel 5 trigger Crossfire after their fights. Those two fighters exchange shots and create 2–4 temporary ordinary wilds on available middle-reel positions before payout evaluation. Additional Duel reels do not block it, but cannot be overwritten; a five-wild-reel board has no ordinary targets and skips the empty volley. The feature may repeat on life respins while both outer fighters survive. Shot randomness uses a separate deterministic stream so underlying board/fight draws are preserved. Temporary wilds clear each spin and add no multiplier themselves. God Mode keeps its existing any-two-reels Crossfire rule. The 25,000× total round cap and single charge for a Duel round remain in force.

Duel candidates and weights were regenerated for the new shots. Calibration uses a 0.60 positive-return spread plus a bounded 1.2 log-weight preference for the 2×–5× paid-cost band, while retaining 88% positive returns, approximately 40% recovery of the full spin price, the 2/3/4/5 reel mix, 1% life rounds and approximately 96% RTP. The median remains $39.60 at $1 base / $50 paid cost; returns of at least twice the price are approximately 4.62%. About 67.7% of rounds return half to under twice the price. Other modes retain identical outcome books and weights. `math/crossfire-baseline.json` preserves the 0.7.1 report for comparison; `math/crossfire-comparison.json` records the current change.

### Opaque character cutouts (0.8.0 visual update)

The first character integration used screen blending to hide a black backdrop, which also let scenery show through dark clothing. Dedicated white-silhouette / black-background luminance mattes now remove only the backdrop. The character colours use normal compositing at full opacity on desktop and mobile. Sprite frames maintain the source 2:3 aspect ratio so the mattes track the art during resizing, idle motion and the Outlaw mirror. Artwork pixels and all game math remain unchanged.


### v73 — Full reel face-off and single-shot duels

Qualifying Duel landings now scroll in as a complete top-to-bottom Hunter/Outlaw screen. Its two halves slide apart in 320ms using compositor transforms. Compact Duel symbols, welcome art and the shop use the same artwork; unconnected symbols retain their cell and original math meaning.

Four outcome-specific Higgsfield Seedance 2.5 takes show only the winner drawing and firing once. Boss wins/losses use the gold fighter; Hunter/Outlaw outcomes use the corrected inward-facing cast. The original 1080p sources and one 720p correction are preserved in `art/duel-v73`. Reviewed action is fitted to 256×1280, H.264 Main, 24fps and fast-start MP4. `scripts/build-duel-media.py` records source trims and shot cues.

Prepared video elements are reused between reels instead of fetching blobs and opening a new decoder for each fight. Decode preparation runs during the split, is bounded at 500ms, and a playback stall falls through to the recorded winner. Each duel emits one shot cue. Boss entrance and result pauses are shorter; the normal full reveal/fight/result sequence is approximately 2.6–2.9 seconds instead of 5.9 seconds. This is timeline timing, not a claim of measured device frame rates.

Focused checks cover one-shot playback, decoder reuse, stalls, skips, reel ordering, capped outcomes, life loss, reduced motion, split cleanup and the first actual God Mode bonus spin. The 700ms skipped-spin result hold and God Mode 2× pulse remain in place. Math configuration, outcome pools and settlement code are unchanged. Managed browser QA is unavailable for this buildless static project; source, media and asset checks are used instead.


### v74 — Repair startup artwork failure

The v73 Hunter-loss poster was a zero-byte file despite the frame export command succeeding. Its mandatory image preload rejected and stopped the entire game at startup. Rebuilt that exact first frame as a verified static WebP and changed poster URLs and the affected module graph to bypass cached empty responses.

Combat posters now load through the existing video preloader instead of also being mandatory boot images. The media builder decodes a PNG frame, verifies a static WebP, and replaces the poster atomically. `python scripts/check-startup-art.py` decodes all 28 boot images and combat posters, including both responsive backgrounds; run it before publishing artwork changes. All 28 images decode and the seven media playback checks pass.
