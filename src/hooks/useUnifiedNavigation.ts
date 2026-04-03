import { useEffect, useRef, useCallback } from "react";
import { useGameStore } from "@/stores/gameStore";
import { useAppShellStore } from "@/stores/appShellStore";
import { useNavigationStore } from "@/stores/navigationStore";
import {
  isSpatialNavigationBlocked,
  getEffectiveFocusArea,
  processUniversalKeydown,
  applySpatialNavigation,
  applyPrimaryAction,
  applyBackOrEscape,
  applyCategoryBumperFromGames,
  applyCategoryStripStep,
  applyShoulderScrollFromCategory,
  applyGamepadMenuToggle,
  openShellSearch,
  openDetailsForSelectedGame,
  UNIVERSAL_NAV_FOCUS_DELAY_MS,
  type DelayedFocusArea,
} from "@/navigation/universalNavCore";
import { useShellOverlayStore } from "@/stores/shellOverlayStore";
import { useTmdbDiscoverStore } from "@/stores/tmdbDiscoverStore";
import { isDiscoverLibraryView } from "@/navigation/universalNavCore";
import { EXECUTE_GAME_CONTEXT_EVENT } from "@/types/app";
import type { NavActionId } from "@/types/navBindings";
import {
  getNavBinding,
  useLeftStickForSpatialEffective,
  useNavBindingsStore,
} from "@/stores/navBindingsStore";
import { anyGamepadButtonJustPressed, snapshotGamepadButtons } from "@/utils/navBindingMatch";

/** @deprecated Import from `@/navigation/universalNavCore` for non-hook modules. */
export { EXECUTE_DETAILS_ACTION } from "@/navigation/universalNavCore";

/**
 * Routes pointer, keyboard, and gamepad into `universalNavCore.ts`.
 * Spatial / primary / back rules live in one place; this file only handles input modality and edge triggers.
 */
