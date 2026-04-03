import { useCallback, useEffect, useRef, useState } from "react";
import { House, ArrowLeft, X, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useShellChrome } from "@/context/ShellChromeContext";

const LEAVE_HIDE_MS = 420;

interface BrowserEdgeEscapeStripProps {
  canGoBack: boolean;
  onHome: () => void;
  onGoBack: () => void;
  /** Same as title-bar close: exit in-app browser (all tabs). */
  onCloseBrowser: () => void;
}

/**
 * Fullscreen / borderless windows have no OS title bar — a thin top-edge hover zone
 * always accepts the pointer and expands into compact app / history / window controls.
 */
export function BrowserEdgeEscapeStrip({
  canGoBack,
  onHome,
  onGoBack,
  onCloseBrowser,
}: BrowserEdgeEscapeStripProps) {
  const { isFullscreen, onToggleFullscreen } = useShellChrome();
  const [open, setOpen] = useState(false);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelLeave = useCallback(() => {
    if (leaveTimerRef.current != null) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const onEnter = useCallback(() => {
    cancelLeave();
    setOpen(true);
  }, [cancelLeave]);

  const onLeave = useCallback(() => {
    cancelLeave();
    leaveTimerRef.current = setTimeout(() => setOpen(false), LEAVE_HIDE_MS);
  }, [cancelLeave]);

  useEffect(() => () => cancelLeave(), [cancelLeave]);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100000] flex justify-center pointer-events-none"
      data-browser-edge-controls
    >
      <div
        className="pointer-events-auto flex w-full max-w-full flex-col items-center"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <div
          className="h-3 w-full min-h-[12px] shrink-0 cursor-default"
          title="Hover top edge for app controls (no title bar in fullscreen)"
        />
        <div
          className={cn(
            "flex justify-center px-2 transition-[opacity,transform,margin] duration-200 ease-out",
            open ? "mt-1 opacity-100" : "pointer-events-none mt-0 h-0 opacity-0 overflow-hidden"
          )}
          role="toolbar"
          aria-label="Browser overlay controls"
        >
          <div className="flex items-center gap-0.5 rounded-full border border-border/45 bg-card/78 px-1 py-0.5 shadow-lg backdrop-blur-md">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-foreground/90"
              title="Back to app"
              onClick={onHome}
            >
              <House className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-foreground/90"
              title="Back"
              disabled={!canGoBack}
              onClick={onGoBack}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            {isFullscreen ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-foreground/90"
                title="Exit fullscreen"
                onClick={() => void onToggleFullscreen()}
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-foreground/90 hover:text-destructive"
              title="Close browser"
              onClick={onCloseBrowser}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
