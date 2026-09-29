# Troubleshooting

X changes its web app often. The extension is built so that a UI change makes
posts **fail safely with a specific message**. It should never click the wrong
thing. This guide covers how to find what changed and which file to edit.

## First steps for any problem

1. Turn on **Dry run** and **Debug** in the dashboard header.
2. Put 1–2 posts in a test batch and press **Dry Run All**.
3. Watch the X window and the activity log. Debug mode logs every selector that
   was tried:
   ```
   Selector ✗ Schedule button (calendar icon): "[data-testid="scheduleOption"]"
   Selector ✗ Schedule button (calendar icon): "button[aria-label="Schedule post"]"
   Post 1 failed (Opening schedule dialog): Could not locate Schedule button.
   ```
4. Press **Copy** in the log to save it.
5. On x.com, right-click the control that wasn't found, choose **Inspect**, and look
   for a `data-testid`, `aria-label` or `role`.
6. Add the new selector to the **front** of the matching list in
   `src/content/xSelectors.ts`, then `npm run build`, reload the extension in
   `chrome://extensions`, and do the dry run again.

## Files most likely to need maintenance

| File | What's in it | Change it when… |
|------|--------------|-----------------|
| **`src/content/xSelectors.ts`** | Every X selector (`SEL`), every English UI text pattern (`TEXT`), X URLs (`X_URLS`) | A control can't be found, or X renames a label (almost always this file) |
| `src/content/xAutomation.ts` | Step logic: how text is inserted, how the schedule dialog `<select>`s are identified, the safety gate, success detection | X changes *how* a step works, e.g. the date picker stops using `<select>` elements |
| `src/content/scheduleFlow.ts` | Order of steps for one post | X adds or reorders a step (a new confirmation screen, say) |
| `src/dashboard/engine/xTab.ts` | Which URL is loaded for each post; waiting for page load | `x.com/compose/post` stops opening the composer |

Nothing else touches X's DOM.

## Error messages and what to check

| Message | Likely cause | Where to look |
|---------|--------------|---------------|
| *Could not locate the X composer (post text box)* | Not logged in, X didn't load, or the text box selector changed | `SEL.textbox`, `SEL.dialog`, `X_URLS.compose` |
| *Post text could not be entered correctly* | X's editor ignored both the synthetic paste and `insertText` | `enterPostText()` in `xAutomation.ts` |
| *Could not locate the media upload control* | File input selector changed | `SEL.fileInput` |
| *Media upload did not complete within Ns* | Upload stuck, attachment preview selector changed, or the upload-progress selector matches something permanent | `SEL.attachments`, `SEL.attachmentItem`, `SEL.progress`, `countAttachments()` |
| *Media upload failed: "…"* | X rejected the file (type, size, length). The text comes from X's toast. | Check the file. If the error text isn't X's, check `TEXT.uploadError` |
| *X disabled the Post button for this content* | Text over the character limit, or invalid media | Shorten the text, or set the limit in Settings |
| *Could not locate Schedule button.* | Calendar icon selector changed | `SEL.scheduleOption` |
| *The schedule dialog did not open* | The dialog no longer uses `<select>` elements, or it opens slowly | `findScheduleDialog()` |
| *Could not identify the month/day/… selector* | Labels changed | `TEXT.selectLabels` and `classifySelects()` (this also falls back to the shape of each select's options) |
| *The schedule dialog has no year option "2027"* | Date is outside what X offers (about 18 months ahead) | Pick an earlier date |
| *The schedule dialog shows … instead of …* | A field didn't take the value (React re-render) | `setField()` / `setSelectValue()` in `dom.ts` |
| *X would not accept the chosen date/time (Confirm is disabled)* | Time is in the past or too soon | Pick a later time |
| *Could not locate the Confirm button in the schedule dialog* | Confirm selector changed | `SEL.scheduleConfirm`, `TEXT.scheduleConfirmLabel` |
| *The composer does not show a scheduled time ("Will send on …"). Refusing to continue.* | X changed the banner wording or stopped showing it | `TEXT.scheduleBanner`, `findBannerText()` |
| *The composer reads "…", which does not match the requested …* | The date format changed, or the schedule really is wrong | `scheduleTextMatches()` (it has unit tests in `tests/unit/scheduleText.test.ts`) |
| *The submit button says "…" instead of "Schedule". Refusing to click…* | This is the safety gate working: the composer isn't in schedule mode, or X relabelled the button | `TEXT.submitSchedule` / `TEXT.submitPublishNow`. **Never loosen this without a dry run.** |
| *X reported an error: "…"* | X refused the post (duplicate text, rate limit, account restriction) | Read the message. Wait if you're rate-limited. |
| *Could not confirm the post was scheduled…* (row shows **May be in X**) | No success signal within 30 s after clicking | Check X's scheduled list (`x.com/compose/post/unsent/scheduled`) **before** retrying. Maybe also `TEXT.successToast` |
| *X's display language is "…"* | UI text checks assume English | Switch X to English, or localise `TEXT` |
| *The extension could not connect to the X tab* | Content script not injected (x.com opened before the extension was installed or reloaded), or x.com is blocked | Reload the X tab or the extension |
| *Stopped after 3 failures in a row* | Almost always a UI change | Follow **First steps** above |

## How the safety checks work (read before relaxing any of them)

`verifyComposerSchedule()` in `xAutomation.ts` is the only gate before the final
click. It requires all of these:

1. The composer shows **"Will send on …"** matching the exact date, month, year,
   hour, minute and AM/PM.
2. The submit button's label is **"Schedule"** and **not** "Post", "Post all" or "Tweet".
3. The button is enabled, the text still matches, and the media is present.

`confirmScheduledPost()` checks the label once more right before clicking. If X
renames "Schedule", update `TEXT.submitSchedule`. **Don't** remove the check.
Always run a dry run before you change anything in this area.

## Other common issues

- **Current account shows "Not detected".** Open x.com in a tab (logged in) and click ↻.
  Scheduling doesn't depend on this: Schedule All always checks the account in the
  automation window.
- **Times look shifted by an hour or more.** Compare the batch timezone (above the
  table) with the browser timezone shown in Settings. X uses the browser timezone.
  The log line `Post N: scheduling for … (Central European Summer Time)` shows exactly
  what was entered into X.
- **"Media file … is missing from local storage".** The file's blob was cleared (for
  example, browser data was wiped). Re-attach it in the editor.
- **The dashboard was closed mid-run.** Posts that were mid-flight are marked
  Failed / May be in X the next time you open it. Check X's scheduled list, then retry
  what's missing.
- **You changed code but nothing is different.** Run `npm run build`, click reload on
  the extension in `chrome://extensions`, **and** reload open x.com tabs, since content
  scripts don't update in tabs that are already open.

## Testing a selector change without X

`npm run test:e2e` runs the whole pipeline against `tests/e2e/mock-x/index.html`.
If you change how a step works in `xAutomation.ts`, update the mock to match
(it's plain HTML and JS), so the test keeps covering the safety gate. The mock
can't tell you whether real X still matches. Only a dry run on x.com can.
