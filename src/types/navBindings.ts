/**
 * User-configurable shell navigation: keyboard chords + gamepad button indices.
 * Defaults mirror legacy hardcoded behaviour in universalNavCore / useUnifiedNavigation.
 */

export const NAV_BINDINGS_STORAGE_VERSION = 3;
export const NAV_BINDINGS_STORAGE_KEY = "portal_media_nav_bindings";

export type KeyboardChord = {
  /** Physical key (preferred for remotes / consistent layout). */
  code?: string;
  /** Logical key fallback when `code` is missing or unreliable. */
  key?: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
};

export type NavActionBinding = {
  enabled: boolean;
  keyboard: KeyboardChord[];
  /** Standard gamepad button indices (Gamepad API). */
  gamepadButtons: number[];
};

export const NAV_ACTION_IDS = [
  "spatialUp",
  "spatialDown",
  "spatialLeft",
  "spatialRight",
  "primary",
  "back",
  "quickAccessHome",
  "gamepadQuickAccessOverlay",
  "gamepadSettingsMenu",
  "gameMenu",
  "openSearch",
  "cycleShellTabForward",
  "cycleShellTabReverse",
  "quickLaunch",
  "categoryBumperLeft",
  "categoryBumperRight",
  "scrollSelectionPrev",
  "scrollSelectionNext",
  "historyBack",
  "historyForward",
] as const;

export type NavActionId = (typeof NAV_ACTION_IDS)[number];

export const NAV_ACTION_LABELS: Record<NavActionId, string> = {
  spatialUp: "Move up",
  spatialDown: "Move down",
  spatialLeft: "Move left",
  spatialRight: "Move right",
  primary: "Select / activate",
  back: "Back / cancel",
  quickAccessHome: "Home key (quick access or library)",
  gamepadQuickAccessOverlay: "Quick access overlay (View / Share)",
  gamepadSettingsMenu: "Settings: Start / Guide (exit to library, close browser)",
  gameMenu: "Game options menu / focus shell (Context Menu)",
  openSearch: "Open search",
  cycleShellTabForward: "Next shell focus (Tab)",
  cycleShellTabReverse: "Previous shell focus (Shift+Tab)",
  quickLaunch: "Quick launch (grid)",
  categoryBumperLeft: "Category / bumper left",
  categoryBumperRight: "Category / bumper right",
  scrollSelectionPrev: "Previous item (shoulder / trigger)",
  scrollSelectionNext: "Next item (shoulder / trigger)",
  historyBack: "In-app history back (Alt+Left)",
  historyForward: "In-app history forward (Alt+Right)",
};

export const NAV_ACTION_GROUPS: { title: string; ids: NavActionId[] }[] = [
  {
    title: "Move",
    ids: ["spatialUp", "spatialDown", "spatialLeft", "spatialRight"],
  },
  {
    title: "Core",
    ids: [
      "primary",
      "back",
      "quickAccessHome",
      "gamepadQuickAccessOverlay",
      "gamepadSettingsMenu",
      "gameMenu",
      "openSearch",
    ],
  },
  {
    title: "Shell focus",
    ids: ["cycleShellTabForward", "cycleShellTabReverse"],
  },
  {
    title: "Library grid",
    ids: [
      "quickLaunch",
      "categoryBumperLeft",
      "categoryBumperRight",
      "scrollSelectionPrev",
      "scrollSelectionNext",
    ],
  },
  {
    title: "History",
    ids: ["historyBack", "historyForward"],
  },
];

function chord(
  code: string,
  mods?: Partial<Pick<KeyboardChord, "altKey" | "ctrlKey" | "shiftKey" | "metaKey">>
): KeyboardChord {
  return {
    code,
    altKey: mods?.altKey ?? false,
    ctrlKey: mods?.ctrlKey ?? false,
    shiftKey: mods?.shiftKey ?? false,
    metaKey: mods?.metaKey ?? false,
  };
}

function chordKey(
  key: string,
  code: string,
  mods?: Partial<Pick<KeyboardChord, "altKey" | "ctrlKey" | "shiftKey" | "metaKey">>
): KeyboardChord {
  return {
    key,
    code,
    altKey: mods?.altKey ?? false,
    ctrlKey: mods?.ctrlKey ?? false,
    shiftKey: mods?.shiftKey ?? false,
    metaKey: mods?.metaKey ?? false,
  };
}

