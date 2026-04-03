import { create } from "zustand";
import {
  NAV_BINDINGS_STORAGE_KEY,
  NAV_BINDINGS_STORAGE_VERSION,
  createDefaultNavActions,
  NAV_ACTION_IDS,
  type NavActionBinding,
  type NavActionId,
  type NavBindingsPersisted,
  type KeyboardChord,
} from "@/types/navBindings";
import { anyChordMatches } from "@/utils/navBindingMatch";

function cloneBinding(b: NavActionBinding): NavActionBinding {
  return {
    enabled: b.enabled,
    keyboard: b.keyboard.map((c) => ({ ...c })),
    gamepadButtons: [...b.gamepadButtons],
  };
}

function mergeWithDefaults(
  partial: Partial<Record<NavActionId, NavActionBinding>> | undefined
): Record<NavActionId, NavActionBinding> {
  const defaults = createDefaultNavActions();
  const out = { ...defaults };
  if (!partial) return out;
  for (const id of NAV_ACTION_IDS) {
    const p = partial[id];
    if (!p) continue;
    out[id] = {
      enabled: typeof p.enabled === "boolean" ? p.enabled : defaults[id].enabled,
      keyboard: Array.isArray(p.keyboard) ? p.keyboard.map((c) => ({ ...c })) : defaults[id].keyboard,
      gamepadButtons: Array.isArray(p.gamepadButtons)
        ? [...p.gamepadButtons]
        : defaults[id].gamepadButtons,
    };
  }
  return out;
}

function resolveRemoteBindingsEnabled(
  p: Partial<NavBindingsPersisted> & { version?: number },
  ver: number
): boolean {
  if (typeof p.remoteBindingsEnabled === "boolean") return p.remoteBindingsEnabled;
  return ver < 3;
}

function loadPersisted(): Omit<NavBindingsState, never> {
  const fresh = (): NavBindingsState => ({
    remoteBindingsEnabled: false,
    keyboardNavigationEnabled: true,
    gamepadNavigationEnabled: true,
    useLeftStickForSpatial: true,
    quickAccessMetaTapEnabled: true,
    actions: createDefaultNavActions(),
  });

  if (typeof window === "undefined") {
    return fresh();
  }
  try {
    const raw = localStorage.getItem(NAV_BINDINGS_STORAGE_KEY);
    if (!raw) {
      return fresh();
    }
    const p = JSON.parse(raw) as NavBindingsPersisted & { version?: number };
    if (!p.actions) {
      return fresh();
    }
    const ver = typeof p.version === "number" ? p.version : 1;
    let actions = mergeWithDefaults(p.actions);
    if (ver === 1) {
      const home = p.actions.quickAccessHome;
      if (home && Array.isArray(home.gamepadButtons) && home.gamepadButtons.length > 0) {
        actions = {
          ...actions,
          gamepadQuickAccessOverlay: {
            ...actions.gamepadQuickAccessOverlay,
            gamepadButtons: [
              ...new Set([
                ...actions.gamepadQuickAccessOverlay.gamepadButtons,
                ...home.gamepadButtons,
              ]),
            ],
          },
          quickAccessHome: {
            ...actions.quickAccessHome,
            gamepadButtons: [],
          },
        };
      }
    }
    if (ver !== NAV_BINDINGS_STORAGE_VERSION && ver !== 1 && ver !== 2) {
      return fresh();
    }
    return {
      remoteBindingsEnabled: resolveRemoteBindingsEnabled(p, ver),
      keyboardNavigationEnabled:
        typeof (p as NavBindingsPersisted).keyboardNavigationEnabled === "boolean"
          ? (p as NavBindingsPersisted).keyboardNavigationEnabled
          : true,
      gamepadNavigationEnabled:
        typeof (p as NavBindingsPersisted).gamepadNavigationEnabled === "boolean"
          ? (p as NavBindingsPersisted).gamepadNavigationEnabled
          : true,
      useLeftStickForSpatial: typeof p.useLeftStickForSpatial === "boolean" ? p.useLeftStickForSpatial : true,
      quickAccessMetaTapEnabled:
        typeof p.quickAccessMetaTapEnabled === "boolean" ? p.quickAccessMetaTapEnabled : true,
      actions,
    };
  } catch {
    return fresh();
  }
}

function persistState(s: NavBindingsState): void {
  if (typeof window === "undefined") return;
  try {
    const body: NavBindingsPersisted = {
      version: NAV_BINDINGS_STORAGE_VERSION,
      remoteBindingsEnabled: s.remoteBindingsEnabled,
      keyboardNavigationEnabled: s.keyboardNavigationEnabled,
      gamepadNavigationEnabled: s.gamepadNavigationEnabled,
      useLeftStickForSpatial: s.useLeftStickForSpatial,
      quickAccessMetaTapEnabled: s.quickAccessMetaTapEnabled,
      actions: s.actions,
    };
    localStorage.setItem(NAV_BINDINGS_STORAGE_KEY, JSON.stringify(body));
  } catch {
    /* ignore */
  }
}

