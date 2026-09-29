/**
 * ============================================================================
 *  xAutomation.ts - step-level helpers that drive X's native composer.
 * ============================================================================
 *
 * Each exported function performs ONE well-defined step and either succeeds
 * or throws an AutomationError with a human-readable message. None of them
 * ever "guesses": if a control can't be identified confidently, we stop.
 *
 * Safety model (never publish when we meant to schedule):
 *  - The composer's submit button is only clicked by confirmScheduledPost(),
 *    and only after verifyComposerSchedule() confirmed that
 *      a) the composer shows "Will send on <expected date/time>", and
 *      b) the submit button's label is "Schedule" (not "Post").
 *  - In dry-run mode the flow stops before that click and discards the draft.
 *
 * All selectors / UI strings come from xSelectors.ts.
 */
import type { LocalDateTime } from '../types';
import {
  AutomationError,
  alnumKey,
  isDisabled,
  isVisible,
  labelOf,
  normalizeSpaces,
  queryAll,
  queryOne,
  realClick,
  setSelectValue,
  sleep,
  textOf,
  waitFor,
  type Logger,
} from './dom';
import { MONTH_NAMES, SEL, TEXT } from './xSelectors';

const pad2 = (n: number) => String(n).padStart(2, '0');

/* -------------------------------------------------------------------------- */
/* Preflight + account                                                         */
/* -------------------------------------------------------------------------- */

export interface AccountInfo {
  handle: string | null;
  displayName: string | null;
  loggedIn: boolean;
}

/** Reads the logged-in handle from the side navigation. Never touches cookies. */
export function detectAccount(log?: Logger): AccountInfo {
  let handle: string | null = null;
  let displayName: string | null = null;
  const sw = queryOne(SEL.accountSwitcher, document, log, { quiet: !log });
  if (sw) {
    const txt = (sw.innerText || sw.textContent || '').trim();
    const m = /@([A-Za-z0-9_]{1,15})\b/.exec(txt);
    if (m) handle = m[1];
    const first = txt.split('\n').map((s) => s.trim()).filter(Boolean)[0];
    if (first && !first.startsWith('@')) displayName = first;
    if (!handle) {
      const av = queryOne(SEL.avatarContainer, sw, log, { quiet: !log });
      const id = av?.getAttribute('data-testid')?.replace('UserAvatar-Container-', '');
      if (id && /^[A-Za-z0-9_]{1,15}$/.test(id)) handle = id;
    }
  }
  if (!handle) {
    const link = queryOne(SEL.profileLink, document, log, { quiet: !log }) as HTMLAnchorElement | null;
    const m = link ? /^\/([A-Za-z0-9_]{1,15})\/?$/.exec(new URL(link.href, location.href).pathname) : null;
    if (m) handle = m[1];
  }
  const loggedOut = !!queryOne(SEL.loggedOutMarker, document, undefined, { quiet: true });
  return { handle, displayName, loggedIn: !!handle && !loggedOut };
}

/** Refuse to run when we can't trust the UI text checks. */
export function preflight(log: Logger): void {
  const lang = document.documentElement.lang || '';
  log('debug', `Page language: "${lang || 'unknown'}", URL: ${location.pathname}`);
  if (lang && !/^en\b/i.test(lang)) {
    throw new AutomationError(
      `X's display language is "${lang}". This version verifies scheduling using English UI text; ` +
        'switch X to English (Settings → Accessibility, display and languages → Languages) and retry.',
      'preflight',
    );
  }
  const acct = detectAccount(log);
  if (!acct.handle && queryOne(SEL.loggedOutMarker, document, log)) {
    throw new AutomationError('You are not logged into X in this browser. Log in at x.com and retry.', 'preflight');
  }
}

/* -------------------------------------------------------------------------- */
/* Composer                                                                    */
/* -------------------------------------------------------------------------- */

function dialogAncestors(el: Element): HTMLElement[] {
  const out: HTMLElement[] = [];
  let cur: Element | null = el;
  while (cur) {
    const match = SEL.dialog.selectors.map((s) => cur!.closest<HTMLElement>(s)).find(Boolean) ?? null;
    if (!match || out.includes(match)) break;
    out.push(match);
    cur = match.parentElement;
  }
  return out;
}

