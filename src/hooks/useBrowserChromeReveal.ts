import { useCallback, useEffect, useRef, useState } from "react";
import { useNavBindingsStore } from "@/stores/navBindingsStore";

const DEFAULT_HIDE_AFTER_MS = 4000;
const GAMEPAD_AXIS_THRESHOLD = 0.18;

function gamepadHasActivity(): boolean {
  const pads = navigator.getGamepads();
  for (let i = 0; i < pads.length; i++) {
    const gp = pads[i];
    if (!gp) continue;
    for (const b of gp.buttons) {
      if (!b) continue;
      if (b.pressed || b.value > 0.08) return true;
    }
    for (const a of gp.axes) {
      if (Math.abs(a) > GAMEPAD_AXIS_THRESHOLD) return true;
    }
  }
  return false;
}

/**
 * Full-screen embedded browser: show chrome after any pointer / key / gamepad activity,
 * then hide after idle so the site (e.g. video) stays unobstructed.
 */
export function useBrowserChromeReveal(
  enabled: boolean,
  options?: { forceVisible?: boolean; hideAfterMs?: number }
) {
  const forceVisible = options?.forceVisible ?? false;
  const hideAfterMs = options?.hideAfterMs ?? DEFAULT_HIDE_AFTER_MS;
  const gamepadNavigationEnabled = useNavBindingsStore((s) => s.gamepadNavigationEnabled);

  const [visible, setVisible] = useState(true);
  const visibleRef = useRef(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const bump = useCallback(() => {
    if (!enabled) return;
    clearHideTimer();
    if (!visibleRef.current) {
      visibleRef.current = true;
      setVisible(true);
    }
    if (forceVisible) return;
    hideTimerRef.current = setTimeout(() => {
      visibleRef.current = false;
      setVisible(false);
      hideTimerRef.current = null;
    }, hideAfterMs);
  }, [enabled, forceVisible, hideAfterMs, clearHideTimer]);

  useEffect(() => {
    if (!enabled) {
      clearHideTimer();
      visibleRef.current = true;
      setVisible(true);
      return;
    }

    if (forceVisible) {
      clearHideTimer();
      if (!visibleRef.current) {
        visibleRef.current = true;
        setVisible(true);
      }
      return;
    }

    bump();
    return () => clearHideTimer();
  }, [enabled, forceVisible, bump, clearHideTimer]);

  useEffect(() => {
    if (!enabled) return;

    const onActivity = () => bump();

    window.addEventListener("mousemove", onActivity, { passive: true });
    window.addEventListener("mousedown", onActivity, { passive: true });
    window.addEventListener("wheel", onActivity, { passive: true });
    window.addEventListener("touchstart", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity, true);

    const padInterval = window.setInterval(() => {
      if (
        useNavBindingsStore.getState().gamepadNavigationEnabled &&
        gamepadHasActivity()
      ) {
        onActivity();
      }
    }, 80);

    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("mousedown", onActivity);
      window.removeEventListener("wheel", onActivity);
      window.removeEventListener("touchstart", onActivity);
      window.removeEventListener("keydown", onActivity, true);
      window.clearInterval(padInterval);
    };
  }, [enabled, bump, gamepadNavigationEnabled]);

  return visible;
}
