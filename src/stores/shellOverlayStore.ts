import { create } from "zustand";
import { CLOSE_SHELL_SEARCH_EVENT } from "@/types/app";

interface ShellOverlayStore {
  quickAccessOpen: boolean;
  appSwitcherOpen: boolean;
  /** Compact toolbar search popover (see SearchBar). */
  searchPopoverOpen: boolean;
  gameContextMenuOpen: boolean;
  contextMenuFocusIndex: number;
  contextMenuItemCount: number;
  setQuickAccessOpen: (open: boolean) => void;
  setSearchPopoverOpen: (open: boolean) => void;
  toggleQuickAccess: () => void;
  setAppSwitcherOpen: (open: boolean) => void;
  toggleAppSwitcher: () => void;
  setGameContextMenuOpen: (open: boolean) => void;
  toggleGameContextMenu: () => void;
  setContextMenuFocusIndex: (index: number) => void;
  setContextMenuItemCount: (n: number) => void;
  closeAllOverlays: () => void;
}

export const useShellOverlayStore = create<ShellOverlayStore>((set, get) => ({
  quickAccessOpen: false,
  appSwitcherOpen: false,
  searchPopoverOpen: false,
  gameContextMenuOpen: false,
  contextMenuFocusIndex: 0,
  contextMenuItemCount: 0,

  setQuickAccessOpen: (open) =>
    set(() => {
      if (open) {
        window.dispatchEvent(new CustomEvent(CLOSE_SHELL_SEARCH_EVENT));
      }
      return {
        quickAccessOpen: open,
        ...(open
          ? {
              appSwitcherOpen: false,
              searchPopoverOpen: false,
              gameContextMenuOpen: false,
              contextMenuItemCount: 0,
            }
          : {}),
      };
    }),

  setSearchPopoverOpen: (open) => set({ searchPopoverOpen: open }),

  toggleQuickAccess: () => {
    const { quickAccessOpen } = get();
    const opening = !quickAccessOpen;
    if (opening) {
      window.dispatchEvent(new CustomEvent(CLOSE_SHELL_SEARCH_EVENT));
    }
    set({
      quickAccessOpen: opening,
      ...(opening
        ? {
            appSwitcherOpen: false,
            searchPopoverOpen: false,
            gameContextMenuOpen: false,
            contextMenuItemCount: 0,
          }
        : {}),
    });
  },

  setAppSwitcherOpen: (open) =>
    set(() => {
      if (open) {
        window.dispatchEvent(new CustomEvent(CLOSE_SHELL_SEARCH_EVENT));
      }
      return {
        appSwitcherOpen: open,
        ...(open ? { quickAccessOpen: false, searchPopoverOpen: false } : {}),
      };
    }),

  toggleAppSwitcher: () => {
    const { appSwitcherOpen } = get();
    const opening = !appSwitcherOpen;
    if (opening) {
      window.dispatchEvent(new CustomEvent(CLOSE_SHELL_SEARCH_EVENT));
    }
    set({
      appSwitcherOpen: opening,
      ...(opening ? { quickAccessOpen: false, searchPopoverOpen: false } : {}),
    });
  },

  setGameContextMenuOpen: (open) =>
    set(() => {
      if (open) {
        window.dispatchEvent(new CustomEvent(CLOSE_SHELL_SEARCH_EVENT));
      }
      return {
        gameContextMenuOpen: open,
        contextMenuFocusIndex: 0,
        ...(open ? { searchPopoverOpen: false } : {}),
        ...(!open ? { contextMenuItemCount: 0 } : {}),
      };
    }),

  toggleGameContextMenu: () => {
    const { gameContextMenuOpen } = get();
    const opening = !gameContextMenuOpen;
    if (opening) {
      window.dispatchEvent(new CustomEvent(CLOSE_SHELL_SEARCH_EVENT));
    }
    set({
      gameContextMenuOpen: opening,
      contextMenuFocusIndex: 0,
      ...(opening ? { searchPopoverOpen: false } : {}),
      ...(!opening ? { contextMenuItemCount: 0 } : {}),
    });
  },

  setContextMenuFocusIndex: (index) => {
    const { contextMenuItemCount } = get();
    const max = Math.max(0, contextMenuItemCount - 1);
    set({ contextMenuFocusIndex: Math.min(max, Math.max(0, index)) });
  },

  setContextMenuItemCount: (n) =>
    set({ contextMenuItemCount: Math.max(0, n) }),

  closeAllOverlays: () => {
    window.dispatchEvent(new CustomEvent(CLOSE_SHELL_SEARCH_EVENT));
    set({
      quickAccessOpen: false,
      appSwitcherOpen: false,
      searchPopoverOpen: false,
      gameContextMenuOpen: false,
      contextMenuFocusIndex: 0,
      contextMenuItemCount: 0,
    });
  },
}));
