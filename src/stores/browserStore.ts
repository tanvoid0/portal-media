import { create } from "zustand";
import type { BrowserHistory, BrowserTab } from "@/types/browser";
import { useSessionStore } from "@/stores/sessionStore";

export type { BrowserHistory, BrowserTab } from "@/types/browser";

interface BrowserState {
  isOpen: boolean;
  isMinimized: boolean;
  /** True from open/navigate until main webview navigation finishes (sync with user click, before React effect). */
  shellLoading: boolean;
  tabs: BrowserTab[];
  activeTabId: string | null;
  history: BrowserHistory[];
  
  // Actions
  openBrowser: (url: string) => void;
  closeBrowser: () => void;
  minimizeBrowser: () => void;
  restoreBrowser: () => void;
  addTab: (url: string) => string;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, updates: Partial<BrowserTab>) => void;
  navigateTab: (tabId: string, url: string) => void;
  goBack: (tabId: string) => void;
  goForward: (tabId: string) => void;
  addToHistory: (url: string, title: string) => void;
}

export const useBrowserStore = create<BrowserState>((set, get) => ({
  isOpen: false,
  isMinimized: false,
  shellLoading: false,
  tabs: [],
  activeTabId: null,
  history: [],

  openBrowser: (url: string) => {
    const { tabs, addTab } = get();
    let tabId: string;
    
    if (tabs.length === 0) {
      tabId = addTab(url);
    } else {
      tabId = tabs[0].id;
      get().navigateTab(tabId, url);
    }
    
    set({
      isOpen: true,
      isMinimized: false,
      activeTabId: tabId,
      shellLoading: true,
    });
    useSessionStore.getState().upsertBrowserSession();
  },

  closeBrowser: () => {
    set({
      isOpen: false,
      isMinimized: false,
      shellLoading: false,
      tabs: [],
      activeTabId: null,
    });
  },

  minimizeBrowser: () => {
    set({ isMinimized: true });
  },

  restoreBrowser: () => {
    set({ isMinimized: false });
  },

  addTab: (url: string) => {
    const tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newTab: BrowserTab = {
      id: tabId,
      url,
      title: "Loading...",
      canGoBack: false,
      canGoForward: false,
    };
    
    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: tabId,
    }));
    
    return tabId;
  },

  closeTab: (tabId: string) => {
    set((state) => {
      const newTabs = state.tabs.filter((tab) => tab.id !== tabId);
      let newActiveTabId = state.activeTabId;
      
      // If we closed the active tab, switch to another one
      if (tabId === state.activeTabId) {
        if (newTabs.length > 0) {
          // Switch to the tab that was before this one, or the first tab
          const closedIndex = state.tabs.findIndex((t) => t.id === tabId);
          const newIndex = closedIndex > 0 ? closedIndex - 1 : 0;
          newActiveTabId = newTabs[newIndex]?.id || null;
        } else {
          newActiveTabId = null;
          // If no tabs left, close browser
          return {
            tabs: [],
            activeTabId: null,
            isOpen: false,
            isMinimized: false,
            shellLoading: false,
          };
        }
      }
      
      return {
        tabs: newTabs,
        activeTabId: newActiveTabId,
      };
    });
  },

  setActiveTab: (tabId: string) => {
    set({ activeTabId: tabId });
  },

  updateTab: (tabId: string, updates: Partial<BrowserTab>) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, ...updates } : tab
      ),
    }));
  },

  navigateTab: (tabId: string, url: string) => {
    set((state) => ({
      shellLoading: true,
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, url, title: "Loading..." } : tab
      ),
    }));
  },

  goBack: (tabId: string) => {
    // This will be handled by the webview navigation
    get().updateTab(tabId, { canGoBack: true });
  },

  goForward: (tabId: string) => {
    // This will be handled by the webview navigation
    get().updateTab(tabId, { canGoForward: true });
  },

  addToHistory: (url: string, title: string) => {
    set((state) => {
      const newHistory: BrowserHistory = {
        url,
        title,
        timestamp: Date.now(),
      };
      
      // Remove duplicates and keep last 100 entries
      const filtered = state.history.filter((h) => h.url !== url);
      const updated = [newHistory, ...filtered].slice(0, 100);
      
      return { history: updated };
    });
  },
}));

