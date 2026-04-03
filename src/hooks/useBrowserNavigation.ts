import { useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useBrowserStore } from "@/stores/browserStore";
import { useNavigationStore } from "@/stores/navigationStore";
import { useNavBindingsStore } from "@/stores/navBindingsStore";

export function useBrowserNavigation() {
  const {
    isOpen,
    isMinimized,
    minimizeBrowser,
    restoreBrowser,
    activeTabId,
    goBack,
    goForward,
  } = useBrowserStore();

  const { setInputMethod } = useNavigationStore();
  const keyboardNavigationEnabled = useNavBindingsStore((s) => s.keyboardNavigationEnabled);
  const gamepadNavigationEnabled = useNavBindingsStore((s) => s.gamepadNavigationEnabled);
  const lastInputTimeRef = useRef<number>(0);
  const debounceDelay = 200; // ms
  
  // Refs for button debouncing
  const buttonAPressedRef = useRef(false);
  const buttonBPressedRef = useRef(false);
  const buttonYPressedRef = useRef(false);
  const buttonStartPressedRef = useRef(false);
  
  // Helper to close browser and return to home
  const closeBrowserAndReturnHome = useCallback(() => {
    const { closeBrowser } = useBrowserStore.getState();
    
    // Close browser (iframes are automatically cleaned up when component unmounts)
    closeBrowser();
    
    // Return focus to main app
    const { setFocusArea } = useNavigationStore.getState();
    setFocusArea("games");
  }, []);

  useEffect(() => {
    if (!isOpen || isMinimized) return;

    const handleGamepadInput = () => {
      if (!useNavBindingsStore.getState().gamepadNavigationEnabled) return;
      const gamepads = navigator.getGamepads();
      const gamepad = gamepads[0];
      
      if (!gamepad) return;

      const now = Date.now();
      if (now - lastInputTimeRef.current < debounceDelay) return;
      lastInputTimeRef.current = now;

      setInputMethod("gamepad");

      // D-pad or Left Stick - Scroll page
      const leftStickX = gamepad.axes[0];
      const leftStickY = gamepad.axes[1];
      const dpadUp = gamepad.buttons[12]?.pressed || false;
      const dpadDown = gamepad.buttons[13]?.pressed || false;
      const dpadLeft = gamepad.buttons[14]?.pressed || false;
      const dpadRight = gamepad.buttons[15]?.pressed || false;

      // Scroll with D-pad or stick
      if (Math.abs(leftStickY) > 0.3 || dpadUp || dpadDown) {
        const scrollAmount = 100;
        const direction = (dpadUp || leftStickY < -0.3) ? -scrollAmount : scrollAmount;
        window.scrollBy({ top: direction, behavior: "smooth" });
      }

      if (Math.abs(leftStickX) > 0.3 || dpadLeft || dpadRight) {
        const scrollAmount = 100;
        const direction = (dpadLeft || leftStickX < -0.3) ? -scrollAmount : scrollAmount;
        window.scrollBy({ left: direction, behavior: "smooth" });
      }

      // A/X button (button 0) - Click focused element
      const buttonA = gamepad.buttons[0]?.pressed;
      if (buttonA && !buttonAPressedRef.current) {
        buttonAPressedRef.current = true;
        const focusedElement = document.activeElement as HTMLElement;
        if (focusedElement && (focusedElement.tagName === "A" || focusedElement.tagName === "BUTTON")) {
          focusedElement.click();
        } else {
          // Try to find and click the first interactive element
          const firstLink = document.querySelector("a, button, [role='button']") as HTMLElement;
          if (firstLink) {
            firstLink.focus();
            firstLink.click();
          }
        }
      } else if (!buttonA) {
        buttonAPressedRef.current = false;
      }

      // B/Circle button (button 1) - Close browser and return to home
      const buttonB = gamepad.buttons[1]?.pressed;
      if (buttonB && !buttonBPressedRef.current) {
        buttonBPressedRef.current = true;
        closeBrowserAndReturnHome();
      } else if (!buttonB) {
        buttonBPressedRef.current = false;
      }

      // Y/Triangle button (button 3) - Go forward
      const buttonY = gamepad.buttons[3]?.pressed;
      if (buttonY && !buttonYPressedRef.current) {
        buttonYPressedRef.current = true;
        goForward(activeTabId || "");
      } else if (!buttonY) {
        buttonYPressedRef.current = false;
      }

      // Start/Home button (button 8, 9, or 16) - Close browser and return to home
      const buttonStart = gamepad.buttons[8]?.pressed || gamepad.buttons[9]?.pressed || gamepad.buttons[16]?.pressed;
      if (buttonStart && !buttonStartPressedRef.current) {
        buttonStartPressedRef.current = true;
        closeBrowserAndReturnHome();
      } else if (!buttonStart) {
        buttonStartPressedRef.current = false;
      }
      
      // Note: Browser navigation within iframe is handled by the iframe itself
      // We don't need to close webview windows since we're using iframes now

      // Select/Share button (button 4 or 10) - Tab navigation
      if (gamepad.buttons[4]?.pressed || gamepad.buttons[10]?.pressed) {
        // Cycle through tabs - this would need to be implemented in the browser store
        // For now, just focus the browser bar
        const urlInput = document.querySelector('input[type="text"][placeholder*="URL"]') as HTMLInputElement;
        if (urlInput) {
          urlInput.focus();
        }
      }
    };

    // Check for gamepad input periodically
    const interval = setInterval(handleGamepadInput, 50);

    return () => {
      clearInterval(interval);
    };
  }, [
    isOpen,
    isMinimized,
    activeTabId,
    minimizeBrowser,
    restoreBrowser,
    goBack,
    goForward,
    setInputMethod,
    closeBrowserAndReturnHome,
    gamepadNavigationEnabled,
  ]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen || isMinimized) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!useNavBindingsStore.getState().keyboardNavigationEnabled) {
        return;
      }
      setInputMethod("keyboard");

      // Match browser chrome: Alt+Left / Alt+Right = webview history (not horizontal scroll).
      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight")
      ) {
        e.preventDefault();
        e.stopPropagation();
        const tabId = useBrowserStore.getState().activeTabId;
        if (!tabId) return;
        void (async () => {
          try {
            if (e.key === "ArrowLeft") {
              await invoke("go_back", { tabId: "embedded_browser" });
              goBack(tabId);
            } else {
              await invoke("go_forward", { tabId: "embedded_browser" });
              goForward(tabId);
            }
          } catch (err) {
            console.error("Browser history navigation failed:", err);
          }
        })();
        return;
      }

      // Arrow keys - scroll
      if (e.key === "ArrowUp") {
        window.scrollBy({ top: -100, behavior: "smooth" });
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        window.scrollBy({ top: 100, behavior: "smooth" });
        e.preventDefault();
      } else if (e.key === "ArrowLeft") {
        window.scrollBy({ left: -100, behavior: "smooth" });
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        window.scrollBy({ left: 100, behavior: "smooth" });
        e.preventDefault();
      }

      // Enter - click focused element
      if (e.key === "Enter" && document.activeElement) {
        const element = document.activeElement as HTMLElement;
        if (element.click) {
          element.click();
        }
      }

      // Escape or Home key - Close browser and return to home
      if (e.key === "Escape" || e.key === "Home") {
        e.preventDefault();
        e.stopPropagation();
        closeBrowserAndReturnHome();
      }
      
      // B key (for keyboard) - Close browser and return to home
      if (e.key === "b" || e.key === "B") {
        // Only if not typing in an input field
        const activeElement = document.activeElement;
        if (!activeElement || (activeElement.tagName !== "INPUT" && activeElement.tagName !== "TEXTAREA")) {
          e.preventDefault();
          e.stopPropagation();
          closeBrowserAndReturnHome();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    isOpen,
    isMinimized,
    minimizeBrowser,
    restoreBrowser,
    setInputMethod,
    closeBrowserAndReturnHome,
    goBack,
    goForward,
    keyboardNavigationEnabled,
  ]);
}

