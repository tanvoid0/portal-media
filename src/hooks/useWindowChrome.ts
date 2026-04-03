import { useState, useEffect, useCallback } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { applyReasonableWindowedSize } from "@/lib/windowLayout";

export function useWindowChrome() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleToggleMaximize = useCallback(async () => {
    if (!isTauri()) return;
    const appWindow = getCurrentWindow();
    if (await appWindow.isFullscreen()) {
      await appWindow.setFullscreen(false);
      await applyReasonableWindowedSize(appWindow);
    } else {
      if (await appWindow.isMaximized()) {
        await appWindow.unmaximize();
      }
      await appWindow.setFullscreen(true);
    }
    setIsMaximized(await appWindow.isMaximized());
    setIsFullscreen(await appWindow.isFullscreen());
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    const appWindow = getCurrentWindow();

    const syncWindowState = async () => {
      setIsMaximized(await appWindow.isMaximized());
      setIsFullscreen(await appWindow.isFullscreen());
    };

    void syncWindowState();

    const unlistenPromise = appWindow.onResized(() => {
      void syncWindowState();
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  return { isMaximized, isFullscreen, handleToggleMaximize };
}
