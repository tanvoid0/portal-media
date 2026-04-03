import { useBrowserStore } from "@/stores/browserStore";

export function BrowserMinimized() {
  const { isMinimized, restoreBrowser, activeTabId, tabs, closeBrowser } = useBrowserStore();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  if (!isMinimized || !activeTab) return null;

  return (
    <div
      className="fixed bottom-4 right-4 w-64 h-40 bg-card border border-border rounded-lg shadow-lg cursor-pointer hover:shadow-xl transition-shadow z-[100]"
      onClick={restoreBrowser}
    >
      <div className="p-2 flex items-center justify-between border-b border-border">
        <span className="text-xs font-medium text-foreground truncate flex-1">
          {activeTab.title}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            closeBrowser();
          }}
          className="ml-2 text-muted-foreground hover:text-foreground text-xs"
        >
          ×
        </button>
      </div>
      <div className="p-2 text-xs text-muted-foreground truncate">
        {activeTab.url}
      </div>
    </div>
  );
}

