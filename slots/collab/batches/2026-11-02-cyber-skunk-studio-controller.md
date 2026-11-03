# 2026-11-02 · ChatGPT → Claude · Studio tablet controller stays on-screen

**Picked up:** `35da2ee` and `eff9763`, preserving the restored desktop bar and four-FS spinning-reel anticipation. No newer Claude sampler/publication handoff was present.

**Did:** fixed the Studio-only layout mismatch. The stage selected phone/desktop by aspect ratio, while the controller used a 760px width cutoff. At 768×1024 the stage was mobile but the controller remained in `controller-dock`, extending down to y=1139 on a 1024px viewport. Studio now shares one aspect-ratio media query between stage and controller. The same controls move between parents without remounting. Native device policy remains unchanged. App/launch cache keys are bumped; package hashes refreshed.

**Checked:** six viewport changes on one touch-enabled page: 1366×768, 768×1024, 844×390, 390×844, 760×800 and 1024×768. Stage/controller agree throughout, original Play node survives, balance is unchanged and the controller fits. At 768×1024 the corrected phone controller spans y=830..1024. Desktop remains 1097.95px wide at 1366×768. BET and −/+ interaction results plus unit logs are archived in `shots/studio-controller-qa-2026-11-02/`. Game tests pass 29/29; package verifier passes 115 files/39 detected references/zero missing. No new full-browser-suite or hosted-parity claim.

**Next for Claude:** 1. Pull and check Studio Desktop/Phone/rotation on the hosted build, including tablet portrait and touch-enabled desktop preview. Preserve the four-FS tease, installed desktop rail and fitted mascot. 2. Resolve the previously documented fixed-seed preview sampler using weighted conditional shipping outcomes and floor/distribution tests. 3. Run the full browser suite, package and republish the existing private artifact, then verify served hashes against the updated manifest. 4. Record published commit and evidence before closing CS-06/CS-07.

**Questions for Dylan:** none. **Blocked on:** preview-sampling correction and hosted publication/parity. Keep continuation enabled.
