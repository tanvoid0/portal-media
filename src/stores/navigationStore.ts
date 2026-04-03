import { create } from "zustand";
import type { FocusArea, InputMethod } from "@/types/navigation";
import { DETAILS_FOCUS_MAX_INDEX } from "@/types/navigation";
import { CATEGORY_NAV_ORDER } from "@/constants/categoryNav";

export type { FocusArea, InputMethod } from "@/types/navigation";
export { DETAILS_FOCUS_MAX_INDEX } from "@/types/navigation";

const NAV_UI_PREFS_KEY = "portal_media_nav_ui_prefs";

const FOCUS_AREAS: FocusArea[] = ["sidebar", "category", "games", "details"];
const INPUT_METHODS: InputMethod[] = ["gamepad", "mouse", "keyboard"];

/** Sidebar had 5 items (…, fullscreen, exit); now 4 (…, size toggle, exit). */
function migrateLegacySidebarIndex(idx: number): number {
  if (idx >= 0 && idx <= 2) return idx;
  if (idx === 3) return 2;
  if (idx === 4) return 3;
  return Math.min(3, Math.max(0, idx));
}

function loadNavUiPrefs(): Partial<{
  focusArea: FocusArea;
  sidebarIndex: number;
  categoryIndex: number;
  detailsIndex: number;
  inputMethod: InputMethod;
}> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(NAV_UI_PREFS_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Record<string, unknown>;
    const out: ReturnType<typeof loadNavUiPrefs> = {};
    if (typeof p.focusArea === "string" && FOCUS_AREAS.includes(p.focusArea as FocusArea)) {
      out.focusArea = p.focusArea as FocusArea;
    }
    if (typeof p.inputMethod === "string" && INPUT_METHODS.includes(p.inputMethod as InputMethod)) {
      out.inputMethod = p.inputMethod as InputMethod;
    }
    if (typeof p.sidebarIndex === "number" && Number.isInteger(p.sidebarIndex) && p.sidebarIndex >= 0) {
      out.sidebarIndex = migrateLegacySidebarIndex(p.sidebarIndex);
    }
    const maxCat = CATEGORY_NAV_ORDER.length - 1;
    if (typeof p.categoryIndex === "number" && p.categoryIndex >= 0 && p.categoryIndex <= maxCat) {
      out.categoryIndex = p.categoryIndex;
    }
    if (
      typeof p.detailsIndex === "number" &&
      p.detailsIndex >= 0 &&
      p.detailsIndex <= DETAILS_FOCUS_MAX_INDEX
    ) {
      out.detailsIndex = p.detailsIndex;
    }
    return out;
  } catch {
    return {};
  }
}

function persistNavUiPrefs(state: {
  focusArea: FocusArea;
  sidebarIndex: number;
  categoryIndex: number;
  detailsIndex: number;
  inputMethod: InputMethod;
}) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      NAV_UI_PREFS_KEY,
      JSON.stringify({
        focusArea: state.focusArea,
        sidebarIndex: state.sidebarIndex,
        categoryIndex: state.categoryIndex,
        detailsIndex: state.detailsIndex,
        inputMethod: state.inputMethod,
      })
    );
  } catch {
    // ignore
  }
}

const navUiPrefs = loadNavUiPrefs();

interface NavigationStore {
  focusArea: FocusArea;
  sidebarIndex: number; // 0 = Home, 1 = Settings, 2 = Maximize/restore, 3 = Exit
  categoryIndex: number;
  detailsIndex: number;
  /** Inclusive upper bound for `detailsIndex` (varies by page: game details vs TMDB). */
  detailsMaxIndex: number;
  inputMethod: InputMethod;
  setFocusArea: (area: FocusArea) => void;
  setSidebarIndex: (index: number) => void;
  setCategoryIndex: (index: number) => void;
  setDetailsIndex: (index: number) => void;
  setDetailsMaxIndex: (max: number) => void;
  setInputMethod: (method: InputMethod) => void;
  navigateSidebar: (direction: "up" | "down") => number;
  navigateCategory: (direction: "left" | "right") => number;
  navigateDetails: (direction: "up" | "down") => number;
  activateSidebar: () => void;
  activateCategory: () => void;
}

export const useNavigationStore = create<NavigationStore>((set, get) => ({
  focusArea: navUiPrefs.focusArea ?? "games",
  sidebarIndex: navUiPrefs.sidebarIndex ?? 0,
  categoryIndex: navUiPrefs.categoryIndex ?? 0,
  detailsIndex: navUiPrefs.detailsIndex ?? DETAILS_FOCUS_MAX_INDEX,
  detailsMaxIndex: DETAILS_FOCUS_MAX_INDEX,
  inputMethod: navUiPrefs.inputMethod ?? "mouse",

  setFocusArea: (area) => set({ focusArea: area }),

  setInputMethod: (method) => set({ inputMethod: method }),

  setSidebarIndex: (index) => {
    const maxIndex = 3; // Home, Settings, size toggle, Exit
    if (index >= 0 && index <= maxIndex) {
      set({ sidebarIndex: index });
    }
  },

  setCategoryIndex: (index) => {
    const maxIndex = CATEGORY_NAV_ORDER.length - 1;
    if (index >= 0 && index <= maxIndex) {
      set({ categoryIndex: index });
    }
  },

  setDetailsIndex: (index) => {
    const max = get().detailsMaxIndex;
    if (index >= 0 && index <= max) {
      set({ detailsIndex: index });
    }
  },

  setDetailsMaxIndex: (max) => {
    const safe = Math.max(0, Math.min(32, Math.floor(max)));
    set((s) => ({
      detailsMaxIndex: safe,
      detailsIndex: Math.min(s.detailsIndex, safe),
    }));
  },

  navigateSidebar: (direction) => {
    const { sidebarIndex } = get();
    let newIndex: number;
    if (direction === "up") {
      newIndex = Math.max(0, sidebarIndex - 1);
    } else {
      newIndex = Math.min(3, sidebarIndex + 1);
    }
    set({ sidebarIndex: newIndex });
    return newIndex;
  },

  navigateCategory: (direction) => {
    const { categoryIndex } = get();
    const maxIndex = CATEGORY_NAV_ORDER.length - 1;
    let newIndex: number;
    if (direction === "left") {
      newIndex = Math.max(0, categoryIndex - 1);
    } else {
      newIndex = Math.min(maxIndex, categoryIndex + 1);
    }
    set({ categoryIndex: newIndex });
    return newIndex;
  },

  navigateDetails: (direction) => {
    const { detailsIndex, detailsMaxIndex } = get();
    const newIndex =
      direction === "up"
        ? Math.max(0, detailsIndex - 1)
        : Math.min(detailsMaxIndex, detailsIndex + 1);
    set({ detailsIndex: newIndex });
    return newIndex;
  },

  activateSidebar: () => set({ focusArea: "sidebar" }),
  activateCategory: () => set({ focusArea: "category" }),
}));

useNavigationStore.subscribe((state) => {
  persistNavUiPrefs({
    focusArea: state.focusArea,
    sidebarIndex: state.sidebarIndex,
    categoryIndex: state.categoryIndex,
    detailsIndex: state.detailsIndex,
    inputMethod: state.inputMethod,
  });
});
