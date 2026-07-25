import { useEffect } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useBrowserStore } from "@/stores/browserStore";
import { useShellOverlayStore } from "@/stores/shellOverlayStore";

const CURSOR_KEY = "portal.virtualCursor";
const CHORD_KEY = "portal.focusChord";

function prefOn(key: string): boolean {
  try {
    return localStorage.getItem(key) !== "off";
  } catch {
    return true;
  }
}

export function virtualCursorEnabled(): boolean {
  return prefOn(CURSOR_KEY);
}

export function focusChordEnabled(): boolean {
  return prefOn(CHORD_KEY);
}

/** Persist + push both native gamepad prefs to the Rust poll thread. */
export function setNativeGamepadPrefs(cursorEnabled: boolean, focusChordEnabled: boolean): void {
  try {
    localStorage.setItem(CURSOR_KEY, cursorEnabled ? "on" : "off");
    localStorage.setItem(CHORD_KEY, focusChordEnabled ? "on" : "off");
  } catch {
    /* ignore */
  }
  if (isTauri()) {
    void invoke("native_gamepad_set_prefs", { cursorEnabled, focusChordEnabled }).catch(console.error);
  }
}

/**
 * Bridges the native XInput thread (src-tauri/native_gamepad.rs):
 * - pushes persisted prefs at boot
 * - tells Rust when the embedded browser owns the screen (virtual cursor scope)
 * - Back+Start chord → Portal focused natively; we surface Quick Access on top
 */
export function useNativeGamepad(): void {
  useEffect(() => {
    if (!isTauri()) return;

    setNativeGamepadPrefs(virtualCursorEnabled(), focusChordEnabled());

    const pushBrowserActive = (active: boolean) => {
      void invoke("native_cursor_set_browser_active", { active }).catch(console.error);
    };
    const bs = useBrowserStore.getState();
    pushBrowserActive(bs.isOpen && !bs.isMinimized);
    const unsub = useBrowserStore.subscribe((state, prev) => {
      const now = state.isOpen && !state.isMinimized;
      const was = prev.isOpen && !prev.isMinimized;
      if (now !== was) pushBrowserActive(now);
    });

    const unlisten = listen("native-focus-chord", () => {
      useShellOverlayStore.getState().setQuickAccessOpen(true);
    });

    return () => {
      unsub();
      void unlisten.then((fn) => fn());
    };
  }, []);
}
