import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "@tauri-apps/api/core";
import { useConsoleModeStore } from "@/stores/consoleModeStore";
import { useSessionStore } from "@/stores/sessionStore";
import { appNavigate } from "@/nav/appNavigate";
import {
  focusPortalMainWindow,
  focusWatchdogSetEnabled,
  focusWatchdogSyncTrackedPids,
} from "@/utils/shellIntegrationApi";

function trackedGamePids(): number[] {
  return useSessionStore
    .getState()
    .sessions.filter((s) => s.kind === "externalGame" && s.pid && s.pid > 0)
    .map((s) => s.pid as number);
}

/**
 * Phase 2: sync launched game PIDs to Rust; return to Portal when a tracked process exits.
 */
export function useFocusWatchdog(opts: { bootDone: boolean }) {
  const focusWatchdog = useConsoleModeStore((s) => s.focusWatchdog);
  const returnToPortalOnGameExit = useConsoleModeStore((s) => s.returnToPortalOnGameExit);
  const sessions = useSessionStore((s) => s.sessions);

  useEffect(() => {
    if (!opts.bootDone || !isTauri()) return;
    void focusWatchdogSetEnabled(focusWatchdog).catch(console.error);
  }, [opts.bootDone, focusWatchdog]);

  useEffect(() => {
    if (!opts.bootDone || !isTauri() || !focusWatchdog) return;
    void focusWatchdogSyncTrackedPids(trackedGamePids()).catch(console.error);
  }, [opts.bootDone, focusWatchdog, sessions]);

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;

    const setup = async () => {
      const unlisten = await listen<number>("focus-watchdog-tracked-exited", (ev) => {
        const pid = ev.payload;
        if (!pid) return;

        const store = useSessionStore.getState();
        const ended = store.sessions.filter((s) => s.pid === pid);
        for (const s of ended) {
          store.removeSession(s.id);
        }
        void focusWatchdogSyncTrackedPids(trackedGamePids());

        if (!useConsoleModeStore.getState().returnToPortalOnGameExit) return;

        store.upsertLibrarySession();
        void focusPortalMainWindow()
          .then(() => {
            appNavigate("/library/all");
          })
          .catch(console.error);
      });
      if (disposed) unlisten();
      return unlisten;
    };

    let unlisten: (() => void) | undefined;
    void setup().then((fn) => {
      unlisten = fn;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [returnToPortalOnGameExit]);
}
