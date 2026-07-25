export const CONSOLE_MODE_PREFS_KEY = "portal_media_console_mode_prefs";

export interface ConsoleModePrefs {
  /** Living-room shell: hide taskbar and optional auto-fullscreen while Portal runs. */
  enabled: boolean;
  /** Register Portal in HKCU Run (Windows login startup). */
  launchAtLogin: boolean;
  /** Enter Big Picture fullscreen when Console mode applies (after boot splash). */
  startFullscreen: boolean;
  /** Hide Windows taskbar while Console mode is active (not only when Tauri is fullscreen). */
  hideTaskbar: boolean;
  /** Phase 2: Ctrl+Shift+Tab (switcher) and Ctrl+Shift+H (quick access) while another app has focus. */
  globalShellHotkeys: boolean;
  /** Phase 2: watch tracked game PIDs and detect process exit. */
  focusWatchdog: boolean;
  /** Phase 2: return to Portal library when a tracked external game exits. */
  returnToPortalOnGameExit: boolean;
}

export const DEFAULT_CONSOLE_MODE_PREFS: ConsoleModePrefs = {
  enabled: false,
  launchAtLogin: false,
  startFullscreen: true,
  hideTaskbar: true,
  globalShellHotkeys: true,
  focusWatchdog: true,
  returnToPortalOnGameExit: true,
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function loadConsoleModePrefs(): ConsoleModePrefs {
  if (typeof window === "undefined") return { ...DEFAULT_CONSOLE_MODE_PREFS };
  try {
    const raw = localStorage.getItem(CONSOLE_MODE_PREFS_KEY);
    if (!raw) return { ...DEFAULT_CONSOLE_MODE_PREFS };
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return { ...DEFAULT_CONSOLE_MODE_PREFS };
    return {
      enabled: parsed.enabled === true,
      launchAtLogin: parsed.launchAtLogin === true,
      startFullscreen: parsed.startFullscreen !== false,
      hideTaskbar: parsed.hideTaskbar !== false,
      globalShellHotkeys: parsed.globalShellHotkeys !== false,
      focusWatchdog: parsed.focusWatchdog !== false,
      returnToPortalOnGameExit: parsed.returnToPortalOnGameExit !== false,
    };
  } catch {
    return { ...DEFAULT_CONSOLE_MODE_PREFS };
  }
}

export function persistConsoleModePrefs(prefs: ConsoleModePrefs) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CONSOLE_MODE_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}