type NavBindingsState = {
  remoteBindingsEnabled: boolean;
  keyboardNavigationEnabled: boolean;
  gamepadNavigationEnabled: boolean;
  useLeftStickForSpatial: boolean;
  quickAccessMetaTapEnabled: boolean;
  actions: Record<NavActionId, NavActionBinding>;
};

interface NavBindingsStore extends NavBindingsState {
  setRemoteBindingsEnabled: (v: boolean) => void;
  setKeyboardNavigationEnabled: (v: boolean) => void;
  setGamepadNavigationEnabled: (v: boolean) => void;
  setActionEnabled: (id: NavActionId, enabled: boolean) => void;
  setActionKeyboard: (id: NavActionId, keyboard: KeyboardChord[]) => void;
  setActionGamepadButtons: (id: NavActionId, gamepadButtons: number[]) => void;
  setUseLeftStickForSpatial: (v: boolean) => void;
  setQuickAccessMetaTapEnabled: (v: boolean) => void;
  resetAction: (id: NavActionId) => void;
  resetAll: () => void;
}

const initial = loadPersisted();

export const useNavBindingsStore = create<NavBindingsStore>((set) => ({
  ...initial,

  setRemoteBindingsEnabled: (v) => set({ remoteBindingsEnabled: v }),

  setKeyboardNavigationEnabled: (v) => set({ keyboardNavigationEnabled: v }),

  setGamepadNavigationEnabled: (v) => set({ gamepadNavigationEnabled: v }),

  setActionEnabled: (id, enabled) =>
    set((s) => ({
      actions: {
        ...s.actions,
        [id]: { ...s.actions[id], enabled },
      },
    })),

  setActionKeyboard: (id, keyboard) =>
    set((s) => ({
      actions: {
        ...s.actions,
        [id]: { ...s.actions[id], keyboard },
      },
    })),

  setActionGamepadButtons: (id, gamepadButtons) =>
    set((s) => ({
      actions: {
        ...s.actions,
        [id]: { ...s.actions[id], gamepadButtons },
      },
    })),

  setUseLeftStickForSpatial: (v) => set({ useLeftStickForSpatial: v }),

  setQuickAccessMetaTapEnabled: (v) => set({ quickAccessMetaTapEnabled: v }),

  resetAction: (id) =>
    set((s) => {
      const defaults = createDefaultNavActions();
      return {
        actions: {
          ...s.actions,
          [id]: cloneBinding(defaults[id]),
        },
      };
    }),

  resetAll: () =>
    set({
      remoteBindingsEnabled: false,
      keyboardNavigationEnabled: true,
      gamepadNavigationEnabled: true,
      useLeftStickForSpatial: true,
      quickAccessMetaTapEnabled: true,
      actions: createDefaultNavActions(),
    }),
}));

useNavBindingsStore.subscribe((state) => {
  persistState({
    remoteBindingsEnabled: state.remoteBindingsEnabled,
    keyboardNavigationEnabled: state.keyboardNavigationEnabled,
    gamepadNavigationEnabled: state.gamepadNavigationEnabled,
    useLeftStickForSpatial: state.useLeftStickForSpatial,
    quickAccessMetaTapEnabled: state.quickAccessMetaTapEnabled,
    actions: state.actions,
  });
});

/** For non-React modules (universalNavCore). */
export function getNavBinding(id: NavActionId): NavActionBinding {
  const s = useNavBindingsStore.getState();
  if (!s.remoteBindingsEnabled) {
    const d = createDefaultNavActions()[id];
    return { ...d, enabled: true };
  }
  return s.actions[id];
}

export function useLeftStickForSpatialEffective(): boolean {
  const s = useNavBindingsStore.getState();
  if (!s.remoteBindingsEnabled) return true;
  return s.useLeftStickForSpatial;
}

export function quickAccessMetaTapEffective(): boolean {
  const s = useNavBindingsStore.getState();
  if (!s.remoteBindingsEnabled) return true;
  return s.quickAccessMetaTapEnabled;
}

export function isNavActionKeyboardMatch(id: NavActionId, e: KeyboardEvent): boolean {
  const b = getNavBinding(id);
  if (!b.enabled || b.keyboard.length === 0) return false;
  return anyChordMatches(b.keyboard, e);
}

export function isKeyboardNavigationEnabled(): boolean {
  return useNavBindingsStore.getState().keyboardNavigationEnabled;
}

export function isGamepadNavigationEnabled(): boolean {
  return useNavBindingsStore.getState().gamepadNavigationEnabled;
}