/**
 * The modal composer's root element (the dialog containing the text box and
 * its submit button). Returns null if no modal composer is open. The inline
 * composer on the home timeline is intentionally ignored.
 */
export function getComposerRoot(log?: Logger): HTMLElement | null {
  const boxes = queryAll(SEL.textbox, document, log, { visibleOnly: true, quiet: !log });
  for (const box of boxes) {
    const dialogs = dialogAncestors(box);
    const withSubmit = dialogs.find((d) => queryOne(SEL.submitButton, d, undefined, { quiet: true }));
    if (withSubmit) return withSubmit;
    if (dialogs.length) return dialogs[dialogs.length - 1];
  }
  return null;
}

function requireComposer(step: string, log?: Logger): HTMLElement {
  const root = getComposerRoot(log);
  if (!root) throw new AutomationError('The X composer is not open (it may have closed unexpectedly).', step);
  return root;
}

export function getTextbox(root: ParentNode, log?: Logger): HTMLElement | null {
  return queryOne(SEL.textbox, root, log, { visibleOnly: true, quiet: !log });
}

export function getSubmitButton(root: ParentNode, log?: Logger): HTMLElement | null {
  return queryOne(SEL.submitButton, root, log, { visibleOnly: true, quiet: !log });
}

/** Wait for the modal composer (opened by loading /compose/post) to be ready. */
export async function findComposer(log: Logger, timeout = 25_000): Promise<HTMLElement> {
  const root = await waitFor(() => getComposerRoot(), {
    timeout,
    step: 'find-composer',
    error: 'Could not locate the X composer (post text box). Is x.com loaded and are you logged in?',
  });
  getComposerRoot(log); // log which selectors matched
  log('debug', 'Composer found.');
  return root;
}

/** Compare the editor's content with the expected text. */
export function textMatches(box: HTMLElement, expected: string): 'exact' | 'loose' | false {
  const actual = box.innerText ?? box.textContent ?? '';
  if (normalizeSpaces(actual) === normalizeSpaces(expected)) return 'exact';
  // Emojis/links can render differently inside the editor; compare letters+digits.
  const a = alnumKey(actual);
  const e = alnumKey(expected);
  if (a === e && (a.length > 0 || normalizeSpaces(actual).length > 0 || !expected.trim())) return 'loose';
  return false;
}

function pasteText(box: HTMLElement, text: string): void {
  const dt = new DataTransfer();
  dt.setData('text/plain', text);
  box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
}

function clearEditor(box: HTMLElement): void {
  box.focus();
  document.execCommand('selectAll', false);
  document.execCommand('delete', false);
}

/**
 * Put the post text into the composer. Strategy 1 is a synthetic paste
 * (handled natively by X's editor, keeps line breaks). Strategy 2 falls
 * back to execCommand('insertText'). Either way, the result is verified.
 */
export async function enterPostText(text: string, log: Logger): Promise<void> {
  const step = 'enter-text';
  const root = requireComposer(step, log);
  const box = getTextbox(root, log);
  if (!box) throw new AutomationError('Could not locate the post text box.', step);
  box.focus();
  realClick(box);
  await sleep(150);

  if (normalizeSpaces(box.innerText || '').length) {
    log('debug', 'Composer already had text; clearing it.');
    clearEditor(box);
    await sleep(200);
    if (normalizeSpaces(box.innerText || '').length) throw new AutomationError('The composer already contained text and could not be cleared.', step);
  }
  if (!text.trim()) {
    log('debug', 'No text for this post (media only).');
    return;
  }

  log('debug', 'Inserting text via paste event.');
  pasteText(box, text);
  let match = await waitFor(() => textMatches(getTextbox(requireComposer(step)) ?? box, text), { timeout: 2000, step, error: 'x' }).catch(() => false as const);

  if (!match) {
    log('debug', 'Paste did not produce the expected text; falling back to insertText.');
    const b = getTextbox(requireComposer(step)) ?? box;
    clearEditor(b);
    await sleep(150);
    b.focus();
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (line) document.execCommand('insertText', false, line);
      if (i < lines.length - 1) document.execCommand('insertParagraph', false);
    });
    match = await waitFor(() => textMatches(getTextbox(requireComposer(step)) ?? b, text), { timeout: 2000, step, error: 'x' }).catch(() => false as const);
  }

  if (!match) {
    const got = normalizeSpaces(getTextbox(requireComposer(step))?.innerText ?? '').slice(0, 60);
    throw new AutomationError(`Post text could not be entered correctly (composer shows "${got}…").`, step);
  }
  log('debug', `Text entered and verified (${match} match).`);
  // Blur so mention/hashtag typeahead popups close.
  (getTextbox(requireComposer(step)) ?? box).blur();
  await sleep(150);
}

