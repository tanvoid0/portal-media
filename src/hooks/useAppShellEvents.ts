import { useEffect } from "react";
import { ACTIVATE_SIDEBAR_EVENT, isActivateSidebarEvent } from "@/types/app";
import { appNavigate } from "@/nav/appNavigate";

export function useAppShellEvents(
  setShowExitModal: (show: boolean) => void,
  handleToggleMaximize: () => void
) {
  useEffect(() => {
    const handleExitRequest = () => {
      setShowExitModal(true);
    };

    const handleActivateSidebar = (e: Event) => {
      if (!isActivateSidebarEvent(e)) return;
      const index = e.detail;
      const onSettings = window.location.pathname.startsWith("/settings");
      if (index === 0) {
        appNavigate("/");
      } else if (index === 1) {
        if (onSettings) {
          appNavigate("/");
        } else {
          appNavigate("/settings/game");
        }
      } else if (index === 2) {
        handleToggleMaximize();
      } else if (index === 3) {
        setShowExitModal(true);
      }
    };

    const handleToggleSettings = () => {
      const onSettings = window.location.pathname.startsWith("/settings");
      if (onSettings) {
        appNavigate("/");
      } else {
        appNavigate("/settings/game");
      }
    };

    window.addEventListener("requestExit", handleExitRequest);
    window.addEventListener(ACTIVATE_SIDEBAR_EVENT, handleActivateSidebar);
    window.addEventListener("toggleSettings", handleToggleSettings);

    return () => {
      window.removeEventListener("requestExit", handleExitRequest);
      window.removeEventListener(ACTIVATE_SIDEBAR_EVENT, handleActivateSidebar);
      window.removeEventListener("toggleSettings", handleToggleSettings);
    };
  }, [setShowExitModal, handleToggleMaximize]);
}
