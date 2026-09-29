/**
 * ============================================================================
 *  xSelectors.ts - EVERY X/Twitter-specific selector and UI text pattern.
 * ============================================================================
 *
 * When X changes its frontend, this is the first (and usually only) file to
 * update. Each entry lists selectors in priority order:
 *   1. stable `data-testid` attributes
 *   2. ARIA roles / accessible labels
 *   3. semantic fallbacks
 * Fragile structural paths (div:nth-child(3) > div ...) are deliberately NOT
 * used anywhere.
 *
 * Use the extension's Debug mode + Dry run to see which selector matched
 * (or which one failed) in the activity log.
 *
 * Text patterns assume X's display language is English. The automation
 * refuses to run in another language rather than guess (see preflight in
 * xAutomation.ts).
 */

export interface SelectorSpec {
  /** Human readable name used in logs and error messages. */
  name: string;
  /** CSS selectors, tried in order. The first one that yields a match wins. */
  selectors: string[];
}

export const SEL = {
  /** A modal dialog layer. The composer and the schedule picker are both dialogs. */
  dialog: {
    name: 'dialog',
    selectors: ['[role="dialog"][aria-modal="true"]', '[aria-modal="true"]', '[role="dialog"]'],
  },

  /** The post text editor (contenteditable). `_0` is the first post of a thread. */
  textbox: {
    name: 'post text box',
    selectors: [
      '[data-testid="tweetTextarea_0"][contenteditable="true"]',
      '[data-testid="tweetTextarea_0"]',
      '[data-testid^="tweetTextarea_"][role="textbox"]',
      'div[role="textbox"][contenteditable="true"][aria-multiline="true"]',
    ],
  },

  /** Hidden <input type=file> used by the composer's media button. */
  fileInput: {
    name: 'media file input',
    selectors: ['input[data-testid="fileInput"]', 'input[type="file"][accept*="image"]', 'input[type="file"][accept*="video"]'],
  },

  /** Attachment preview area shown after media is added. */
  attachments: {
    name: 'media attachments',
    selectors: ['[data-testid="attachments"]'],
  },

  /** Elements that indicate one attached media item (counted to verify uploads). */
  attachmentItem: {
    name: 'attachment item',
    selectors: [
      '[data-testid="attachments"] img[src^="blob:"]',
      '[data-testid="attachments"] video',
      '[data-testid="attachments"] [aria-label="Remove media"]',
    ],
  },

  /**
   * In-progress upload/processing indicator. Scoped to the attachments area on
   * purpose: X's character counter is ALSO a role="progressbar".
   */
  progress: {
    name: 'upload progress indicator',
    selectors: ['[data-testid="attachments"] [role="progressbar"]', '[data-testid="attachments"] [data-testid="progressBar"]'],
  },

  /** Calendar icon in the composer toolbar that opens the schedule picker. */
  scheduleOption: {
    name: 'Schedule button (calendar icon)',
    selectors: ['[data-testid="scheduleOption"]', 'button[aria-label="Schedule post"]', '[role="button"][aria-label="Schedule post"]'],
  },

  /** "Confirm" button inside the schedule picker dialog. */
  scheduleConfirm: {
    name: 'schedule dialog Confirm button',
    selectors: ['[data-testid="scheduledConfirmationPrimaryAction"]'],
  },

  /**
   * The composer's final submit button. Its label reads "Post" normally and
   * "Schedule" once a schedule time is set. We ONLY click it after verifying
   * the label says "Schedule" (see TEXT.submitSchedule).
   */
  submitButton: {
    name: 'composer submit button',
    selectors: ['[data-testid="tweetButton"]', '[data-testid="tweetButtonInline"]'],
  },

  /** Toast / alert notifications ("Your post will be sent on ..."). */
  toast: {
    name: 'toast notification',
    selectors: ['[data-testid="toast"]', '[role="alert"]'],
  },

  /** Close (X) button of a dialog. */
  closeButton: {
    name: 'dialog Close button',
    selectors: ['[data-testid="app-bar-close"]', 'button[aria-label="Close"]', '[role="button"][aria-label="Close"]'],
  },

  /** Buttons inside the "Save post?" confirmation sheet. */
  sheetButtons: {
    name: 'confirmation sheet buttons',
    selectors: ['[data-testid="confirmationSheetCancel"]', '[data-testid="confirmationSheetConfirm"]', '[role="alertdialog"] [role="button"]', '[role="alertdialog"] button'],
  },

  /** Account detection. */
  accountSwitcher: {
    name: 'account switcher',
    selectors: ['[data-testid="SideNav_AccountSwitcher_Button"]'],
  },
  profileLink: {
    name: 'profile link',
    selectors: ['a[data-testid="AppTabBar_Profile_Link"]'],
  },
  /** Avatar container whose testid ends with the handle (inside the switcher). */
  avatarContainer: {
    name: 'avatar container',
    selectors: ['[data-testid^="UserAvatar-Container-"]'],
  },
  loggedOutMarker: {
    name: 'logged-out marker',
    selectors: ['[data-testid="loginButton"]', '[data-testid="login"]', 'a[href="/login"][role="link"]'],
  },
} satisfies Record<string, SelectorSpec>;

/** English UI text patterns. */
export const TEXT = {
  /** Composer banner / schedule dialog preview, e.g. "Will send on Wed, Oct 1, 2025 at 10:30 AM". */
  scheduleBanner: /will send on/i,
  /** Submit button label when a schedule is set. */
  submitSchedule: /^\s*schedule\s*$/i,
  /** Submit button labels that mean "publish now" - never clicked. */
  submitPublishNow: /^\s*(post|post all|tweet|tweet all|reply)\s*$/i,
  scheduleConfirmLabel: /^\s*confirm\s*$/i,
  successToast: /(will be sent|will send on|has been scheduled|post scheduled|scheduled for)/i,
  errorToast: /(something went wrong|try again|went wrong|error|failed|couldn.t|could not|can.t|cannot|already said that|not allowed|limit|suspended|locked)/i,
  uploadError: /(upload failed|couldn.t upload|could not upload|unable to upload|file type|too large|not supported|unsupported|some of your media failed)/i,
  uploadBusy: /(uploading|processing|\d+%)/i,
  discard: /^\s*discard\s*$/i,
  emptyScheduledList: /(don.t have any|no scheduled|nothing scheduled|will show up here)/i,
  /** Labels used to classify the schedule dialog's <select> elements. */
  selectLabels: {
    month: /month/i,
    day: /^\s*day\s*$/i,
    year: /year/i,
    hour: /hour/i,
    minute: /minute/i,
    ampm: /(am\s*\/\s*pm|period|meridiem)/i,
  },
};

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const X_URLS = {
  /** Opening this URL shows the modal composer over the home timeline. */
  compose: 'https://x.com/compose/post',
  /** X's list of scheduled (unsent) posts. */
  scheduledList: 'https://x.com/compose/post/unsent/scheduled',
  home: 'https://x.com/home',
};