/* -------------------------------------------------------------------------- */
/* Media                                                                       */
/* -------------------------------------------------------------------------- */

export function countAttachments(root: ParentNode): number {
  const att = queryOne(SEL.attachments, root, undefined, { quiet: true });
  if (!att) return 0;
  const imgs = new Set(Array.from(att.querySelectorAll<HTMLImageElement>('img[src^="blob:"]')).map((i) => i.src)).size;
  const videos = att.querySelectorAll('video').length;
  const removes = att.querySelectorAll('[aria-label="Remove media"], [data-testid="removeMedia"]').length;
  return Math.max(imgs, videos, removes);
}

function findUploadError(): string | null {
  for (const t of queryAll(SEL.toast, document, undefined, { quiet: true, visibleOnly: true })) {
    const txt = textOf(t);
    if (TEXT.uploadError.test(txt)) return txt;
  }
  return null;
}

/**
 * Attach local files through the composer's own file input (as if the user
 * picked them). Files go one at a time so each attachment can be verified.
 */
export async function attachMedia(files: File[], log: Logger, timeoutMs: number): Promise<void> {
  const step = 'upload-media';
  for (let i = 0; i < files.length; i++) {
    const root = requireComposer(step, log);
    const input = queryOne(SEL.fileInput, root, log) as HTMLInputElement | null;
    if (!input || input.tagName !== 'INPUT') throw new AutomationError('Could not locate the media upload control.', step);
    const before = countAttachments(root);
    const f = files[i];
    log('info', `Uploading ${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)…`);
    const dt = new DataTransfer();
    dt.items.add(f);
    input.files = dt.files;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await waitForMediaUpload(before + 1, timeoutMs, log);
  }
}

/**
 * Wait until `expected` attachments are present, no upload progress is
 * visible and the submit button is enabled again.
 */
export async function waitForMediaUpload(expected: number, timeoutMs: number, log: Logger): Promise<void> {
  const step = 'upload-media';
  const start = Date.now();
  let lastLog = 0;
  let stableSince = 0;
  try {
    await waitFor(
      () => {
        const err = findUploadError();
        if (err) throw new AutomationError(`Media upload failed: "${err}"`, step);
        const root = requireComposer(step);
        const count = countAttachments(root);
        const busy = !!queryOne(SEL.progress, root, undefined, { quiet: true });
        const att = queryOne(SEL.attachments, root, undefined, { quiet: true });
        const busyText = att ? TEXT.uploadBusy.test(textOf(att)) : false;
        const submit = getSubmitButton(root);
        const submitReady = !!submit && !isDisabled(submit);
        if (Date.now() - lastLog > 5000) {
          lastLog = Date.now();
          log('debug', `Upload status: ${count}/${expected} attached, progress=${busy || busyText}, submitEnabled=${submitReady} (${Math.round((Date.now() - start) / 1000)}s)`);
        }
        if (busy || busyText || !submitReady) {
          stableSince = 0;
          return false;
        }
        if (count >= expected) return true;
        // Attachments area exists but items can't be counted (markup changed):
        // accept once it has been idle and enabled for 3s, with a warning.
        if (att) {
          stableSince ||= Date.now();
          if (Date.now() - stableSince > 3000) {
            log('warn', 'Could not count attachment previews (X markup may have changed); upload looks complete.');
            return true;
          }
        }
        return false;
      },
      { timeout: timeoutMs, interval: 250, step, error: `Media upload did not complete within ${Math.round(timeoutMs / 1000)}s.` },
    );
  } catch (e) {
    if (e instanceof AutomationError && e.message.startsWith('Media upload did not complete')) {
      const root = getComposerRoot();
      const count = root ? countAttachments(root) : 0;
      const submit = root ? getSubmitButton(root) : null;
      if (count >= expected && submit && isDisabled(submit)) {
        throw new AutomationError("Media attached but X kept the Post button disabled (media may have been rejected, or the text is too long).", step);
      }
    }
    throw e;
  }
  log('debug', `Media upload complete (${expected} attachment${expected > 1 ? 's' : ''}).`);
}

