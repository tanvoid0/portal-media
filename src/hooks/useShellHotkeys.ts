import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "@tauri-apps/api/core";
import { useConsoleModeStore } from "@/stores/consoleModeStore";
import { useShellOverlayStore } from "@/stores/shellOverlayStore";
import { shellHotkeysSetEnabled } from "@/utils/shellIntegrationApi";

/**
 * Phase 2: OS-level hotkeys (Ctrl+Shift+Tab / Ctrl+Shift+H) that work while a game has focus.
 */
export function useShellHotkeys(opts: { bootDone: boolean }) {
  const globalShellHotkeys = useConsoleModeStore((s) => s.globalShellHotkeys);

  useEffect(() => {
    if (!opts.bootDone || !isTauri()) return;
    void shellHotkeysSetEnabled(globalShellHotkeys).catch(console.error);
  }, [opts.bootDone, globalShellHotkeys]);

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    const unsubs: Array<() => void> = [];

    const setup = async () => {
      const u1 = await listen("shell-hotkey-switcher", () => {
        useShellOverlayStore.getState().toggleAppSwitcher();
      });
      const u2 = await listen("shell-hotkey-guide", () => {
        useShellOverlayStore.getState().toggleQuickAccess();
      });
      if (disposed) {
        u1();
        u2();
        return;
      }
      unsubs.push(u1, u2);
    };

    void setup();
    return () => {
      disposed = true;
      unsubs.forEach((u) => u());
    };
  }, []);
}
