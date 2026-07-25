export const WINLOGON_SHELL_NOTICE_KEY = "portal_media_winlogon_shell_notice_seen";

export function hasSeenWinlogonShellNotice(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(WINLOGON_SHELL_NOTICE_KEY) === "1";
  } catch {
    return true;
  }
}

export function markWinlogonShellNoticeSeen() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WINLOGON_SHELL_NOTICE_KEY, "1");
  } catch {
    // ignore
  }
}
