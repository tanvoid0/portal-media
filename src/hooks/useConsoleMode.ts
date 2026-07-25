import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useConsoleModeStore } from "@/stores/consoleModeStore";
import { disableConsoleMode, enableConsoleMode } from "@/utils/consoleModeApi";

/**
 * Applies ADR Phase 1 Console mode after boot: taskbar hide/restore and optional fullscreen.
 */
export function useConsoleMode(opts: {
  bootDone: boolean;
  enterFullscreen: () => Promise<void>;
}) {
  const enabled = useConsoleModeStore((s) => s.enabled);
  const hideTaskbar = useConsoleModeStore((s) => s.hideTaskbar);
  const startFullscreen = useConsoleModeStore((s) => s.startFullscreen);
  const setPrefs = useConsoleModeStore((s) => s.setPrefs);
  const fullscreenApplied = useRef(false);

  useEffect(() => {
    void useConsoleModeStore.getState().refreshFromOs();
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlistenEscape: (() => void) | undefined;

    const setup = async () => {
      const unlistenClose = await getCurrentWindow().onCloseRequested(() => {
        if (enabled && hideTaskbar) {
          void disableConsoleMode();
        }
      });
      unlistenEscape = await listen("console-mode-escape", () => {
        setPrefs({ enabled: false });
        void disableConsoleMode();
      });
      if (disposed) {
        unlistenClose();
        unlistenEscape();
        return;
      }
      return unlistenClose;
    };

    let unlistenClose: (() => void) | undefined;
    void setup().then((fn) => {
      unlistenClose = fn;
    });

    return () => {
      disposed = true;
      unlistenClose?.();
      unlistenEscape?.();
    };
  }, [enabled, hideTaskbar, setPrefs]);

  const { bootDone, enterFullscreen } = opts;

  useEffect(() => {
    if (!bootDone || !isTauri()) return;

    if (!enabled) {
      fullscreenApplied.current = false;
      void disableConsoleMode();
      return;
    }

    if (hideTaskbar) {
      void enableConsoleMode();
    } else {
      void disableConsoleMode();
    }
  }, [bootDone, enabled, hideTaskbar]);

  useEffect(() => {
    if (!bootDone || !isTauri() || !enabled || !startFullscreen) return;
    if (fullscreenApplied.current) return;
    fullscreenApplied.current = true;
    void enterFullscreen();
  }, [bootDone, enabled, startFullscreen, enterFullscreen]);
}

export async function restoreConsoleModeOnExit() {
  const { enabled, hideTaskbar } = useConsoleModeStore.getState();
  if (enabled && hideTaskbar) {
    await disableConsoleMode();
  }
}