/** Before scheduling: X must consider the post valid (submit button enabled). */
export function assertPostAccepted(log: Logger): void {
  const step = 'validate';
  const root = requireComposer(step, log);
  const submit = getSubmitButton(root, log);
  if (!submit) throw new AutomationError('Could not locate the composer submit button.', step);
  if (isDisabled(submit)) {
    throw new AutomationError('X disabled the Post button for this content — the text may exceed your character limit, or media is invalid.', step);
  }
}

/* -------------------------------------------------------------------------- */
/* Schedule dialog                                                             */
/* -------------------------------------------------------------------------- */

type Field = 'month' | 'day' | 'year' | 'hour' | 'minute' | 'ampm';
interface ScheduleDialog {
  root: HTMLElement;
  selects: Partial<Record<Field, HTMLSelectElement>>;
}

/** The schedule picker: a dialog containing the month/day/year/hour/minute selects. */
export function findScheduleDialog(): HTMLElement | null {
  const selects = Array.from(document.querySelectorAll<HTMLSelectElement>('select')).filter(isVisible);
  if (selects.length < 3) return null;
  const dialogs = dialogAncestors(selects[0]);
  return dialogs[0] ?? (selects[0].closest('form') as HTMLElement | null) ?? selects[0].parentElement?.parentElement?.parentElement ?? null;
}

function optionsOf(sel: HTMLSelectElement) {
  return Array.from(sel.options).map((o) => ({ value: o.value.trim(), text: normalizeSpaces(o.textContent ?? '') }));
}

/** Identify each <select> by its label, falling back to the shape of its options. */
export function classifySelects(root: HTMLElement, log?: Logger): ScheduleDialog['selects'] {
  const selects = Array.from(root.querySelectorAll<HTMLSelectElement>('select')).filter(isVisible);
  const out: ScheduleDialog['selects'] = {};
  const order: Field[] = ['ampm', 'minute', 'hour', 'month', 'year', 'day'];
  for (const s of selects) {
    const label = labelOf(s);
    const field = order.find((f) => !out[f] && TEXT.selectLabels[f].test(label));
    if (field) {
      out[field] = s;
      log?.('debug', `Schedule select "${label}" → ${field} (by label)`);
    }
  }
  for (const s of selects) {
    if (Object.values(out).includes(s)) continue;
    const opts = optionsOf(s);
    const nums = opts.map((o) => Number(o.value)).filter((n) => Number.isFinite(n));
    const max = Math.max(...nums);
    const min = Math.min(...nums);
    let field: Field | undefined;
    if (opts.some((o) => MONTH_NAMES.some((m) => o.text.toLowerCase().startsWith(m.slice(0, 3).toLowerCase())) && opts.length >= 12)) field = 'month';
    else if (opts.some((o) => /^am$/i.test(o.value) || /^a\.?m\.?$/i.test(o.text)) && opts.some((o) => /^pm$/i.test(o.value) || /^p\.?m\.?$/i.test(o.text))) field = 'ampm';
    else if (nums.length && nums.every((n) => n >= 1970 && n <= 2200)) field = 'year';
    else if (max === 59) field = 'minute';
    else if (max >= 28 && max <= 31 && min >= 1) field = 'day';
    else if ((max === 12 && min >= 0) || (max === 23 && min === 0)) field = 'hour';
    if (field && !out[field]) {
      out[field] = s;
      log?.('debug', `Schedule select #${selects.indexOf(s) + 1} → ${field} (by options)`);
    }
  }
  return out;
}

