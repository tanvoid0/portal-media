import { useEffect, useRef } from "react";
import { useNavigationStore } from "@/stores/navigationStore";

export function useCursorControl() {
  const { inputMethod, setInputMethod } = useNavigationStore();
  const checkGamepadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMouseActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    // Apply cursor style based on input method
    // Only hide cursor for gamepad, keep it visible for mouse and keyboard
    const root = document.documentElement;
    const body = document.body;
    
    if (inputMethod === "gamepad") {
      root.classList.add("cursor-none");
      body.classList.add("cursor-none");
    } else {
      // Explicitly show cursor for mouse and keyboard
      root.classList.remove("cursor-none");
      body.classList.remove("cursor-none");
      // Force cursor to be visible
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
    // Track mouse movement - always set to mouse when mouse is used
    const handleMouseMove = () => {
      setInputMethod("mouse");
    };

    const handleMouseClick = () => {
      setInputMethod("mouse");
    };

    const handleMouseEnter = () => {
      setInputMethod("mouse");
    };

    // Periodically check for gamepad input
    // Only switch to gamepad if there's actual gamepad input AND mouse hasn't moved recently
    const mouseActivityTimeout = 2000; // 2 seconds of no mouse activity before allowing gamepad switch

    const checkGamepadInput = () => {
      const gamepads = navigator.getGamepads();
      const gamepad = gamepads[0];
      
      if (gamepad) {
        // Check if any button or stick is active
        const hasInput = Array.from(gamepad.buttons).some(btn => btn.pressed) ||
          Math.abs(gamepad.axes[0]) > 0.1 || Math.abs(gamepad.axes[1]) > 0.1;
        
        // Only switch to gamepad if there's input AND mouse hasn't been active recently
        const timeSinceMouseActivity = Date.now() - lastMouseActivityRef.current;
        if (hasInput && timeSinceMouseActivity > mouseActivityTimeout) {
          setInputMethod("gamepad");
        }
      }
    };

    const handleMouseMoveWithActivity = () => {
      handleMouseMove();
      lastMouseActivityRef.current = Date.now();
    };

    window.addEventListener("mousemove", handleMouseMoveWithActivity);
    window.addEventListener("mousedown", handleMouseClick);
    window.addEventListener("mouseup", handleMouseClick);
    window.addEventListener("mouseenter", handleMouseEnter);

    // Check for gamepad input every 100ms
    checkGamepadIntervalRef.current = setInterval(checkGamepadInput, 100);

    return () => {
      window.removeEventListener("mousemove", handleMouseMoveWithActivity);
      window.removeEventListener("mousedown", handleMouseClick);
      window.removeEventListener("mouseup", handleMouseClick);
      window.removeEventListener("mouseenter", handleMouseEnter);
      if (checkGamepadIntervalRef.current) {
        clearInterval(checkGamepadIntervalRef.current);
      }
    };
  }, [setInputMethod]);
}

