import { useEffect, useRef } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { useSaveSyncStore } from "@/stores/saveSyncStore";
import { useSessionStore } from "@/stores/sessionStore";
import { isProcessRunning } from "@/utils/shellIntegrationApi";

function trackedGamePids(): number[] {
  return useSessionStore
    .getState()
    .sessions.filter((s) => s.kind === "externalGame" && s.pid && s.pid > 0)
    .map((s) => s.pid as number);
}

/**
 * When enabled, runs smart save sync after a launched game process exits (independent of console focus watchdog).
 */
export function useSaveSyncOnGameExit(opts: { bootDone: boolean }) {
  useEffect(() => {
    if (opts.bootDone) void useSaveSyncStore.getState().refresh();
  }, [opts.bootDone]);

  const enabled = useSaveSyncStore((s) => s.status?.config.enabled);
  const autoSync = useSaveSyncStore((s) => s.status?.config.autoSyncOnExit);
  const connected = useSaveSyncStore((s) => s.status?.connected);
  const sessions = useSessionStore((s) => s.sessions);
  const knownPids = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!opts.bootDone || !isTauri() || !enabled || !autoSync || !connected) {
      knownPids.current = new Set();
      return;
    }

    const tick = async () => {
      const current = new Set(trackedGamePids());
      const prev = knownPids.current;
      for (const pid of prev) {
        if (!current.has(pid)) {
          const alive = await isProcessRunning(pid);
          if (!alive) {
            void useSaveSyncStore.getState().maybeSyncAfterGameExit();
          }
        }
      }
      knownPids.current = current;
    };

    void tick();
    const id = window.setInterval(() => void tick(), 2000);
    return () => window.clearInterval(id);
  }, [opts.bootDone, enabled, autoSync, connected, sessions]);
}