function requireScheduleDialog(step: string, log?: Logger): ScheduleDialog {
  const root = findScheduleDialog();
  if (!root) throw new AutomationError('The schedule dialog is not open.', step);
  const selects = classifySelects(root, log);
  const missing = (['month', 'day', 'year', 'hour', 'minute'] as Field[]).filter((f) => !selects[f]);
  if (missing.length) throw new AutomationError(`Could not identify the ${missing.join('/')} selector in the schedule dialog.`, step);
  return { root, selects };
}

/** Candidate option values/texts for a field. */
function candidates(field: Field, when: LocalDateTime, twelveHour: boolean): string[] {
  const h12 = when.hour % 12 === 0 ? 12 : when.hour % 12;
  switch (field) {
    case 'month':
      return [String(when.month), pad2(when.month), MONTH_NAMES[when.month - 1], MONTH_NAMES[when.month - 1].slice(0, 3)];
    case 'day':
      return [String(when.day), pad2(when.day)];
    case 'year':
      return [String(when.year)];
    case 'hour':
      return twelveHour ? [String(h12), pad2(h12)] : [String(when.hour), pad2(when.hour)];
    case 'minute':
      return [String(when.minute), pad2(when.minute)];
    case 'ampm':
      return when.hour < 12 ? ['AM', 'A.M.', 'am', 'a.m.'] : ['PM', 'P.M.', 'pm', 'p.m.'];
  }
}

function pickOption(sel: HTMLSelectElement, cands: string[]): HTMLOptionElement | null {
  const lc = cands.map((c) => c.toLowerCase());
  const opts = Array.from(sel.options);
  return (
    opts.find((o) => lc.includes(o.value.trim().toLowerCase())) ??
    opts.find((o) => lc.includes(normalizeSpaces(o.textContent ?? '').toLowerCase())) ??
    null
  );
}

async function setField(field: Field, when: LocalDateTime, step: string, log: Logger): Promise<void> {
  // Re-query every time: React may re-render the selects after each change.
  const dlg = requireScheduleDialog(step);
  const sel = dlg.selects[field];
  if (!sel) {
    if (field === 'ampm') return; // 24-hour clock UI
    throw new AutomationError(`Could not locate the ${field} selector in the schedule dialog.`, step);
  }
  const twelveHour = !!dlg.selects.ampm;
  const cands = candidates(field, when, twelveHour);
  const opt = pickOption(sel, cands);
  if (!opt) throw new AutomationError(`The schedule dialog has no ${field} option "${cands[0]}".`, step);
  setSelectValue(sel, opt.value);
  await sleep(120);
  const after = requireScheduleDialog(step).selects[field];
  if (!after || after.value !== opt.value) throw new AutomationError(`Could not set ${field} to "${cands[0]}" in the schedule dialog.`, step);
  log('debug', `Set ${field} = ${opt.value}`);
}

/** Click the calendar icon and wait for the schedule dialog. */
export async function openScheduler(log: Logger): Promise<void> {
  const step = 'open-scheduler';
  const root = requireComposer(step, log);
  const btn = queryOne(SEL.scheduleOption, root, log, { visibleOnly: true });
  if (!btn) throw new AutomationError('Could not locate Schedule button.', step);
  if (isDisabled(btn)) throw new AutomationError('The Schedule button is disabled in the composer.', step);
  realClick(btn);
  await waitFor(() => findScheduleDialog(), { timeout: 10_000, step, error: 'The schedule dialog did not open after clicking the Schedule button.' });
  requireScheduleDialog(step, log);
  log('debug', 'Schedule dialog open.');
}

export async function setScheduleDate(when: LocalDateTime, log: Logger): Promise<void> {
  // Year → month → day: the day list depends on the month.
  for (const f of ['year', 'month', 'day'] as Field[]) await setField(f, when, 'set-date', log);
}

export async function setScheduleTime(when: LocalDateTime, log: Logger): Promise<void> {
  for (const f of ['hour', 'minute', 'ampm'] as Field[]) await setField(f, when, 'set-time', log);
}

