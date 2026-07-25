import { create } from "zustand";
import {
  winlogonShellGetStatus,
  winlogonShellSetEnabled,
  winlogonShellSetRevertOnNextLaunch,
  type WinlogonShellStatus,
} from "@/utils/winlogonShellApi";
import { hasSeenWinlogonShellNotice } from "@/utils/winlogonShellNotice";

interface WinlogonShellStore {
  osSupported: boolean;
  hydrated: boolean;
  configured: boolean;
  sessionStartedAsShell: boolean;
  pendingSignOut: boolean;
  revertOnNextLaunch: boolean;
  revertedThisSession: boolean;
  shellValue: string | null;
  isElevated: boolean;
  companionExplorerRunning: boolean;
  lastError: string | null;
  appliedBootPrefs: boolean;
  confirmModalOpen: boolean;
  refreshFromOs: () => Promise<void>;
  requestEnableShell: () => void;
  closeConfirmModal: () => void;
  confirmEnableShell: () => Promise<void>;
  setWinlogonShell: (enabled: boolean) => Promise<void>;
  setRevertOnNextLaunch: (enabled: boolean) => Promise<void>;
  markBootPrefsApplied: () => void;
}

function applyStatus(set: (partial: Partial<WinlogonShellStore>) => void, status: WinlogonShellStatus) {
  set({
    osSupported: status.supported,
    configured: status.configured,
    sessionStartedAsShell: status.sessionStartedAsShell,
    pendingSignOut: status.pendingSignOut,
    revertOnNextLaunch: status.revertOnNextLaunch,
    revertedThisSession: status.revertedThisSession,
    shellValue: status.shellValue,
    isElevated: status.isElevated,
    companionExplorerRunning: status.companionExplorerRunning,
    hydrated: true,
    lastError: null,
  });
}

export const useWinlogonShellStore = create<WinlogonShellStore>((set, get) => ({
  osSupported: false,
  hydrated: false,
  configured: false,
  sessionStartedAsShell: false,
  pendingSignOut: false,
  revertOnNextLaunch: false,
  revertedThisSession: false,
  shellValue: null,
  isElevated: false,
  companionExplorerRunning: false,
  lastError: null,
  appliedBootPrefs: false,
  confirmModalOpen: false,
  refreshFromOs: async () => {
    const status = await winlogonShellGetStatus();
    if (!status) {
      set({ hydrated: true });
      return;
    }
    applyStatus(set, status);
  },
  requestEnableShell: () => {
    if (hasSeenWinlogonShellNotice()) {
      void get().confirmEnableShell();
      return;
    }
    set({ confirmModalOpen: true });
  },
  closeConfirmModal: () => set({ confirmModalOpen: false }),
  confirmEnableShell: async () => {
    set({ confirmModalOpen: false, lastError: null });
    try {
      await winlogonShellSetEnabled(true);
      await get().refreshFromOs();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ lastError: message });
      throw e;
    }
  },
  setWinlogonShell: async (enabled) => {
    if (enabled) {
      get().requestEnableShell();
      return;
    }
    set({ lastError: null });
    try {
      await winlogonShellSetEnabled(false);
      await get().refreshFromOs();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ lastError: message });
      throw e;
    }
  },
  setRevertOnNextLaunch: async (enabled) => {
    set({ lastError: null });
    try {
      await winlogonShellSetRevertOnNextLaunch(enabled);
      await get().refreshFromOs();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ lastError: message });
      throw e;
    }
  },
  markBootPrefsApplied: () => set({ appliedBootPrefs: true }),
}));