/** Default bindings = previous app behaviour. */
export function createDefaultNavActions(): Record<NavActionId, NavActionBinding> {
  return {
    spatialUp: {
      enabled: true,
      keyboard: [chord("ArrowUp"), chordKey("Up", "ArrowUp"), chord("Numpad8")],
      gamepadButtons: [12],
    },
    spatialDown: {
      enabled: true,
      keyboard: [chord("ArrowDown"), chordKey("Down", "ArrowDown"), chord("Numpad2")],
      gamepadButtons: [13],
    },
    spatialLeft: {
      enabled: true,
      keyboard: [chord("ArrowLeft"), chordKey("Left", "ArrowLeft"), chord("Numpad4")],
      gamepadButtons: [14],
    },
    spatialRight: {
      enabled: true,
      keyboard: [chord("ArrowRight"), chordKey("Right", "ArrowRight"), chord("Numpad6")],
      gamepadButtons: [15],
    },
    primary: {
      enabled: true,
      keyboard: [
        chord("Enter"),
        { code: "Space", key: " ", altKey: false, ctrlKey: false, shiftKey: false, metaKey: false },
        chord("NumpadEnter"),
      ],
      gamepadButtons: [0],
    },
    back: {
      enabled: true,
      keyboard: [
        chord("Escape"),
        { code: "BrowserBack", key: "BrowserBack", altKey: false, ctrlKey: false, shiftKey: false, metaKey: false },
        { key: "GoBack", altKey: false, ctrlKey: false, shiftKey: false, metaKey: false },
        { code: "BrowserBack", altKey: false, ctrlKey: false, shiftKey: false, metaKey: false },
      ],
      gamepadButtons: [1],
    },
    quickAccessHome: {
      enabled: true,
      keyboard: [chord("Home")],
      gamepadButtons: [],
    },
    gamepadQuickAccessOverlay: {
      enabled: true,
      keyboard: [],
      gamepadButtons: [8],
    },
    gamepadSettingsMenu: {
      enabled: true,
      keyboard: [],
      gamepadButtons: [8, 9, 16],
    },
    gameMenu: {
      enabled: true,
      keyboard: [
        chord("ContextMenu"),
        { code: "F10", key: "F10", altKey: false, ctrlKey: false, shiftKey: false, metaKey: false },
      ],
      gamepadButtons: [9],
    },
    openSearch: {
      enabled: true,
      keyboard: [chordKey("/", "Slash")],
      gamepadButtons: [3],
    },
    cycleShellTabForward: {
      enabled: true,
      keyboard: [chord("Tab", { shiftKey: false })],
      gamepadButtons: [],
    },
    cycleShellTabReverse: {
      enabled: true,
      keyboard: [chord("Tab", { shiftKey: true })],
      gamepadButtons: [],
    },
    quickLaunch: {
      enabled: true,
      keyboard: [],
      gamepadButtons: [2],
    },
    categoryBumperLeft: {
      enabled: true,
      keyboard: [],
      gamepadButtons: [4],
    },
    categoryBumperRight: {
      enabled: true,
      keyboard: [],
      gamepadButtons: [5],
    },
    scrollSelectionPrev: {
      enabled: true,
      keyboard: [],
      gamepadButtons: [6],
    },
    scrollSelectionNext: {
      enabled: true,
      keyboard: [],
      gamepadButtons: [7],
    },
    historyBack: {
      enabled: true,
      keyboard: [chord("ArrowLeft", { altKey: true })],
      gamepadButtons: [],
    },
    historyForward: {
      enabled: true,
      keyboard: [chord("ArrowRight", { altKey: true })],
      gamepadButtons: [],
    },
  };
}

export type NavBindingsPersisted = {
  version: number;
  /**
   * When false (default for new installs): fixed built-in navigation only; hint bar hidden.
   * When true: per-action bindings and settings apply; hint bar visible.
   */
  remoteBindingsEnabled: boolean;
  /**
   * When false: `processUniversalKeydown` ignores navigation keys (spatial shell, overlays, in-app history chords).
   * Tab and typing in inputs still behave natively. Default true.
   */
  keyboardNavigationEnabled: boolean;
  /**
   * When false: controller/gamepad input is ignored for navigation (shell + embedded browser).
   * Keyboard and mouse are unchanged. Default true.
   */
  gamepadNavigationEnabled: boolean;
  useLeftStickForSpatial: boolean;
  quickAccessMetaTapEnabled: boolean;
  actions: Record<NavActionId, NavActionBinding>;
};