function readSelected(field: Field, sel: HTMLSelectElement | undefined): number | string | null {
  if (!sel) return null;
  const opt = sel.options[sel.selectedIndex];
  if (!opt) return null;
  const v = opt.value.trim();
  const t = normalizeSpaces(opt.textContent ?? '');
  if (field === 'ampm') return /^p/i.test(v) || /^p/i.test(t) ? 'PM' : 'AM';
  if (field === 'month' && !/^\d+$/.test(v)) {
    const i = MONTH_NAMES.findIndex((m) => t.toLowerCase().startsWith(m.slice(0, 3).toLowerCase()));
    return i >= 0 ? i + 1 : null;
  }
  const n = Number(/^\d+$/.test(v) ? v : t);
  return Number.isFinite(n) ? n : null;
}

/** Read back every select and verify it equals the requested date/time. */
export function verifyScheduleDialog(when: LocalDateTime, log: Logger): void {
  const step = 'verify-date';
  const { root, selects } = requireScheduleDialog(step);
  const twelve = !!selects.ampm;
  const hour = readSelected('hour', selects.hour) as number;
  const ampm = readSelected('ampm', selects.ampm);
  const hour24 = twelve ? (hour % 12) + (ampm === 'PM' ? 12 : 0) : hour;
  const got = {
    year: readSelected('year', selects.year),
    month: readSelected('month', selects.month),
    day: readSelected('day', selects.day),
    hour: hour24,
    minute: readSelected('minute', selects.minute),
  };
  const ok = got.year === when.year && got.month === when.month && got.day === when.day && got.hour === when.hour && got.minute === when.minute;
  log('debug', `Schedule dialog shows ${JSON.stringify(got)}; expected ${JSON.stringify(when)}`);
  if (!ok) throw new AutomationError(`The schedule dialog shows ${fmt(got)} instead of ${fmt(when)}.`, step);
  const preview = findBannerText(root);
  if (preview) {
    log('debug', `Schedule dialog preview: "${preview}"`);
    if (!scheduleTextMatches(preview, when)) throw new AutomationError(`The schedule dialog preview reads "${preview}", which does not match ${fmt(when)}.`, step);
  }
}

function fmt(w: { year: unknown; month: unknown; day: unknown; hour: unknown; minute: unknown }): string {
  return `${w.year}-${pad2(Number(w.month))}-${pad2(Number(w.day))} ${pad2(Number(w.hour))}:${pad2(Number(w.minute))}`;
}

/** Text near "Will send on …" inside a container, or null. */
export function findBannerText(root: HTMLElement): string | null {
  const lines = (root.innerText || '').split('\n').map(normalizeSpaces).filter(Boolean);
  const i = lines.findIndex((l) => TEXT.scheduleBanner.test(l));
  if (i < 0) return null;
  let line = lines[i];
  if (/will send on\s*$/i.test(line) && lines[i + 1]) line += ' ' + lines[i + 1];
  return line;
}

/**
 * Does a banner like "Will send on Wed, Oct 1, 2025 at 10:30 AM" describe
 * exactly the requested date and time? Accepts US and UK day/month order and
 * 12h or 24h clocks.
 */
export function scheduleTextMatches(text: string, when: LocalDateTime): boolean {
  const t = normalizeSpaces(text);
  const month = MONTH_NAMES[when.month - 1];
  const monthRe = `(?:${month}|${month.slice(0, 3)}\\.?)`;
  const dateOk = new RegExp(`\\b${monthRe}\\s+0?${when.day}\\b`, 'i').test(t) || new RegExp(`\\b0?${when.day}\\s+${monthRe}(?![a-z])`, 'i').test(t);
  const years = t.match(/\b(19|20|21)\d{2}\b/g) ?? [];
  const yearOk = years.length ? years.every((y) => Number(y) === when.year) : when.year === new Date().getFullYear();
  const h12 = when.hour % 12 === 0 ? 12 : when.hour % 12;
  const ap = when.hour < 12 ? 'A\\.?M\\.?' : 'P\\.?M\\.?';
  const hasMeridiem = /\b[AP]\.?M\.?(?![a-z])/i.test(t);
  const timeOk = hasMeridiem
    ? new RegExp(`\\b0?${h12}:${pad2(when.minute)}\\s*${ap}`, 'i').test(t)
    : new RegExp(`\\b0?${when.hour}:${pad2(when.minute)}\\b`).test(t);
  return dateOk && yearOk && timeOk;
}

