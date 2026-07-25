import { create } from "zustand";

const SOUND_KEY = "portal_media_ui_sounds";
const HAPTICS_KEY = "portal_media_haptics";
const VOLUME_KEY = "portal_media_ui_sound_volume";

function loadBool(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw === "true";
  } catch {
    return fallback;
  }
}

function loadVolume(): number {
  if (typeof window === "undefined") return 0.5;
  try {
    const raw = Number(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 0.5;
  } catch {
    return 0.5;
  }
}

interface FeedbackStore {
  /** Synthesized navigation/select sounds (see utils/uiFeedback). */
  soundEnabled: boolean;
  /** Controller rumble on select/launch. */
  hapticsEnabled: boolean;
  /** 0..1 master volume for UI sounds. */
  soundVolume: number;
  setSoundEnabled: (on: boolean) => void;
  setHapticsEnabled: (on: boolean) => void;
  setSoundVolume: (v: number) => void;
}

export const useFeedbackStore = create<FeedbackStore>((set) => ({
  soundEnabled: loadBool(SOUND_KEY, true),
  hapticsEnabled: loadBool(HAPTICS_KEY, true),
  soundVolume: loadVolume(),
  setSoundEnabled: (on) => {
    try {
      localStorage.setItem(SOUND_KEY, String(on));
    } catch {
      /* ignore */
    }
    set({ soundEnabled: on });
  },
  setHapticsEnabled: (on) => {
    try {
      localStorage.setItem(HAPTICS_KEY, String(on));
    } catch {
      /* ignore */
    }
    set({ hapticsEnabled: on });
  },
  setSoundVolume: (v) => {
    const clamped = Math.min(1, Math.max(0, v));
    try {
      localStorage.setItem(VOLUME_KEY, String(clamped));
    } catch {
      /* ignore */
    }
    set({ soundVolume: clamped });
  },
}));
