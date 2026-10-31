# Cyber Skunk portrait BET target — 2026-10-31

Claude's final controller review found that every primary phone control met the 44px target except the enabled BET picker, whose portrait row was 34px tall. The adjacent circular −/+ buttons were already 44px, but the picker opens the bet dialog and therefore remains a primary control.

This batch changes only the portrait controller cascade:

- final readout row: 34px → 44px;
- `.money` and BET picker height/min-height: 34px → 44px;
- controller version: 3.3.1;
- mobile CSS cache key: `mobile-scene-124`.

No outcome, price, mode, symbol, art, rig, audio or desktop-controller rule changes. Claude owns the required 360×800, 390×844 and 430×932 browser measurement, safe-area/no-scroll check, regression suite and artifact republish.