/** Click the schedule dialog's Confirm button and wait to return to the composer. */
export async function confirmScheduleDialog(log: Logger): Promise<void> {
  const step = 'confirm-date';
  const { root } = requireScheduleDialog(step);
  let btn = queryOne(SEL.scheduleConfirm, root, log, { visibleOnly: true });
  if (!btn) {
    const byText = Array.from(root.querySelectorAll<HTMLElement>('button, [role="button"]')).filter((b) => isVisible(b) && TEXT.scheduleConfirmLabel.test(textOf(b)));
    if (byText.length === 1) {
      btn = byText[0];
      log('debug', 'Schedule Confirm button found by its label text.');
    }
  }
  if (!btn) throw new AutomationError('Could not locate the Confirm button in the schedule dialog.', step);
  if (isDisabled(btn)) {
    const msg = normalizeSpaces(root.innerText || '').slice(0, 160);
    throw new AutomationError(`X would not accept the chosen date/time (Confirm is disabled). Dialog says: "${msg}"`, step);
  }
  realClick(btn);
  await waitFor(() => !findScheduleDialog() && getComposerRoot(), {
    timeout: 10_000,
    step,
    error: 'The schedule dialog did not close after Confirm.',
  });
  log('debug', 'Schedule dialog confirmed; back in the composer.');
}

/* -------------------------------------------------------------------------- */
/* Final safety gate + submit                                                  */
/* -------------------------------------------------------------------------- */

/**
 * THE SAFETY GATE. Returns the submit button only if the composer is
 * verifiably set to schedule at the requested time. Throws otherwise.
 */
export async function verifyComposerSchedule(when: LocalDateTime, text: string, mediaCount: number, log: Logger): Promise<{ submit: HTMLElement; banner: string }> {
  const step = 'verify-composer';
  const banner = await waitFor(() => {
    const root = getComposerRoot();
    return root ? findBannerText(root) : null;
  }, { timeout: 6000, step, error: 'The composer does not show a scheduled time ("Will send on …"). Refusing to continue.' });
  log('debug', `Composer banner: "${banner}"`);
  if (!scheduleTextMatches(banner, when)) {
    throw new AutomationError(`The composer reads "${banner}", which does not match the requested ${fmt(when)}. Refusing to continue.`, step);
  }
  const root = requireComposer(step, log);
  const submit = getSubmitButton(root, log);
  if (!submit) throw new AutomationError('Could not locate the Schedule (submit) button.', step);
  const label = textOf(submit);
  log('debug', `Submit button label: "${label}"`);
  if (TEXT.submitPublishNow.test(label) || !TEXT.submitSchedule.test(label)) {
    throw new AutomationError(`The submit button says "${label}" instead of "Schedule". Refusing to click so nothing is published immediately.`, step);
  }
  if (isDisabled(submit)) throw new AutomationError('The Schedule button is disabled (X rejected the post content).', step);
  const box = getTextbox(root);
  if (text.trim() && (!box || !textMatches(box, text))) throw new AutomationError('The post text in the composer no longer matches. Refusing to continue.', step);
  if (mediaCount && countAttachments(root) < mediaCount && !queryOne(SEL.attachments, root, undefined, { quiet: true })) {
    throw new AutomationError('The media attachment is missing from the composer. Refusing to continue.', step);
  }
  return { submit, banner };
}

/** Clicks the verified "Schedule" button. Label is re-checked at the last moment. */
export function confirmScheduledPost(submit: HTMLElement, log: Logger): void {
  const label = textOf(submit);
  if (!submit.isConnected || !TEXT.submitSchedule.test(label) || isDisabled(submit)) {
    throw new AutomationError(`Schedule button changed before clicking (label "${label}"). Aborted without clicking.`, 'schedule');
  }
  log('debug', 'Clicking "Schedule".');
  submit.click();
}

function visibleToastTexts(): string[] {
  return queryAll(SEL.toast, document, undefined, { quiet: true, visibleOnly: true }).map(textOf).filter(Boolean);
}

export function snapshotToasts(): Set<string> {
  return new Set(visibleToastTexts());
}

/**
 * After clicking Schedule: success = X's "will be sent" toast, or the
 * composer closing with no error. An error toast = failure. No outcome in
 * 30s = uncertain failure (the post may or may not exist).
 */
