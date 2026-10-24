# Studio pass 1 — artwork, text and held scenes

2026-10-24. Continues the existing editor; no game-math or outcome changes.

- Separate hand artwork scaling from the whole hand/text group.
- Typography: font, hex colour, size, alignment; plain wording overrides only on eligible labels. Spin counts, winnings and multipliers stay game-owned.
- Held base game, Regular/Super/Hidden bonus intros/results/counters, Nice/Big/Epic/Max win scenes, and mobile guide cards. Held views are script-free snapshots with sample values. Win artwork uses the existing idle fallback, not an animation playback preview.
- Focused edits flush into history before Ctrl+S, export, undo, scene switching, preview close and pagehide. This fixes the displayed-but-not-yet-committed label edge case.

Verification: focused tests 8/8; unit tests 54/54; Studio/runtime tests 61/61. Browser QA via supported Sites preview: mobile label edit, Save, Undo, Redo and reload; Ctrl+S while textarea focused, then reload; Super and Hidden headings; Nice and Max win renders; base view clears open dialogs; third mobile guide card displays alone; desktop switch. The browser suite was not launched here; Claude should run the full automated browser suite in his environment.

Next review: run browser regressions, test immediate-close recovery on focused fields, rapid switches and imported projects; check live label restoration across bonus intro/result transitions. Then proceed to pass 2 (alignment/reusable presets) and pass 3 (saved versions/game export) after review. Do not recreate the editor or enable API chat.
