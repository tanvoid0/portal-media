import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAppShellStore } from "@/stores/appShellStore";
import type { AppView } from "@/types/app";

/** Keep zustand `currentView` aligned with the URL for gamepad / keyboard core helpers. */
export function RouterSync() {
  const pathname = useLocation().pathname;
  const setCurrentView = useAppShellStore((s) => s.setCurrentView);

  useLayoutEffect(() => {
    const view: AppView = pathname.startsWith("/settings")
      ? "settings"
      : pathname.startsWith("/docs")
        ? "docs"
        : pathname.startsWith("/game/") ||
            pathname.startsWith("/tmdb/") ||
            pathname.startsWith("/igdb/")
          ? "details"
          : "games";
    setCurrentView(view);
  }, [pathname, setCurrentView]);

  return null;
}