export async function verifyPostScheduled(log: Logger, ignoreToasts: Set<string>, timeout = 30_000): Promise<string> {
  const step = 'verify-scheduled';
  const start = Date.now();
  let closedAt = 0;
  while (Date.now() - start < timeout) {
    for (const t of visibleToastTexts()) {
      if (ignoreToasts.has(t)) continue;
      if (TEXT.successToast.test(t)) {
        log('debug', `Success toast: "${t}"`);
        return t;
      }
      if (TEXT.errorToast.test(t)) throw new AutomationError(`X reported an error: "${t}"`, step, false);
    }
    if (!getComposerRoot()) {
      closedAt ||= Date.now();
      if (Date.now() - closedAt > 2500) return 'Composer closed after Schedule (no error shown).';
    }
    await sleep(100);
  }
  throw new AutomationError("Could not confirm the post was scheduled (the composer didn't close within 30s). Check X's scheduled posts before retrying.", step, true);
}

/* -------------------------------------------------------------------------- */
/* Cleanup                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Close open dialogs and discard the draft. Only ever clicks "Close" and
 * "Discard" - neither can publish anything.
 */
export async function discardComposer(log: Logger): Promise<boolean> {
  for (let i = 0; i < 5; i++) {
    const sheetBtn = queryAll(SEL.sheetButtons, document, undefined, { quiet: true, visibleOnly: true }).find((b) => TEXT.discard.test(textOf(b)));
    if (sheetBtn) {
      log('debug', 'Clicking "Discard".');
      realClick(sheetBtn);
      await sleep(500);
      continue;
    }
    const dialogs = queryAll(SEL.dialog, document, undefined, { quiet: true, visibleOnly: true });
    if (!dialogs.length || (!getComposerRoot() && !findScheduleDialog())) return true;
    const top = findScheduleDialog() ?? dialogs[dialogs.length - 1];
    const close = queryOne(SEL.closeButton, top, log, { visibleOnly: true });
    if (!close) {
      log('warn', 'Could not find a Close button to discard the draft.');
      return false;
    }
    realClick(close);
    await sleep(600);
  }
  return !getComposerRoot();
}

/* -------------------------------------------------------------------------- */
/* Scheduled list (post-run verification)                                      */
/* -------------------------------------------------------------------------- */

function scrollableIn(root: HTMLElement): HTMLElement | null {
  const all = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
  return (
    all.find((el) => {
      const s = getComputedStyle(el);
      return /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 10;
    }) ?? null
  );
}

/** Scroll X's scheduled-posts list and collect its text (for cross-checking). */
export async function readScheduledList(log: Logger): Promise<{ texts: string[]; itemCount: number }> {
  const step = 'read-scheduled';
  const root = await waitFor(
    () => {
      const dialogs = queryAll(SEL.dialog, document, undefined, { quiet: true, visibleOnly: true });
      return dialogs.find((d) => TEXT.scheduleBanner.test(d.innerText) || TEXT.emptyScheduledList.test(d.innerText)) ?? null;
    },
    { timeout: 20_000, step, error: "Could not open X's scheduled posts list." },
  );
  if (TEXT.emptyScheduledList.test(root.innerText) && !TEXT.scheduleBanner.test(root.innerText)) return { texts: [], itemCount: 0 };
  const texts = new Set<string>();
  const scroller = scrollableIn(root);
  // Let X lazy-load the whole list before scraping.
  for (let i = 0; i < 80; i++) {
    const lines = (root.innerText || '').split('\n').map(normalizeSpaces).filter(Boolean);
    lines.forEach((l) => texts.add(l));
    const s = scroller ?? document.scrollingElement;
    if (!s) break;
    const before = s.scrollTop;
    s.scrollTop = before + Math.max(200, s.clientHeight * 0.8);
    await sleep(500);
    if (Math.abs(s.scrollTop - before) < 2) break;
  }
  const itemCount = Array.from(texts).filter((l) => TEXT.scheduleBanner.test(l)).length;
  log('debug', `Scheduled list: ${texts.size} text lines, ~${itemCount} "Will send on" entries.`);
  return { texts: Array.from(texts), itemCount };
}
