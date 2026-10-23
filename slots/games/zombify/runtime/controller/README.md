# Controller

Gamboligy Games Controller v2.7.4, first integrated in Cosmic Clash.

A translucent desktop bar with a round Buy Bonus button outside its left edge when scene-anchored. Balance and Win sit together beside the hamburger menu; open space separates them from the right-hand group of clickable Bet, +/−, Play/Stop and Autoplay. The desktop action group has wider spacing around Play and Autoplay, plus padding at the right edge. Its width defaults to 820 px maximum; a game can set its host width to the cabinet width. Zero wins leave the desktop Win readout clear. Mobile has a compact scene layout: Buy at the left of a larger Play/Stop button on a compact moon-rock plate with round +/− buttons, Menu/Turbo and Sound/Autoplay directly underneath, and Balance/Bet/Win along the bottom. Mobile always shows the WIN amount, including zero. Phone landscape uses a compact row with the extra shortcuts in Settings.

Keep `controller.js`, `controller.css`, `controller-mobile.css`, and `assets/` together. Copy this folder into each game. Open `demo.html` through that game's web server to try it. The mobile panel includes one generated lunar-rock texture, with no package dependencies, audio files, RNG or payout logic; Shadow DOM isolates its styling.

## Integrate

```html
<footer id="controller" aria-label="Game controller"></footer>
<script type="module">
import {mountController} from './controller/controller.js';
const controller = mountController(document.getElementById('controller'), {
  initial: {ready: true, balance: '$10,000.00', bet: '$1.00', win: '$0.00'},
  onAction(action) {
    // Route play, buy, settings, bet, betMinus, betPlus, auto, turbo and sound to the game.
    // bet opens a scrollable stake picker owned by the game.
    // settings opens the game's own menu; keep its existing audio/turbo logic.
    // During busy, play shows Stop and reveals the result; it never starts another round.
    // settings, turbo and sound remain available during rounds, bonuses and autoplay.
    // During autoActive, auto stops the batch after the current round settles.
  }
});
controller.update({busy: true});
controller.update({busy: false, holding: true, win: '$25.00'});
// After the game's required result hold:
controller.update({holding: false});
</script>
```

`update(patch)` merges authoritative game state. Money values are formatted strings. `state` returns a copy; `element(name)` exposes a control for focus or anchoring the game menu. `destroy()` releases click and responsive-layout listeners and content.

| State | Meaning |
| --- | --- |
| `ready` | Assets/session ready to accept play |
| `busy` | Round running; bet and bonus purchases lock; menu, audio and turbo stay available |
| `holding` | Play disabled while displaying a skipped result |
| `continuing` | Play continues a splash or win presentation |
| `autoActive`, `remaining` | Batch status and remaining paid rounds |
| `canDecrease`, `canIncrease` | Bet boundaries |
| `turbo`, `muted` | Current speed and master-mute state, also reflected by the mobile shortcuts |
| `buyActive` | Buy becomes Disable Feature |
| `featureColor` | Active color, e.g. `#ff941f` or `#58e3ee`; `null` resets Play and Bet |
| `banner` | Optional message; Cosmic Clash uses its existing reel status rail |
| `balance`, `bet`, `win` | Currency-formatted values |

Feature colors persist after notices disappear. An autoplay Stop must not cancel a paid round's settlement. Retain the game's skipped-result hold and its behavior of stopping autoplay when opening a menu. Keep keyboard shortcuts outside the component, ignoring buttons/inputs in `event.composedPath()` so Space does not also start a spin when activating another control.

## Separate mobile region

The component selects touch layout at widths up to 760 px, or on touch devices with a coarse pointer and no hover. Desktop uses the single-row account and action bar. When the game's cabinet lives in a height-limited arena, pass separate parent regions so the mobile controller can sit at the bottom of the viewport:

```js
mountController(host, {
  layoutTargets: {
    desktop: document.querySelector('.machine'),
    mobile: document.querySelector('.game')
  },
  onAction: handleControllerAction
});
```

Use a full-height flex column for `.game`, let the arena fill remaining space, and keep the mobile host `flex: none`. The controller moves its existing host on breakpoint changes without replacing its buttons or state. `host.dataset.layout` is `mobile` or `desktop`; scene placement can use it to suppress desktop anchors. With no `layoutTargets`, it changes appearance in its original parent. `layoutMedia` optionally accepts a MediaQueryList for another breakpoint or deterministic tests. Keep that query aligned with the mobile stylesheet's `media` attribute if changing it.

## Optional desktop Buy position

`setBuyAnchor({x, y, size: 88})` places the same Buy button at viewport center `x` and top `y`, at an 88 px diameter by default. Call this after the scene, reels or controller resize. Use `setBuyAnchor(null)` on smaller layouts or when the scene has no room. The button keeps its state, focus and action handler; there is no duplicate.

Cosmic Clash anchors it at the cabinet’s lower-left corner, vertically centered on the bar and just outside the frame. Other games provide their own coordinates. The CSS scene placement applies at desktop sizes (at least 761 × 541).

## Bet picker

The entire BET panel is a button (`element('betPicker')`) with `aria-haspopup="dialog"`. It emits `bet` only when ready and neither a round nor autoplay is active. Position the game's picker above this element, highlight and scroll to the current stake, then apply a valid stake through the game's existing bet setter. Feature modes must label base stake and total spin cost separately. Return focus to the BET panel when a selection closes the picker. Cosmic Clash implements this in its game code; the reusable panel does not own stakes or prices.

## Theme

```css
#controller {
  --controller-accent: #f5bc51;
  --controller-ink: #ffffff;
  /* Optional: replace the bundled mobile lunar-rock surface. */
  /* --controller-mobile-texture: url("/assets/your-material.png"); */
  font-family: 'Your game font', sans-serif;
}
```

## Upgrading from v1

Replace the component folder, including its assets, and bump the import cache key. The panel emits nine actions, including `bet` for the stake picker and `turbo`/`sound` for the mobile shortcuts. Wire both shortcuts to the existing game setters. Desktop retains these settings in its menu. The main busy icon is a square Stop; the action still completes presentation and displays the recorded result. Existing round, feature, money and autoplay state is compatible. The optional Buy anchor accepts a new `size` field. Other games change only when the new folder is installed there.

## Verification

Tests cover disabled actions, Stop/result holds, audio/speed state, autoplay stop, partial state updates, independent mounts, mobile/desktop transitions during paid play, and moving Buy without duplicating its handler or state. The game retains its existing math and settlement. A browser visual preview was unavailable in the buildless Sites environment.

## Mobile material

`assets/moon-rock-v89.png` is an original texture generated with the built-in image generator. Prompt: seamless front-facing lunar basalt in graphite and slate-blue, small varied shallow craters and mineral pits, soft upper-left lighting, restrained hand-painted sci-fi detail, consistent brightness, no text, objects, buttons, rim, neon, or central focal crater. The CSS clips it into the action plate and button faces. The plate and its rim render at 72% opacity so the scene shows through, while button faces and icons keep their full contrast. The center face and inner ring use the active feature color; the Play icon changes to square Stop during a round. Desktop retains its existing flat controller.

## Mobile revision — 18 October 2026

The mobile action plate is removed. Spin is 68–72 px, with separate 44 px bet buttons and a shorter transparent layout to expose the game character. GG Bonus, Menu, Turbo, Sound, Autoplay and all three readouts retain their existing actions. Desktop is unchanged.
