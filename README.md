# X Bulk Scheduler

A Chrome (Manifest V3) extension for loading a week of posts at once and
scheduling all of them into **X's own native scheduled-post queue**, using the
X account you're already logged into in Chrome.

The extension only runs while you're scheduling. Once a run says
**"30/30 posts successfully scheduled."**, the posts live in X's queue. You can close
Chrome or shut down the computer, and X publishes each post at its time.

- No X API, no backend, no password. Uses your existing logged-in browser session.
- Everything stays local: drafts go in `chrome.storage.local`, media goes in IndexedDB.
  Media leaves your machine only when it's uploaded into X's composer.
- Posts go through X's normal composer and schedule dialog, one at a time, with
  a check at every step.

---

## Install

A ready-to-load build is included in the **`dist/`** folder, so you don't need to
build anything to use it. Requires Chrome 116+.

### Load the unpacked extension

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select the **`dist/`** folder, the one that directly
   contains `manifest.json`. Don't select the repository's top-level folder: Chrome
   will say "Manifest file is missing".
4. Pin the extension. Clicking its icon opens the dashboard in its own tab.
   (It also opens automatically the first time you install it.)

After you rebuild (`npm run build`), click the reload ↻ icon on the extension card in
`chrome://extensions`, then reload any open x.com tabs.

---

## Using it

### 1. Be logged into X

Log into x.com in the same Chrome profile. The header shows **Current account:
@handle** once an x.com tab has reported it. Click ↻ to re-check. It's also
checked automatically every time you press Schedule All.

> **X display language must be English.** In this version, the "is this really
> scheduled?" checks read X's English UI text. If X is set to another language,
> the run stops with a clear message instead of guessing.

### 2. Batches

A batch is one saved queue, for example *"Gamboligy Oct 1–7"* or *"Dylan Personal Week 1"*.
Use **New batch**, **Batch settings** (name, X account, timezone) and **Delete**
in the header. Drafts are saved automatically. Close the tab whenever you like and
everything will still be there when you come back.

Each batch stores an `accountHandle`. Before scheduling, the extension compares it
with the account that is actually logged in. If they differ, you'll see:

> This batch was created for @Gamboligy but you are currently logged into @DylanGG.

Switch accounts in the X window and press **Continue** (the account is checked again),
or choose **Use @DylanGG instead**. The extension never switches accounts for you.

### 3. Add posts

- **+ Add Post** opens the editor. It has text with a live character count, image/video
  attachments, date and time. The editor also has **Save**, **Delete** and **Duplicate**.
- Click any row's text to edit it. You can edit date and time directly in the table.
- Drag the ⋮⋮ handle to reorder. **Sort by time** sorts the list by date and time.

### 4. Import posts

Click **Import Posts**. You can paste text or load a `.txt` / `.csv` file.

**Plain text.** One post per block, with a blank line between posts:

```
Post number one.

Post number two.
It can span multiple lines.

Post number three.
```

**CSV.** A header row is required. The columns are `text,date,time,media`, and only
`text` is required:

```csv
text,date,time,media
"New game coming this Friday!",2026-10-01,10:30,preview.mp4
"Which bonus would you pick?",2026-10-01,1:15 PM,image.png
"Two images",2026-10-02,18:00,a.jpg;b.jpg
"Text only, schedule later",,,
```

- Dates: `YYYY-MM-DD` is preferred. `Oct 1, 2026` also works. For slash dates like
  `03/04/2026`, pick Month/Day or Day/Month order in the dialog.
- Times: `13:15`, `1:15 PM`, `9am`.
- Media: file names, or paths. Only the file name is used. Separate multiple files with `;`.

