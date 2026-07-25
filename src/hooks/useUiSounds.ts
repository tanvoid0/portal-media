import { useEffect } from "react";
import { useGameStore } from "@/stores/gameStore";
import { useNavigationStore } from "@/stores/navigationStore";
import { useShellOverlayStore } from "@/stores/shellOverlayStore";
import { playUiSound, primeUiAudio } from "@/utils/uiSounds";

/**
 * Global console-style audio feedback: focus moves tick, overlays swoosh.
 * Select sounds fire from appNavigate (route commits) so every entry point is
 * covered. Also primes the AudioContext on the first real user gesture so
 * ticks are not muted by autoplay policy.
 */
export function useUiSounds(): void {
  useEffect(() => {
    const prime = () => primeUiAudio();
    window.addEventListener("pointerdown", prime, { once: true });
    window.addEventListener("keydown", prime, { once: true });

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
        (state.gameContextMenuOpen && !prev.gameContextMenuOpen) ||
        (state.exitConfirmOpen && !prev.exitConfirmOpen) ||
        (state.oskOpen && !prev.oskOpen);
      const closed =
        (!state.quickAccessOpen && prev.quickAccessOpen) ||
        (!state.appSwitcherOpen && prev.appSwitcherOpen) ||
        (!state.gameContextMenuOpen && prev.gameContextMenuOpen) ||
        (!state.exitConfirmOpen && prev.exitConfirmOpen) ||
        (!state.oskOpen && prev.oskOpen);
      if (opened) playUiSound("open");
      else if (closed) playUiSound("back");
    });

    return () => {
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
      unsubGame();
      unsubNav();
      unsubOverlay();
    };
  }, []);
}
