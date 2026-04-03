import { useEffect, useState, useRef } from "react";
import { useBrowserStore } from "@/stores/browserStore";
import { BrowserBar } from "./BrowserBar";
import { BrowserTabs } from "./BrowserTabs";
import { VideoControls } from "./VideoControls";
import { invoke } from "@tauri-apps/api/core";
import { getSitePermissions } from "@/utils/cookieManager";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { InteractiveLaunchLoader } from "./ui/InteractiveLaunchLoader";

/** Keeps the shell visible while the OS webview swaps from the app to the stream URL. */
const MIN_STREAM_OVERLAY_MS = 900;

function scheduleShellLoadingEnd(startedAt: number) {
  const wait = Math.max(0, MIN_STREAM_OVERLAY_MS - (Date.now() - startedAt));
  window.setTimeout(() => {
    useBrowserStore.setState({ shellLoading: false });
  }, wait);
}

function loadingSubtitleForUrl(url: string): string {
  if (!url?.trim()) return "";
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return new URL(url).hostname.replace(/^www\./, "");
    }
  } catch {
    /* ignore */
  }
  return url.length > 56 ? `${url.slice(0, 53)}…` : url;
}

interface BrowserSidebarProps {
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onReload: () => void;
}

function BrowserSidebar({
  canGoBack,
  canGoForward,
  isLoading,
  onGoBack,
  onGoForward,
  onReload,
}: BrowserSidebarProps) {
  return (
    <div className="pointer-events-auto w-64 bg-background/95 backdrop-blur-sm shadow-lg border-r border-border flex flex-col">
      <div className="border-b border-border px-3 py-3">
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onGoBack}
            disabled={!canGoBack}
            className="h-10 w-full rounded-xl"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onGoForward}
            disabled={!canGoForward}
            className="h-10 w-full rounded-xl"
            title="Forward"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onReload}
            disabled={isLoading}
            className="h-10 w-full rounded-xl"
            title="Reload"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <BrowserTabs orientation="vertical" />
    </div>
  );
}

