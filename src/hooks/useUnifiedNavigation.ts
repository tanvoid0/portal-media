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
  UNIVERSAL_NAV_FOCUS_DELAY_MS,
  type DelayedFocusArea,
} from "@/navigation/universalNavCore";

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

  const buttonBPressedRef = useRef(false);
  const buttonAPressedRef = useRef(false);
  const buttonStartRef = useRef(false);
  const buttonYPressedRef = useRef(false);
  const buttonLBPressedRef = useRef(false);
  const buttonRBPressedRef = useRef(false);
  const buttonLTPressedRef = useRef(false);
  const buttonRTPressedRef = useRef(false);
  const dpadLeftRef = useRef(false);
  const dpadRightRef = useRef(false);
  const dpadUpRef = useRef(false);
  const dpadDownRef = useRef(false);
  const stickLeftRef = useRef(false);
  const stickRightRef = useRef(false);
  const stickUpRef = useRef(false);
  const stickDownRef = useRef(false);
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
  }, [setInputMethod]);

  const handleKeyboardNavigation = useCallback(
    (e: KeyboardEvent) => {
      if (processUniversalKeydown(e, delayedFocus) === "handled") {
        setInputMethod("keyboard");
      }
    },
    [setInputMethod, delayedFocus]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyboardNavigation);
    return () => window.removeEventListener("keydown", handleKeyboardNavigation);
  }, [handleKeyboardNavigation]);

  const handleGamepadInput = useCallback(() => {
    if (isSpatialNavigationBlocked()) {
      return;
    }

    const gamepads = navigator.getGamepads();
    const gamepad = gamepads[0];

    if (!gamepad) return;

    setInputMethod("gamepad");

    if (useAppShellStore.getState().currentView === "settings") {
      const buttonB = gamepad.buttons[1]?.pressed;
      if (buttonB && !buttonBPressedRef.current) {
        buttonBPressedRef.current = true;
        applyBackOrEscape(delayedFocus);
      } else if (!buttonB) {
        buttonBPressedRef.current = false;
      }

      const buttonStart =
        gamepad.buttons[8]?.pressed || gamepad.buttons[9]?.pressed || gamepad.buttons[16]?.pressed;
      if (buttonStart && !buttonStartRef.current) {
        buttonStartRef.current = true;
        applyGamepadMenuToggle(delayedFocus);
      } else if (!buttonStart) {
        buttonStartRef.current = false;
      }
      return;
    }

    const fa = getEffectiveFocusArea();

    const leftStickX = gamepad.axes[0];
    const leftStickY = gamepad.axes[1];
    const dpadLeft = gamepad.buttons[14]?.pressed;
    const dpadRight = gamepad.buttons[15]?.pressed;
    const dpadUp = gamepad.buttons[12]?.pressed;
    const dpadDown = gamepad.buttons[13]?.pressed;

    const upPressed = dpadUp || leftStickY < -0.5;
    const downPressed = dpadDown || leftStickY > 0.5;

    if (upPressed && !dpadUpRef.current && !stickUpRef.current) {
      dpadUpRef.current = dpadUp;
      stickUpRef.current = leftStickY < -0.5;
      applySpatialNavigation("up", delayedFocus);
    } else if (!upPressed) {
      dpadUpRef.current = false;
      stickUpRef.current = false;
    }

    if (downPressed && !dpadDownRef.current && !stickDownRef.current) {
      dpadDownRef.current = dpadDown;
      stickDownRef.current = leftStickY > 0.5;
      applySpatialNavigation("down", delayedFocus);
    } else if (!downPressed) {
      dpadDownRef.current = false;
      stickDownRef.current = false;
    }

    const leftPressed = dpadLeft || leftStickX < -0.5;
    const rightPressed = dpadRight || leftStickX > 0.5;

    if (leftPressed && !dpadLeftRef.current && !stickLeftRef.current) {
      dpadLeftRef.current = dpadLeft;
      stickLeftRef.current = leftStickX < -0.5;
      applySpatialNavigation("left", delayedFocus);
    } else if (!leftPressed) {
      dpadLeftRef.current = false;
      stickLeftRef.current = false;
    }

    if (rightPressed && !dpadRightRef.current && !stickRightRef.current) {
      dpadRightRef.current = dpadRight;
      stickRightRef.current = leftStickX > 0.5;
      applySpatialNavigation("right", delayedFocus);
    } else if (!rightPressed) {
      dpadRightRef.current = false;
      stickRightRef.current = false;
    }

    const buttonA = gamepad.buttons[0]?.pressed;
    if (buttonA && !buttonAPressedRef.current) {
      buttonAPressedRef.current = true;
      applyPrimaryAction();
    } else if (!buttonA) {
      buttonAPressedRef.current = false;
    }

    const buttonY = gamepad.buttons[3]?.pressed;
    if (buttonY && !buttonYPressedRef.current) {
      buttonYPressedRef.current = true;
      openShellSearch();
    } else if (!buttonY) {
      buttonYPressedRef.current = false;
    }

    const buttonB = gamepad.buttons[1]?.pressed;
    if (buttonB && !buttonBPressedRef.current) {
      buttonBPressedRef.current = true;
      applyBackOrEscape(delayedFocus);
    } else if (!buttonB) {
      buttonBPressedRef.current = false;
    }

    const buttonStart =
      gamepad.buttons[8]?.pressed || gamepad.buttons[9]?.pressed || gamepad.buttons[16]?.pressed;
    if (buttonStart && !buttonStartRef.current) {
      buttonStartRef.current = true;
      applyGamepadMenuToggle(delayedFocus);
    } else if (!buttonStart) {
      buttonStartRef.current = false;
    }

    const buttonLB = gamepad.buttons[4]?.pressed;
    if (buttonLB && !buttonLBPressedRef.current) {
      buttonLBPressedRef.current = true;
      if (fa === "category") {
        applyCategoryStripStep("left");
      } else if (fa === "games") {
        applyCategoryBumperFromGames("left", delayedFocus);
      }
    } else if (!buttonLB) {
      buttonLBPressedRef.current = false;
    }

    const buttonRB = gamepad.buttons[5]?.pressed;
    if (buttonRB && !buttonRBPressedRef.current) {
      buttonRBPressedRef.current = true;
      if (fa === "category") {
        applyCategoryStripStep("right");
      } else if (fa === "games") {
        applyCategoryBumperFromGames("right", delayedFocus);
      }
    } else if (!buttonRB) {
      buttonRBPressedRef.current = false;
    }

    const buttonLT =
      gamepad.buttons[6]?.pressed ||
      (gamepad.buttons[6]?.value ? gamepad.buttons[6].value > 0.5 : false);
    if (buttonLT && !buttonLTPressedRef.current) {
      buttonLTPressedRef.current = true;
      if (fa === "games") {
        useGameStore.getState().selectPrevious();
      } else if (fa === "category") {
        applyShoulderScrollFromCategory("prev", delayedFocus, UNIVERSAL_NAV_FOCUS_DELAY_MS);
      }
    } else if (!buttonLT) {
      buttonLTPressedRef.current = false;
    }

    const buttonRT =
      gamepad.buttons[7]?.pressed ||
      (gamepad.buttons[7]?.value ? gamepad.buttons[7].value > 0.5 : false);
    if (buttonRT && !buttonRTPressedRef.current) {
      buttonRTPressedRef.current = true;
      if (fa === "games") {
        useGameStore.getState().selectNext();
      } else if (fa === "category") {
        applyShoulderScrollFromCategory("next", delayedFocus, UNIVERSAL_NAV_FOCUS_DELAY_MS);
      }
    } else if (!buttonRT) {
      buttonRTPressedRef.current = false;
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