**About media paths in CSVs:** Chrome doesn't let extensions read files from disk
paths (it's a security restriction, not a bug). So the import dialog lists the file
names your CSV mentions and asks you to **Select files…** or **Select folder…**.
Files are matched by name, and the dialog shows `matched x/y` so you can see
what's missing.

See `examples/` for sample files.

### 5. Attach media

In the post editor, click **Attach image / video** or drop files onto it.

| Type | Notes |
|------|-------|
| JPG, PNG, WEBP | up to 4 per post |
| GIF | 1 per post, can't be combined with images |
| MP4, MOV | 1 per post, can't be combined with images |

The extension warns about oversized files and long videos (over 2:20 on non-Premium
accounts). X is the final judge: if X rejects a file, that post fails with X's
message. The dashboard shows a thumbnail or the file name for each post.

### 6. Auto Schedule

Click **Auto Schedule** and choose:

- start and end date
- earliest and latest posting time
- minimum gap between posts
- optional maximum posts per day

Posts are assigned **in list order**, so reorder first if the order matters. They're
spread evenly across the days. Times are jittered so they differ from day to day, and
every constraint is still guaranteed. A per-day preview is shown before you apply, and
**↻ Shuffle times** re-rolls it. If the posts can't fit, the tool tells you the maximum
the current settings allow. You can still edit every date and time afterwards.

### 7. Review and Schedule All

Check the table and look for any **Draft** rows (they show why they're not ready).
Then press **Schedule All** and confirm.

What happens:

1. A separate X window opens. Keep the dashboard open next to it.
2. The logged-in account is checked against the batch.
3. For each post, in order:
   1. open the composer
   2. insert the text
   3. upload media and wait for it to finish
   4. open X's schedule dialog
   5. set the date and time
   6. read back and verify them
   7. confirm the dialog
   8. run the **final safety check**
   9. click **Schedule**
   10. wait for X to confirm
4. The progress panel shows `18 / 30`, the current post, the scheduled, failed and
   remaining counts, and the current step. The activity log shows each event.
5. When the run finishes you'll see **"30/30 posts successfully scheduled."**

**Pause** and **Stop** take effect after the current post finishes. A post is never
cut off halfway.

If a post fails, its row turns **Failed** and shows the step and the reason, for
example *"Could not locate Schedule button."* Use **Retry** on the row, or **Retry N
failed**, to re-run only the failed posts. The run stops by itself after 3 failures in
a row, because that usually means X changed its UI.

**Verify in X** opens X's scheduled-posts list and checks that each of this batch's
scheduled posts appears there.

#### Never publishing by accident

The composer's final button is clicked only if **all** of these are true at that moment:

- X's composer shows **"Will send on …"** with exactly the requested date and time.
- The button's label is **"Schedule"**. If it says "Post", the extension refuses to click.
- The text in the composer still matches, and the media is attached.

The schedule dialog is also read back field by field before it's confirmed. If
anything can't be identified with confidence, the post stops, the draft is discarded,
and the post is marked Failed. The extension never clicks nearby buttons as a guess.

Rarely, the X tab might close or navigate *right after* the Schedule click. In that
case the outcome is unknown, so the post is marked **"May be in X"**, and a retry asks
you to check X first so you don't get duplicates.

### Timezones

Each batch has an explicit timezone, shown above the table and in Settings. X's
scheduler always uses **this browser's** timezone. If a batch uses a different one,
times are converted before they're entered into X, and the activity log shows the
converted time along with X's timezone name.

### Dry run (test mode)

Turn on **Dry run** in the header or in Settings. A striped amber banner and the
**Dry Run All** button make it obvious that it's on. A dry run does everything
(text, media upload, schedule dialog, date/time, the final safety check) **except
click Schedule**. It then discards the draft. Each row shows **Dry run ✓/✗**.
Use it:

- the first time you install the extension
- whenever X changes its UI
- before a big batch, as a rehearsal

### Debug mode

Turn on **Debug** to log every automation step, every selector that was tried
(✓ found / ✗ not found), media upload status and the schedule confirmation text.
**Copy** puts the log on your clipboard for troubleshooting. Cookies, tokens and
passwords are never read or logged.

### Settings

Settings are: default earliest and latest times, default minimum gap, default posts
per day, default timezone, character limit (280 standard, 25,000 Premium, or custom),
pause between posts, auto-close of the X window, dry run and debug.

---

## Development

Requirements: Node.js 18+. After changing code, rebuild `dist/` and commit it:

```bash
npm install
npm run build       # type-checks, then builds into dist/
npm run dev         # dashboard UI preview in a normal browser (no X automation)
npm run typecheck
npm test            # unit tests: auto-scheduler, importers, timezones, char count, safety-gate text matching
npm run test:e2e    # builds, loads the extension in headless Chromium against a mock of X
```

The e2e test (`tests/e2e/`) serves a small mock of X's composer instead of x.com. It
covers import, auto schedule, image and chunked video transfer, dry run, a real run,
Verify in X, the "never publish" gate, missing controls, the text-insertion fallback,
account mismatch and Stop. The mock is built from the same assumptions as
`xSelectors.ts`, so it proves the pipeline works, **not** that X's live DOM still
matches. Use a dry run on real X for that.

### Project layout

```
src/
  background/index.ts        service worker (opens the dashboard; intentionally tiny)
  content/
    xSelectors.ts            ALL X selectors + UI text patterns  ← update when X changes
    xAutomation.ts           step helpers: findComposer, enterPostText, attachMedia,
                             openScheduler, setScheduleDate/Time, verifyComposerSchedule,
                             confirmScheduledPost, verifyPostScheduled, discardComposer …
    scheduleFlow.ts          runs one post through the steps, with safety handling
    dom.ts                   generic waitFor / query / click helpers (no X specifics)
    index.ts                 content-script messaging (ping, account, run port)
  dashboard/
    App.tsx, components/     React UI
    engine/runner.ts         sequential queue, pause/stop, retries, verify-in-X
    engine/xTab.ts           automation window + chunked media transfer to the X tab
    store.tsx                state + persistence
  storage/                   chrome.storage.local (settings, batches), IndexedDB (media)
  utils/                     auto-scheduler, importers, timezones, validation, char count
tests/unit, tests/e2e
```

**Architecture:** the dashboard tab runs the queue. For each post it loads
`x.com/compose/post` in the automation window, sends the media (4 MB base64 chunks
over a Port, each one acknowledged), and asks the content script to run one job.
The content script reports each step and returns a result. Nothing depends on the
MV3 service worker staying alive, and nothing keeps running after the run ends.

If X changes its interface, see **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)**.
