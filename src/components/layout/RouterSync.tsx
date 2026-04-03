import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAppShellStore } from "@/stores/appShellStore";

/** Keep zustand `currentView` aligned with the URL for gamepad / keyboard core helpers. */
export function RouterSync() {
  const pathname = useLocation().pathname;
  const setCurrentView = useAppShellStore((s) => s.setCurrentView);

  useLayoutEffect(() => {
    setCurrentView(pathname.startsWith("/settings") ? "settings" : "games");
  }, [pathname, setCurrentView]);

  return null;
}
