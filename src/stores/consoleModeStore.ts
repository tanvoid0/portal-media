import { create } from "zustand";
import {
  DEFAULT_CONSOLE_MODE_PREFS,
  loadConsoleModePrefs,
  persistConsoleModePrefs,
  type ConsoleModePrefs,
} from "@/utils/consoleModePrefs";
import {
  consoleModeGetStatus,
  consoleModeSetLaunchAtLogin,
} from "@/utils/consoleModeApi";
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@tauri-apps/api/core";
import { hasSeenConsoleModeNotice } from "@/utils/consoleModeNotice";

interface ConsoleModeStore extends ConsoleModePrefs {
  osSupported: boolean;
  focusWatchdogSupported: boolean;
  hydrated: boolean;
  noticeModalOpen: boolean;
  setPrefs: (partial: Partial<ConsoleModePrefs>) => void;
  closeNoticeModal: () => void;
  confirmEnableConsoleMode: () => void;
  refreshFromOs: () => Promise<void>;
}

const initial = loadConsoleModePrefs();

function mergePrefs(get: () => ConsoleModeStore, partial: Partial<ConsoleModePrefs>): ConsoleModePrefs {
  return {
    enabled: get().enabled,
    launchAtLogin: get().launchAtLogin,
    startFullscreen: get().startFullscreen,
    hideTaskbar: get().hideTaskbar,
    globalShellHotkeys: get().globalShellHotkeys,
    focusWatchdog: get().focusWatchdog,
    returnToPortalOnGameExit: get().returnToPortalOnGameExit,
    ...partial,
  };
}

export const useConsoleModeStore = create<ConsoleModeStore>((set, get) => ({
  ...DEFAULT_CONSOLE_MODE_PREFS,
  ...initial,
  osSupported: false,
  focusWatchdogSupported: false,
  hydrated: false,
  noticeModalOpen: false,
  setPrefs: (partial) => {
    if (partial.enabled === true && !get().enabled && !hasSeenConsoleModeNotice()) {
      set({ noticeModalOpen: true });
      return;
    }

    const next = mergePrefs(get, partial);
    persistConsoleModePrefs(next);
    set(next);

    if (Object.prototype.hasOwnProperty.call(partial, "launchAtLogin")) {
      void consoleModeSetLaunchAtLogin(next.launchAtLogin).catch(console.error);
    }
  },
  closeNoticeModal: () => set({ noticeModalOpen: false }),
  confirmEnableConsoleMode: () => {
    const next = mergePrefs(get, { enabled: true });
    persistConsoleModePrefs(next);
    set({ ...next, noticeModalOpen: false });
  },
  refreshFromOs: async () => {
    const status = await consoleModeGetStatus();
    if (!status) {
      set({ hydrated: true });
      return;
    }
    let focusWatchdogSupported = false;
    if (isTauri()) {
      try {
        focusWatchdogSupported = await invoke<boolean>("focus_watchdog_is_supported");
      } catch {
        focusWatchdogSupported = false;
      }
    }
    set({
      osSupported: status.supported,
      focusWatchdogSupported,
      launchAtLogin: status.launchAtLogin,
      hydrated: true,
    });
    const prefs = loadConsoleModePrefs();
    if (prefs.launchAtLogin !== status.launchAtLogin) {
      const merged = { ...prefs, launchAtLogin: status.launchAtLogin };
      persistConsoleModePrefs(merged);
      set(merged);
    }
  },
}));
