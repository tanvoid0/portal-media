import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { AppView } from "@/types/app";
import { ACTIVATE_SIDEBAR_EVENT, isActivateSidebarEvent } from "@/types/app";

export function useAppShellEvents(
  setCurrentView: Dispatch<SetStateAction<AppView>>,
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
      if (index === 0) {
        setCurrentView("games");
      } else if (index === 1) {
        setCurrentView("settings");
      } else if (index === 2) {
        handleToggleMaximize();
      } else if (index === 3) {
        setShowExitModal(true);
      }
    };

    const handleToggleSettings = () => {
      setCurrentView((v) => (v === "settings" ? "games" : "settings"));
    };

    window.addEventListener("requestExit", handleExitRequest);
    window.addEventListener(ACTIVATE_SIDEBAR_EVENT, handleActivateSidebar);
    window.addEventListener("toggleSettings", handleToggleSettings);

    return () => {
      window.removeEventListener("requestExit", handleExitRequest);
      window.removeEventListener(ACTIVATE_SIDEBAR_EVENT, handleActivateSidebar);
      window.removeEventListener("toggleSettings", handleToggleSettings);
    };
  }, [setCurrentView, setShowExitModal, handleToggleMaximize]);
}
