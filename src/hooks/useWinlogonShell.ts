import { useEffect } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { useConsoleModeStore } from "@/stores/consoleModeStore";
import { useWinlogonShellStore } from "@/stores/winlogonShellStore";

/**
 * When Portal is the active Winlogon shell session, apply living-room defaults once after boot.
 */
export function useWinlogonShell(opts: { bootDone: boolean }) {
  const sessionStartedAsShell = useWinlogonShellStore((s) => s.sessionStartedAsShell);
  const appliedBootPrefs = useWinlogonShellStore((s) => s.appliedBootPrefs);
  const markBootPrefsApplied = useWinlogonShellStore((s) => s.markBootPrefsApplied);
  const refreshFromOs = useWinlogonShellStore((s) => s.refreshFromOs);
  const setPrefs = useConsoleModeStore((s) => s.setPrefs);

  useEffect(() => {
    void refreshFromOs();
  }, [refreshFromOs]);

  useEffect(() => {
    if (!opts.bootDone || !isTauri() || !sessionStartedAsShell || appliedBootPrefs) {
      return;
    }
    setPrefs({
      enabled: true,
      hideTaskbar: true,
      startFullscreen: true,
      launchAtLogin: false,
    });
    markBootPrefsApplied();
  }, [
    opts.bootDone,
    sessionStartedAsShell,
    appliedBootPrefs,
    setPrefs,
    markBootPrefsApplied,
  ]);
}