export function BrowserView() {
  const {
    isOpen,
    isMinimized,
    shellLoading,
    tabs,
    activeTabId,
    goBack: goBackStore,
    goForward: goForwardStore,
    updateTab,
  } = useBrowserStore();

  const [isLoading, setIsLoading] = useState(false);
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const lastNavigatedUrl = useRef<string | null>(null);
  const isNavigating = useRef(false);
  const prevIsOpen = useRef(isOpen);

  // Suppress tracking prevention warnings (expected browser security feature)
  useEffect(() => {
    const originalWarn = console.warn;
    const originalError = console.error;
    
    console.warn = (...args: unknown[]) => {
      const message = args.map(String).join(" ");
      // Suppress tracking prevention warnings
      if (message.includes('Tracking Prevention blocked access to storage')) {
        return;
      }
      originalWarn.apply(console, args);
    };
    
    console.error = (...args: unknown[]) => {
      const message = args.map(String).join(" ");
      // Suppress tracking prevention errors
      if (message.includes('Tracking Prevention blocked access to storage')) {
        return;
      }
      originalError.apply(console, args);
    };
    
    return () => {
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  // No longer needed - we use the main window's webview directly
  // The React UI is an overlay on top

  // Navigate main window webview when tab changes
  useEffect(() => {
    if (!activeTab || !isOpen || isMinimized) return;
    
    // Prevent duplicate navigations
    if (lastNavigatedUrl.current === activeTab.url || isNavigating.current) {
      return;
    }

    const currentTab = activeTab; // Capture for use in async functions
    let cancelled = false;
    isNavigating.current = true;
    lastNavigatedUrl.current = currentTab.url;
    
    const navigate = async () => {
      const startedAt = Date.now();
      setIsLoading(true);
      try {
        // Get site permissions for this domain
        let permissions = { allowCookies: false, allowAds: false, allowPopups: false };
        try {
          // Validate URL before creating URL object
          if (currentTab.url && (currentTab.url.startsWith('http://') || currentTab.url.startsWith('https://'))) {
            const domain = new URL(currentTab.url).hostname;
            permissions = getSitePermissions(domain);
          }
        } catch {
          // Invalid URL, use defaults
        }

        // Navigate embedded browser window to URL
        await invoke("navigate_main_window", { url: currentTab.url });
        
        if (cancelled) {
          isNavigating.current = false;
          useBrowserStore.setState({ shellLoading: false });
          return;
        }

        // Wait for page to load, then inject scripts
        // Inject multiple times to ensure titlebar appears
        const injectScripts = async (delay: number) => {
          setTimeout(async () => {
            if (cancelled) {
              isNavigating.current = false;
              return;
            }
            
            try {
              // Inject scripts with permissions into the main window's webview
              await invoke("inject_scripts_with_permissions", {
                tabId: "embedded_browser",
                allowCookies: permissions.allowCookies,
                allowAds: permissions.allowAds,
                allowPopups: permissions.allowPopups,
              });
            } catch (e) {
              console.error("Failed to inject scripts:", e);
            } finally {
              if (delay >= 2000) {
                isNavigating.current = false;
              }
            }
          }, delay);
        };
        
        // Inject at multiple intervals to ensure titlebar appears
        injectScripts(500);
        injectScripts(1000);
        injectScripts(2000);
        injectScripts(3000);
        
        // Update tab info
        try {
          // Validate URL before creating URL object
          if (currentTab.url && (currentTab.url.startsWith('http://') || currentTab.url.startsWith('https://'))) {
            const url = new URL(currentTab.url);
            updateTab(currentTab.id, {
              title: url.hostname.replace("www.", ""),
              canGoBack: true,
              canGoForward: false,
            });
          } else {
            updateTab(currentTab.id, {
              title: currentTab.url || "New Tab",
              canGoBack: true,
              canGoForward: false,
            });
          }
        } catch {
          updateTab(currentTab.id, {
            title: currentTab.url || "New Tab",
            canGoBack: true,
            canGoForward: false,
          });
        }

        setIsLoading(false);
        if (!cancelled) {
          scheduleShellLoadingEnd(startedAt);
        }
      } catch (error) {
        if (cancelled) {
          isNavigating.current = false;
          return;
        }
        console.error("Failed to navigate:", error);
        setIsLoading(false);
        useBrowserStore.setState({ shellLoading: false });
        updateTab(currentTab.id, { title: "Error loading page" });
        isNavigating.current = false;
        lastNavigatedUrl.current = null; // Allow retry
      }
    };

    navigate();
    
    return () => {
      cancelled = true;
      isNavigating.current = false;
    };
  }, [activeTab, isOpen, isMinimized, updateTab]);

  const showStreamOverlay = shellLoading || isLoading;

  const handleNavigate = async (url: string) => {
    if (!activeTab) return;
    const startedAt = Date.now();
    useBrowserStore.setState({ shellLoading: true });
    setIsLoading(true);
    try {
      await invoke("navigate_main_window", { url });
      lastNavigatedUrl.current = url;
      const currentTab = tabs.find((tab) => tab.id === activeTabId);
      if (currentTab) {
        updateTab(currentTab.id, { url, title: "Loading..." });
      }
      setIsLoading(false);
      scheduleShellLoadingEnd(startedAt);
    } catch (error) {
      console.error("Failed to navigate:", error);
      setIsLoading(false);
      useBrowserStore.setState({ shellLoading: false });
    }
  };

  const handleGoBack = async () => {
    if (!activeTab) return;
    try {
      // Use embedded browser window
      await invoke("go_back", { tabId: "embedded_browser" });
      goBackStore(activeTab.id);
    } catch (e) {
      console.error("Failed to go back:", e);
    }
  };

  const handleGoForward = async () => {
    if (!activeTab) return;
    try {
      // Use embedded browser window
      await invoke("go_forward", { tabId: "embedded_browser" });
      goForwardStore(activeTab.id);
    } catch (e) {
      console.error("Failed to go forward:", e);
    }
  };

  const handleReload = async () => {
    if (!activeTab) return;
    const startedAt = Date.now();
    useBrowserStore.setState({ shellLoading: true });
    setIsLoading(true);
    try {
      await invoke("reload_browser", { tabId: "embedded_browser" });
      setIsLoading(false);
      scheduleShellLoadingEnd(startedAt);
    } catch (error) {
      console.error("Failed to reload:", error);
      setIsLoading(false);
      useBrowserStore.setState({ shellLoading: false });
    }
  };

  // Restore app shell only when the browser transitions from open → closed (not on initial mount).
  useEffect(() => {
    const wasOpen = prevIsOpen.current;
    prevIsOpen.current = isOpen;
    if (!wasOpen || isOpen) return;
    invoke("navigate_main_window", { url: "index.html" }).catch(console.error);
  }, [isOpen]);

  if (!isOpen) return null;

  if (isMinimized) {
    return null; // BrowserMinimized is rendered separately in App
  }

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col pointer-events-none" style={{ zIndex: 99999 }}>
      {/* Top bar - opaque background, always on top */}
      <div className="bg-background pointer-events-auto shadow-lg" style={{ zIndex: 99999 }}>
        <BrowserBar
          url={activeTab?.url || ""}
          title={activeTab?.title || ""}
          canGoBack={activeTab?.canGoBack || false}
          canGoForward={activeTab?.canGoForward || false}
          isLoading={isLoading}
          onNavigate={handleNavigate}
          onGoBack={handleGoBack}
          onGoForward={handleGoForward}
          onReload={handleReload}
        />
      </div>
      
      <div className="relative flex min-h-0 flex-1">
        {showStreamOverlay ? (
          <div
            className="absolute inset-0 z-[100] flex items-center justify-center bg-background/92 backdrop-blur-md"
            style={{ pointerEvents: "auto" }}
            aria-live="polite"
            aria-busy="true"
          >
            <InteractiveLaunchLoader
              title="Loading stream"
              subtitle={loadingSubtitleForUrl(activeTab?.url ?? "")}
            />
          </div>
        ) : null}

        <BrowserSidebar
          canGoBack={activeTab?.canGoBack || false}
          canGoForward={activeTab?.canGoForward || false}
          isLoading={isLoading}
          onGoBack={handleGoBack}
          onGoForward={handleGoForward}
          onReload={handleReload}
        />

        {/* Browser content area - the main window's webview shows through here */}
        {/* We make this transparent and use pointer-events to allow interaction */}
        <div
          className="relative flex-1 bg-transparent"
          id="browser-content-area"
          style={{ pointerEvents: "none" }}
        />
      </div>
      
      {/* Bottom controls - transparent background, pointer events enabled for controls */}
      <div className="bg-transparent pointer-events-none">
        <div className="pointer-events-auto">
          <VideoControls />
        </div>
      </div>
    </div>
  );
}

