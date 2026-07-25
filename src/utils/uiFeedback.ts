/**
 * Console-style UI feedback: synthesized WebAudio blips + gamepad rumble.
 * No audio assets — tones are generated (PS5/SteamOS-like soft ticks).
 * All calls are fire-and-forget and no-op when disabled in Settings → Controller.
 */

import { useFeedbackStore } from "@/stores/feedbackStore";
import { getActiveGamepad } from "@/utils/getActiveGamepad";

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  // Autoplay policy: resume on the user-gesture-driven calls that got us here.
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }
  return ctx;
}

/**
 * Create/resume the AudioContext from a real user gesture so later ticks are
 * not muted by autoplay policy. Called by `useUiSounds` on first input.
 */
export function primeAudio(): void {
  audioContext();
}

type ToneStep = {
  /** Start frequency in Hz. */
  freq: number;
  /** Optional glide-to frequency. */
  to?: number;
  /** Duration in seconds. */
  dur: number;
  /** Delay from call time in seconds. */
  at?: number;
  /** Relative gain 0..1 (scaled by master volume). */
  gain?: number;
  type?: OscillatorType;
};

function playTones(steps: ToneStep[]): void {
  const s = useFeedbackStore.getState();
  if (!s.soundEnabled || s.soundVolume <= 0) return;
  const ac = audioContext();
  if (!ac || ac.state !== "running") return;

  const master = 0.08 * s.soundVolume; // keep it a whisper, console-style
  for (const step of steps) {
    const t0 = ac.currentTime + (step.at ?? 0);
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = step.type ?? "sine";
    osc.frequency.setValueAtTime(step.freq, t0);
    if (step.to) {
      osc.frequency.exponentialRampToValueAtTime(step.to, t0 + step.dur);
    }
    const peak = master * (step.gain ?? 1);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + step.dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + step.dur + 0.02);
  }
}

function rumble(duration: number, weak: number, strong: number): void {
  if (!useFeedbackStore.getState().hapticsEnabled) return;
  const pad = getActiveGamepad();
  const actuator = pad?.vibrationActuator;
  if (!actuator) return;
  try {
    void actuator.playEffect("dual-rumble", {
      duration,
      weakMagnitude: weak,
      strongMagnitude: strong,
    });
  } catch {
    /* older pads / browsers */
  }
}

/** Spatial move (d-pad / arrows). */
export function feedbackTick(): void {
  playTones([{ freq: 1500, dur: 0.045, gain: 0.7 }]);
}

/** Primary action / select. */
export function feedbackSelect(): void {
  playTones([{ freq: 900, to: 1350, dur: 0.09 }]);
  rumble(35, 0.25, 0);
}

/** Back / cancel. */
export function feedbackBack(): void {
  playTones([{ freq: 1000, to: 700, dur: 0.08 }]);
}

/** Overlay open (quick access, switcher, power). */
export function feedbackOpen(): void {
  playTones([
    { freq: 750, dur: 0.06, gain: 0.8 },
    { freq: 1120, dur: 0.08, at: 0.045 },
  ]);
}

/** Game/app launch — the big moment. */
export function feedbackLaunch(): void {
  playTones([
    { freq: 620, dur: 0.1 },
    { freq: 930, dur: 0.12, at: 0.07 },
    { freq: 1240, dur: 0.2, at: 0.15, gain: 0.9 },
  ]);
  rumble(160, 0.5, 0.35);
}

/**
 * Boot chime for the splash. May be silent if the webview enforces
 * autoplay-with-gesture (we never force it).
 */
export function feedbackBoot(): void {
  playTones([
    { freq: 520, dur: 0.35, type: "triangle", gain: 0.9 },
    { freq: 780, dur: 0.35, at: 0.12, type: "triangle", gain: 0.8 },
    { freq: 1040, dur: 0.6, at: 0.24, type: "triangle" },
  ]);
}
