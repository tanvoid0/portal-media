import { useEffect } from "react";
import { useGameStore } from "@/stores/gameStore";
import { useNavigationStore } from "@/stores/navigationStore";
import { useShellOverlayStore } from "@/stores/shellOverlayStore";
import { playUiSound } from "@/utils/uiSounds";

/**
 * Global console-style audio feedback: focus moves tick, overlays swoosh.
 * Select sounds fire from appNavigate (route commits) so every entry point is covered.
 */
export function useUiSounds(): void {
  useEffect(() => {
    const unsubGame = useGameStore.subscribe((state, prev) => {
      if (state.selectedIndex !== prev.selectedIndex) playUiSound("move");
    });

    const unsubNav = useNavigationStore.subscribe((state, prev) => {
      if (
        state.sidebarIndex !== prev.sidebarIndex ||
        state.categoryIndex !== prev.categoryIndex ||
        state.detailsIndex !== prev.detailsIndex ||
        state.focusArea !== prev.focusArea
      ) {
        playUiSound("move");
      }
    });

    const unsubOverlay = useShellOverlayStore.subscribe((state, prev) => {
      const opened =
        (state.quickAccessOpen && !prev.quickAccessOpen) ||
        (state.appSwitcherOpen && !prev.appSwitcherOpen) ||
        (state.gameContextMenuOpen && !prev.gameContextMenuOpen);
      const closed =
        (!state.quickAccessOpen && prev.quickAccessOpen) ||
        (!state.appSwitcherOpen && prev.appSwitcherOpen) ||
        (!state.gameContextMenuOpen && prev.gameContextMenuOpen);
      if (opened) playUiSound("open");
      else if (closed) playUiSound("back");
    });

    return () => {
      unsubGame();
      unsubNav();
      unsubOverlay();
    };
  }, []);
}
