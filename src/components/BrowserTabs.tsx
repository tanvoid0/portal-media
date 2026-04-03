import { useBrowserStore } from "@/stores/browserStore";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BrowserTabsProps {
  orientation?: "horizontal" | "vertical";
}

export function BrowserTabs({ orientation = "horizontal" }: BrowserTabsProps) {
  const { tabs, activeTabId, setActiveTab, closeTab } = useBrowserStore();
  const isVertical = orientation === "vertical";

  if (tabs.length === 0) return null;

  return (
    <div
      className={cn(
        "bg-muted/30 border-border",
        isVertical
          ? "h-full w-64 border-r px-2 py-3 flex flex-col gap-2 overflow-y-auto"
          : "h-10 border-b flex items-center gap-1 px-2 overflow-x-auto"
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={cn(
              "group flex items-center gap-2 cursor-pointer transition-colors",
              isVertical
                ? "w-full rounded-xl px-3 py-3"
                : "min-w-[120px] max-w-[200px] rounded-t-md px-3 py-1.5",
              isActive
                ? isVertical
                  ? "bg-card border border-border shadow-sm"
                  : "bg-card border-t border-l border-r border-border"
                : "hover:bg-muted/50"
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.favicon && (
              <img
                src={tab.favicon}
                alt=""
                className="w-4 h-4 flex-shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <span
              className={cn(
                "truncate flex-1",
                isVertical ? "text-sm" : "text-xs",
                isActive ? "text-foreground font-medium" : "text-muted-foreground"
              )}
            >
              {tab.title || "New Tab"}
            </span>
            <button
              className={cn(
                "h-5 w-5 rounded flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-opacity",
                isVertical ? "opacity-60 hover:opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

