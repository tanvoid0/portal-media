import { create } from "zustand";
import {
  type ThemeAppearance,
  type ThemeId,
  THEME_IDS,
  DEFAULT_THEME_ID,
  DEFAULT_APPEARANCE,
} from "@/types/theme";

const LEGACY_THEME_KEY = "theme";
const APPEARANCE_STORAGE_KEY = "portal_media_appearance";
const THEME_ID_STORAGE_KEY = "portal_media_theme_id";

/** Older builds stored these ids; map to current theme names so saved prefs keep working */
const LEGACY_THEME_ID_MAP: Record<string, ThemeId> = {
  playstation: "nimbus",
  xbox: "vertex",
  steam: "forge",
  netflix: "velvet",
};

function isThemeId(value: string): value is ThemeId {
  return (THEME_IDS as readonly string[]).includes(value);
}

function normalizeStoredThemeId(raw: string): ThemeId | null {
  if (isThemeId(raw)) return raw;
  const mapped = LEGACY_THEME_ID_MAP[raw];
  return mapped ?? null;
}

function loadThemeId(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;
  try {
    const raw = localStorage.getItem(THEME_ID_STORAGE_KEY);
    if (!raw) return DEFAULT_THEME_ID;
    const id = normalizeStoredThemeId(raw);
    if (id) {
      if (raw !== id) {
        localStorage.setItem(THEME_ID_STORAGE_KEY, id);
      }
      return id;
    }
  } catch {
    // ignore
  }
  return DEFAULT_THEME_ID;
}

function loadAppearance(): ThemeAppearance {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  try {
    const stored = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    const legacy = localStorage.getItem(LEGACY_THEME_KEY);
    if (legacy === "light" || legacy === "dark") {
      localStorage.setItem(APPEARANCE_STORAGE_KEY, legacy);
      localStorage.removeItem(LEGACY_THEME_KEY);
      return legacy;
    }
  } catch {
    // ignore
  }
  return DEFAULT_APPEARANCE;
}

function applyDocumentTheme(themeId: ThemeId, appearance: ThemeAppearance) {
  const root = document.documentElement;
  root.dataset.theme = themeId;
  root.classList.remove("light", "dark");
  root.classList.add(appearance);
  try {
    localStorage.setItem(THEME_ID_STORAGE_KEY, themeId);
    localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance);
  } catch {
    // ignore
  }
}

interface ThemeStoreState {
  themeId: ThemeId;
  appearance: ThemeAppearance;
  setThemeId: (id: ThemeId) => void;
  setAppearance: (next: ThemeAppearance) => void;
  toggleAppearance: () => void;
}

export const useThemeStore = create<ThemeStoreState>((set, get) => ({
  themeId: loadThemeId(),
  appearance: loadAppearance(),

  setThemeId: (themeId) => {
    set({ themeId });
    applyDocumentTheme(themeId, get().appearance);
  },

  setAppearance: (appearance) => {
    set({ appearance });
    applyDocumentTheme(get().themeId, appearance);
  },

  toggleAppearance: () => {
    const next = get().appearance === "light" ? "dark" : "light";
    set({ appearance: next });
    applyDocumentTheme(get().themeId, next);
  },
}));

/** Call once before React mount so first paint has correct tokens. */
export function hydrateThemeFromStorage() {
  const themeId = loadThemeId();
  const appearance = loadAppearance();
  applyDocumentTheme(themeId, appearance);
  useThemeStore.setState({ themeId, appearance });
}
