# Wall fan behind the skunk (2026-11-09)

Commit `d977c54`, published as version 30 of the private playable.

- `stinger-desktop-sheet.jpg` (1366×768) and `stinger-phone-sheet.jpg` (390×844) show Vent Break preview stinger frames at 0, 0.4, 0.9, 1.3, 1.7, 2.1, 2.6 and 3.2 s after the dialog opens. The fan turns on the wall behind her, lifts as the main jet starts and fills the gust position, then shows the bonus briefing. There were no page errors.
- `browser-tests-run1.txt` covers all 11 Cyber Skunk browser files. 70 cases pass. Case 1 failed on a hard-coded old cache key; the test now reads the key from `index.html`. The run hit a 25-minute timeout before the last case.
- `browser-tests-run2.txt` reruns the 4 artifact cases and the remaining case: 6/6 pass.