export function useUnifiedNavigation() {
  const inputMethod = useNavigationStore((state) => state.inputMethod);
  const setFocusArea = useNavigationStore((state) => state.setFocusArea);
  const setInputMethod = useNavigationStore((state) => state.setInputMethod);
  const keyboardNavigationEnabled = useNavBindingsStore((s) => s.keyboardNavigationEnabled);
  const gamepadNavigationEnabled = useNavBindingsStore((s) => s.gamepadNavigationEnabled);

  const dpadLeftRef = useRef(false);
  const dpadRightRef = useRef(false);
  const dpadUpRef = useRef(false);
  const dpadDownRef = useRef(false);
  const stickLeftRef = useRef(false);
  const stickRightRef = useRef(false);
  const stickUpRef = useRef(false);
  const stickDownRef = useRef(false);
  const prevGpButtonsRef = useRef<boolean[]>(Array.from({ length: 32 }, () => false));
  const currGpButtonsRef = useRef<boolean[]>(Array.from({ length: 32 }, () => false));
  const checkGamepadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMouseActivityRef = useRef<number>(Date.now());
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const delayedSetFocusArea = useCallback(
    (area: Parameters<DelayedFocusArea>[0], delay: number = UNIVERSAL_NAV_FOCUS_DELAY_MS) => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
      navigationTimeoutRef.current = setTimeout(() => {
        setFocusArea(area);
      }, delay);
    },
    [setFocusArea]
  );

  const delayedFocus: DelayedFocusArea = useCallback(
    (area) => {
      delayedSetFocusArea(area);
    },
    [delayedSetFocusArea]
  );

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    if (inputMethod === "gamepad") {
      root.classList.add("cursor-none");
      body.classList.add("cursor-none");
    } else {
      root.classList.remove("cursor-none");
      body.classList.remove("cursor-none");
      root.style.cursor = "";
      body.style.cursor = "";
    }

    return () => {
      root.classList.remove("cursor-none");
      body.classList.remove("cursor-none");
      root.style.cursor = "";
      body.style.cursor = "";
    };
  }, [inputMethod]);

  useEffect(() => {
    if (!gamepadNavigationEnabled && inputMethod === "gamepad") {
      setInputMethod("keyboard");
    }
  }, [gamepadNavigationEnabled, inputMethod, setInputMethod]);

  useEffect(() => {
    if (!keyboardNavigationEnabled && inputMethod === "keyboard") {
      setInputMethod("mouse");
    }
  }, [keyboardNavigationEnabled, inputMethod, setInputMethod]);

  useEffect(() => {
    const handleMouseMove = () => {
      setInputMethod("mouse");
      lastMouseActivityRef.current = Date.now();
    };

    const handleMouseClick = () => {
      setInputMethod("mouse");
    };

    const handleMouseEnter = () => {
      setInputMethod("mouse");
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseClick);
    window.addEventListener("mouseup", handleMouseClick);
    window.addEventListener("mouseenter", handleMouseEnter);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseClick);
      window.removeEventListener("mouseup", handleMouseClick);
      window.removeEventListener("mouseenter", handleMouseEnter);
    };
  }, [setInputMethod]);

  useEffect(() => {
    const mouseActivityTimeout = 2000;

    const checkGamepadInput = () => {
      if (!useNavBindingsStore.getState().gamepadNavigationEnabled) return;
      const gamepads = navigator.getGamepads();
      const gamepad = gamepads[0];

      if (gamepad) {
        const hasInput =
          Array.from(gamepad.buttons).some((btn) => btn.pressed) ||
          Math.abs(gamepad.axes[0]) > 0.1 ||
          Math.abs(gamepad.axes[1]) > 0.1;

        const timeSinceMouseActivity = Date.now() - lastMouseActivityRef.current;
        if (hasInput && timeSinceMouseActivity > mouseActivityTimeout) {
          setInputMethod("gamepad");
        }
      }
    };

    checkGamepadIntervalRef.current = setInterval(checkGamepadInput, 100);

    return () => {
      if (checkGamepadIntervalRef.current) {
        clearInterval(checkGamepadIntervalRef.current);
      }
    };
  }, [setInputMethod, gamepadNavigationEnabled]);

  const handleKeyboardNavigation = useCallback(
    (e: KeyboardEvent) => {
      if (!useNavBindingsStore.getState().keyboardNavigationEnabled) {
        return;
      }
      if (processUniversalKeydown(e, delayedFocus) === "handled") {
        setInputMethod("keyboard");
      }
    },
    [setInputMethod, delayedFocus]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyboardNavigation);
    return () => window.removeEventListener("keydown", handleKeyboardNavigation);
  }, [handleKeyboardNavigation, keyboardNavigationEnabled]);

  const handleGamepadInput = useCallback(() => {
    if (isSpatialNavigationBlocked()) {
      return;
    }
    if (!useNavBindingsStore.getState().gamepadNavigationEnabled) {
      return;
    }

    const gamepads = navigator.getGamepads();
    const gamepad = gamepads[0];

    if (!gamepad) return;

    setInputMethod("gamepad");

    const prev = prevGpButtonsRef.current;
    const curr = currGpButtonsRef.current;
    snapshotGamepadButtons(gamepad, curr, 31);

    const gpJust = (binding: ReturnType<typeof getNavBinding>): boolean =>
      binding.enabled &&
      binding.gamepadButtons.length > 0 &&
      anyGamepadButtonJustPressed(binding.gamepadButtons, prev, curr);

    const stickOn = useLeftStickForSpatialEffective();

    const dpadDownFor = (id: NavActionId, currBuf: boolean[]) => {
      const b = getNavBinding(id);
      return b.enabled && b.gamepadButtons.some((i) => currBuf[i]);
    };

    try {
      if (useAppShellStore.getState().currentView === "settings" || useAppShellStore.getState().currentView === "docs") {
        if (gpJust(getNavBinding("back"))) {
          applyBackOrEscape(delayedFocus);
        }
        if (gpJust(getNavBinding("gamepadSettingsMenu"))) {
          applyGamepadMenuToggle(delayedFocus);
        }
        return;
      }

      const sh = useShellOverlayStore.getState();
      if (sh.gameContextMenuOpen) {
        const leftStickY = gamepad.axes[1];
        const bUp = getNavBinding("spatialUp");
        const bDown = getNavBinding("spatialDown");
        const dpadUp = dpadDownFor("spatialUp", curr);
        const dpadDown = dpadDownFor("spatialDown", curr);
        const upPressed =
          bUp.enabled && (dpadUp || (stickOn && leftStickY < -0.5));
        const downPressed =
          bDown.enabled && (dpadDown || (stickOn && leftStickY > 0.5));
        if (upPressed && !dpadUpRef.current && !stickUpRef.current) {
          dpadUpRef.current = dpadUp;
          stickUpRef.current = stickOn && leftStickY < -0.5;
          const st = useShellOverlayStore.getState();
          st.setContextMenuFocusIndex(st.contextMenuFocusIndex - 1);
        } else if (!upPressed) {
          dpadUpRef.current = false;
          stickUpRef.current = false;
        }
        if (downPressed && !dpadDownRef.current && !stickDownRef.current) {
          dpadDownRef.current = dpadDown;
          stickDownRef.current = stickOn && leftStickY > 0.5;
          const st = useShellOverlayStore.getState();
          st.setContextMenuFocusIndex(st.contextMenuFocusIndex + 1);
        } else if (!downPressed) {
          dpadDownRef.current = false;
          stickDownRef.current = false;
        }
        if (gpJust(getNavBinding("back"))) {
          useShellOverlayStore.getState().setGameContextMenuOpen(false);
        }
        if (gpJust(getNavBinding("primary"))) {
          const st = useShellOverlayStore.getState();
          window.dispatchEvent(
            new CustomEvent(EXECUTE_GAME_CONTEXT_EVENT, { detail: st.contextMenuFocusIndex })
          );
        }
        return;
      }

      const fa = getEffectiveFocusArea();
      const currentView = useAppShellStore.getState().currentView;
      const gs0 = useGameStore.getState();
      const ds0 = useTmdbDiscoverStore.getState();
      const hasGameSelection = Boolean(gs0.filteredGames[gs0.selectedIndex]);
      const hasDiscoverSelection =
        isDiscoverLibraryView() && Boolean(ds0.getItems()[ds0.selectedIndex]);
      const hasPrimaryGridSelection = hasDiscoverSelection || hasGameSelection;

      if (
        currentView === "games" &&
        fa === "games" &&
        hasPrimaryGridSelection &&
        !isDiscoverLibraryView() &&
        hasGameSelection &&
        gpJust(getNavBinding("gameMenu"))
      ) {
        useShellOverlayStore.getState().toggleGameContextMenu();
      }

      if (
        (currentView === "games" || currentView === "details") &&
        gpJust(getNavBinding("gamepadQuickAccessOverlay"))
      ) {
        useShellOverlayStore.getState().toggleQuickAccess();
      }

      const leftStickX = gamepad.axes[0];
      const leftStickY = gamepad.axes[1];

      const bU = getNavBinding("spatialUp");
      const bD = getNavBinding("spatialDown");
      const bL = getNavBinding("spatialLeft");
      const bR = getNavBinding("spatialRight");
      const dUp = dpadDownFor("spatialUp", curr);
      const dDown = dpadDownFor("spatialDown", curr);
      const dLeft = dpadDownFor("spatialLeft", curr);
      const dRight = dpadDownFor("spatialRight", curr);

      const upPressed = bU.enabled && (dUp || (stickOn && leftStickY < -0.5));
      const downPressed = bD.enabled && (dDown || (stickOn && leftStickY > 0.5));
      const leftPressed = bL.enabled && (dLeft || (stickOn && leftStickX < -0.5));
      const rightPressed = bR.enabled && (dRight || (stickOn && leftStickX > 0.5));

      if (upPressed && !dpadUpRef.current && !stickUpRef.current) {
        dpadUpRef.current = dUp;
        stickUpRef.current = stickOn && leftStickY < -0.5;
        applySpatialNavigation("up", delayedFocus);
      } else if (!upPressed) {
        dpadUpRef.current = false;
        stickUpRef.current = false;
      }

      if (downPressed && !dpadDownRef.current && !stickDownRef.current) {
        dpadDownRef.current = dDown;
        stickDownRef.current = stickOn && leftStickY > 0.5;
        applySpatialNavigation("down", delayedFocus);
      } else if (!downPressed) {
        dpadDownRef.current = false;
        stickDownRef.current = false;
      }

      if (leftPressed && !dpadLeftRef.current && !stickLeftRef.current) {
        dpadLeftRef.current = dLeft;
        stickLeftRef.current = stickOn && leftStickX < -0.5;
        applySpatialNavigation("left", delayedFocus);
      } else if (!leftPressed) {
        dpadLeftRef.current = false;
        stickLeftRef.current = false;
      }

      if (rightPressed && !dpadRightRef.current && !stickRightRef.current) {
        dpadRightRef.current = dRight;
        stickRightRef.current = stickOn && leftStickX > 0.5;
        applySpatialNavigation("right", delayedFocus);
      } else if (!rightPressed) {
        dpadRightRef.current = false;
        stickRightRef.current = false;
      }

      if (gpJust(getNavBinding("primary"))) {
        applyPrimaryAction();
      }

      if (gpJust(getNavBinding("openSearch"))) {
        openShellSearch();
      }

      if (gpJust(getNavBinding("back"))) {
        applyBackOrEscape(delayedFocus);
      }

      if (
        currentView === "games" &&
        fa === "games" &&
        hasPrimaryGridSelection &&
        gpJust(getNavBinding("quickLaunch"))
      ) {
        if (isDiscoverLibraryView()) {
          openDetailsForSelectedGame();
        } else {
          const g = useGameStore.getState().filteredGames[useGameStore.getState().selectedIndex];
          if (g) void useGameStore.getState().launchGame(g);
        }
      }

      const catLeft = getNavBinding("categoryBumperLeft");
      if (
        catLeft.enabled &&
        catLeft.gamepadButtons.length > 0 &&
        anyGamepadButtonJustPressed(catLeft.gamepadButtons, prev, curr)
      ) {
        if (fa === "category") {
          applyCategoryStripStep("left");
        } else if (fa === "games") {
          applyCategoryBumperFromGames("left", delayedFocus);
        }
      }

      const catRight = getNavBinding("categoryBumperRight");
      if (
        catRight.enabled &&
        catRight.gamepadButtons.length > 0 &&
        anyGamepadButtonJustPressed(catRight.gamepadButtons, prev, curr)
      ) {
        if (fa === "category") {
          applyCategoryStripStep("right");
        } else if (fa === "games") {
          applyCategoryBumperFromGames("right", delayedFocus);
        }
      }

      const scrollPrev = getNavBinding("scrollSelectionPrev");
      if (
        scrollPrev.enabled &&
        scrollPrev.gamepadButtons.length > 0 &&
        anyGamepadButtonJustPressed(scrollPrev.gamepadButtons, prev, curr)
      ) {
        if (fa === "games") {
          if (isDiscoverLibraryView()) {
            useTmdbDiscoverStore.getState().selectPrevious();
          } else {
            useGameStore.getState().selectPrevious();
          }
        } else if (fa === "category") {
          applyShoulderScrollFromCategory("prev", delayedFocus, UNIVERSAL_NAV_FOCUS_DELAY_MS);
        }
      }

      const scrollNext = getNavBinding("scrollSelectionNext");
      if (
        scrollNext.enabled &&
        scrollNext.gamepadButtons.length > 0 &&
        anyGamepadButtonJustPressed(scrollNext.gamepadButtons, prev, curr)
      ) {
        if (fa === "games") {
          if (isDiscoverLibraryView()) {
            useTmdbDiscoverStore.getState().selectNext();
          } else {
            useGameStore.getState().selectNext();
          }
        } else if (fa === "category") {
          applyShoulderScrollFromCategory("next", delayedFocus, UNIVERSAL_NAV_FOCUS_DELAY_MS);
        }
      }
    } finally {
      for (let i = 0; i < 32; i++) {
        prev[i] = curr[i];
      }
    }
  }, [setInputMethod, delayedFocus]);

  useEffect(() => {
    let animationFrameId: number;
    let lastTime = 0;
    const throttleMs = 200;

    const pollGamepad = (currentTime: number) => {
      if (currentTime - lastTime >= throttleMs) {
        handleGamepadInput();
        lastTime = currentTime;
      }
      animationFrameId = requestAnimationFrame(pollGamepad);
    };

    animationFrameId = requestAnimationFrame(pollGamepad);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [handleGamepadInput]);

  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);
}
