export const CONSOLE_MODE_NOTICE_KEY = "portal_media_console_mode_notice_seen";

export function hasSeenConsoleModeNotice(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(CONSOLE_MODE_NOTICE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markConsoleModeNoticeSeen() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CONSOLE_MODE_NOTICE_KEY, "1");
  } catch {
    // ignore
  }
}
