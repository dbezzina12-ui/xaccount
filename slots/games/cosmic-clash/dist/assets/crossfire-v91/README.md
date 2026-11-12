# Crossfire artwork and animation cues

Original artwork generated with the built-in image generator for Cosmic Clash.

- `vs-fire.png`: preserves the split gold/blue metal VS frame and hinges; removes the inner DUEL emblem and fills the VS window with red fire. Used by both landed symbols and the hinged doors.
- `pistol.png`: 1536 × 1024, transparent side-view revolver aiming right, based on the existing cyan premium gun. No baked motion. Source muzzle is at 97.2% x / 32.6% y; barrel pivot at 26% x / 32.6% y.

`crossfire-presentation.js` consumes the recorded placements. It owns mobile entrance, aim, recoil and exit, and emits one impact per placement. Skip completes the remaining recorded placements without more shots; a canceled intro does not keep placing wilds.

For future desktop character animation, listen on `#game` for `cosmic:crossfire-shot`. Its detail contains `actor` (`hunter` or `outlaw`), `sourceReel`, `placement` (`reel`, `row`), `target` (x/y in game-local pixels), and `mobile`. Ignore mobile cues when connecting a desktop Spine character. Synchronize the character's muzzle/fire pose to this cue; it must never choose or modify an outcome. Full character animation is not implemented yet.

The intro runs three independent examples: connected VS → hinged reveal → duel winner; three-life Super reel → challenger victory → two lives → persistent reel; immortal God Mode reels → 2× pulses → Crossfire placements. Only visible demos animate. Closing or hiding the intro cancels their effects.
