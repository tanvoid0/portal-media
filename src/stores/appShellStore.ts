import { create } from "zustand";
import type { AppView } from "@/types/app";

/**
 * View + shell state so keyboard/gamepad core can respect Settings vs Library without React context.
 */
interface AppShellStore {
  currentView: AppView;
  setCurrentView: (v: AppView | ((prev: AppView) => AppView)) => void;
}

export const useAppShellStore = create<AppShellStore>((set) => ({
  currentView: "games",
  setCurrentView: (v) =>
    set((s) => ({
      currentView: typeof v === "function" ? (v as (p: AppView) => AppView)(s.currentView) : v,
    })),
}));
