/**
 * Console-style UI feedback sounds, synthesized with WebAudio (no asset files).
 * Volumes are deliberately low — feedback, not fanfare.
 * Mute via localStorage "portal.uiSounds" = "off" (Settings → Appearance).
 */

export type UiSoundKind = "move" | "select" | "back" | "open" | "launch" | "boot";

const PREF_KEY = "portal.uiSounds";
const HAPTICS_PREF_KEY = "portal.haptics";

export function uiSoundsEnabled(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setUiSoundsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, enabled ? "on" : "off");
  } catch {
    /* ignore */
  }
}

export function hapticsEnabled(): boolean {
  try {
    return localStorage.getItem(HAPTICS_PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setHapticsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(HAPTICS_PREF_KEY, enabled ? "on" : "off");
  } catch {
    /* ignore */
  }
}

/** Controller rumble (launch and other big moments). No-op without a pad/actuator. */
export function playHaptic(duration: number, weak: number, strong: number): void {
  if (!hapticsEnabled()) return;
  const pads = navigator.getGamepads?.() ?? [];
  const pad = Array.from(pads).find((p) => p !== null) ?? null;
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

let ctx: AudioContext | null = null;

/**
 * Per-kind rate limit. Doubles as dedupe: the same user action can be reported
 * by both a store subscription (useUiSounds) and an inline call site —
 * only the first within the window plays.
 */
const lastPlayedAt = new Map<UiSoundKind, number>();
const MIN_INTERVAL_MS: Record<UiSoundKind, number> = {
  move: 45,
  select: 80,
  back: 80,
  open: 80,
  launch: 250,
  boot: 1000,
};

function getCtx(): AudioContext | null {
  if (typeof AudioContext === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Create/resume the context from a real user gesture (autoplay policy). */
export function primeUiAudio(): void {
  getCtx();
}

function tone(
  ac: AudioContext,
  {
    freq,
    freqEnd,
    duration,
    gain,
    type = "sine",
    delay = 0,
  }: {
    freq: number;
    freqEnd?: number;
    duration: number;
    gain: number;
    type?: OscillatorType;
    delay?: number;
  }
): void {
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + duration);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export function playUiSound(kind: UiSoundKind): void {
  if (!uiSoundsEnabled()) return;
  const ac = getCtx();
  if (!ac) return;

  const now = performance.now();
  if (now - (lastPlayedAt.get(kind) ?? -Infinity) < MIN_INTERVAL_MS[kind]) return;
  lastPlayedAt.set(kind, now);

  switch (kind) {
    case "move":
      tone(ac, { freq: 950, freqEnd: 720, duration: 0.05, gain: 0.035, type: "sine" });
      break;
    case "select":
      tone(ac, { freq: 540, duration: 0.07, gain: 0.05, type: "sine" });
      tone(ac, { freq: 810, duration: 0.1, gain: 0.045, type: "sine", delay: 0.055 });
      break;
    case "back":
      tone(ac, { freq: 620, freqEnd: 400, duration: 0.09, gain: 0.045, type: "sine" });
      break;
    case "open":
      tone(ac, { freq: 420, freqEnd: 620, duration: 0.11, gain: 0.04, type: "sine" });
      break;
    case "launch":
      // Rising three-step — the big moment; pairs with a rumble at the call site.
      tone(ac, { freq: 620, duration: 0.1, gain: 0.05 });
      tone(ac, { freq: 930, duration: 0.12, gain: 0.05, delay: 0.07 });
      tone(ac, { freq: 1240, duration: 0.2, gain: 0.045, delay: 0.15 });
      break;
    case "boot":
      // Soft triangle chord for the splash; may stay silent under autoplay policy.
      tone(ac, { freq: 520, duration: 0.35, gain: 0.045, type: "triangle" });
      tone(ac, { freq: 780, duration: 0.35, gain: 0.04, type: "triangle", delay: 0.12 });
      tone(ac, { freq: 1040, duration: 0.6, gain: 0.045, type: "triangle", delay: 0.24 });
      break;
  }
}
