/**
 * Console-style UI feedback: thin semantic wrappers over utils/uiSounds
 * (single AudioContext + localStorage prefs, toggles in Settings → Controller).
 * All calls are fire-and-forget and no-op when sounds/haptics are disabled.
 */

import { playHaptic, playUiSound, primeUiAudio } from "@/utils/uiSounds";

/**
 * Create/resume the AudioContext from a real user gesture so later ticks are
 * not muted by autoplay policy. Called by `useUiSounds` on first input.
 */
export function primeAudio(): void {
  primeUiAudio();
}

/** Spatial move (d-pad / arrows). */
export function feedbackTick(): void {
  playUiSound("move");
}

/** Primary action / select. */
export function feedbackSelect(): void {
  playUiSound("select");
  playHaptic(35, 0.25, 0);
}

/** Back / cancel. */
export function feedbackBack(): void {
  playUiSound("back");
}

/** Overlay open (quick access, switcher, power). */
export function feedbackOpen(): void {
  playUiSound("open");
}

/** Game/app launch — the big moment. */
export function feedbackLaunch(): void {
  playUiSound("launch");
  playHaptic(160, 0.5, 0.35);
}

/**
 * Boot chime for the splash. May be silent if the webview enforces
 * autoplay-with-gesture (we never force it).
 */
export function feedbackBoot(): void {
  playUiSound("boot");
}
