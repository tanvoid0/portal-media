import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ACTIVATE_SIDEBAR_EVENT, isActivateSidebarEvent } from "@/types/app";
import { appNavigate } from "@/nav/appNavigate";
import { useShellOverlayStore } from "@/stores/shellOverlayStore";
import { useNavigationStore } from "@/stores/navigationStore";
import { quickAccessMetaTapEffective } from "@/stores/navBindingsStore";

function isMetaPhysicalKey(e: KeyboardEvent): boolean {
  return (
    e.key === "Meta" ||
    e.key === "OSLeft" ||
    e.key === "OSRight" ||
    e.code === "MetaLeft" ||
    e.code === "MetaRight"
  );
}

export function useAppShellEvents(
  setShowExitModal: (show: boolean) => void,
  handleToggleMaximize: () => void
) {
  useEffect(() => {
    let metaPhysicallyDown = false;
    let metaCombo = false;

    const handleExitRequest = () => {
      setShowExitModal(true);
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        (e.key === "F4" || e.code === "F4")
      ) {
        e.preventDefault();
        void getCurrentWindow().close().catch(console.error);
        return;
      }

      if (isMetaPhysicalKey(e)) {
        metaPhysicallyDown = true;
        metaCombo = false;
        return;
      }
      if (metaPhysicallyDown && e.metaKey && !isMetaPhysicalKey(e)) {
        metaCombo = true;
      }
    };

    const handleGlobalKeyUp = (e: KeyboardEvent) => {
      if (!isMetaPhysicalKey(e)) return;
      if (metaPhysicallyDown && !e.repeat && !metaCombo) {
        if (quickAccessMetaTapEffective()) {
          e.preventDefault();
          useNavigationStore.getState().setInputMethod("keyboard");
          useShellOverlayStore.getState().toggleQuickAccess();
        }
      }
      metaPhysicallyDown = false;
      metaCombo = false;
    };

    const handleWindowBlur = () => {
      metaPhysicallyDown = false;
      metaCombo = false;
    };

    const handleActivateSidebar = (e: Event) => {
      if (!isActivateSidebarEvent(e)) return;
      const index = e.detail;
      const p = window.location.pathname;
      const onSettings = p.startsWith("/settings");
      const onDocs = p.startsWith("/docs");
      if (index === 0) {
        appNavigate("/library/all");
        return;
      }
      if (index === 1) {
        if (onSettings || onDocs) appNavigate("/library/all");
        else appNavigate("/docs");
        return;
      }
      if (index === 2) {
        if (onDocs) appNavigate("/settings/game");
        else if (onSettings) appNavigate("/docs");
        else appNavigate("/settings/game");
        return;
      }
      if (index === 3) {
        handleToggleMaximize();
        return;
      }
      if (index === 4) {
        setShowExitModal(true);
      }
    };

    const handleToggleSettings = () => {
      const onSettings = window.location.pathname.startsWith("/settings");
      if (onSettings) {
        appNavigate("/library/all");
      } else {
        appNavigate("/settings/game");
      }
    };

    window.addEventListener("requestExit", handleExitRequest);
    window.addEventListener(ACTIVATE_SIDEBAR_EVENT, handleActivateSidebar);
    window.addEventListener("toggleSettings", handleToggleSettings);
    window.addEventListener("keydown", handleGlobalKeyDown, true);
    window.addEventListener("keyup", handleGlobalKeyUp, true);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("requestExit", handleExitRequest);
      window.removeEventListener(ACTIVATE_SIDEBAR_EVENT, handleActivateSidebar);
      window.removeEventListener("toggleSettings", handleToggleSettings);
      window.removeEventListener("keydown", handleGlobalKeyDown, true);
      window.removeEventListener("keyup", handleGlobalKeyUp, true);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [setShowExitModal, handleToggleMaximize]);
}
