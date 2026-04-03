import { useState, useEffect } from "react";
import { Minimize2, X, Settings, House, ArrowLeft } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useBrowserStore } from "@/stores/browserStore";
import { SitePermissions } from "./SitePermissions";
import { cn } from "@/lib/utils";
import { ExternalLinkGlyph } from "@/components/content/ExternalLinkGlyph";

interface BrowserBarProps {
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  onNavigate: (url: string) => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onReload: () => void;
  onHome: () => void;
}

export function BrowserBar({
  url,
  title: _title,
  canGoBack,
  onNavigate,
  onGoBack,
  onHome,
}: BrowserBarProps) {
  const [urlInput, setUrlInput] = useState(url);
  const [showPermissions, setShowPermissions] = useState(false);
  const { minimizeBrowser, closeBrowser } = useBrowserStore();

  // Update URL input when url prop changes
  useEffect(() => {
    setUrlInput(url);
  }, [url]);

  useEffect(() => {
    if (!showPermissions) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setShowPermissions(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [showPermissions]);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let urlToNavigate = urlInput.trim();
    
    // Add https:// if no protocol
    if (!urlToNavigate.match(/^https?:\/\//)) {
      urlToNavigate = `https://${urlToNavigate}`;
    }
    
    onNavigate(urlToNavigate);
  };

  return (
    <div
      className="h-14 bg-card/75 backdrop-blur-md border-b border-border/60 flex items-center gap-2 px-3"
      style={{ zIndex: 99999, position: "relative" }}
    >
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onHome}
          className="h-9 w-9 text-foreground/90"
          title="Back to app"
        >
          <House className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onGoBack}
          disabled={!canGoBack}
          className="h-9 w-9 text-foreground/90"
          title="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </div>
      <form onSubmit={handleUrlSubmit} className="flex-1 flex items-center gap-2 min-w-0">
        {urlInput.trim() ? (
          <span className="shrink-0 opacity-90" title="Site type">
            <ExternalLinkGlyph url={urlInput.trim()} size="sm" />
          </span>
        ) : null}
        <Input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onBlur={handleUrlSubmit}
          placeholder="Enter URL or search"
          className="h-9 bg-muted border-border focus:border-primary min-w-0 flex-1"
        />
      </form>

      <div className="flex items-center gap-1 relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowPermissions(!showPermissions)}
          className={cn("h-9 w-9", showPermissions && "bg-primary/20 text-primary")}
          title="Site Permissions"
        >
          <Settings className="h-4 w-4" />
        </Button>
        
        {showPermissions && (
          <div className="absolute top-full right-0 mt-2 z-50">
            <SitePermissions />
          </div>
        )}
        
        <Button
          variant="ghost"
          size="icon"
          onClick={minimizeBrowser}
          className="h-9 w-9"
          title="Minimize"
        >
          <Minimize2 className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={closeBrowser}
          className="h-9 w-9 hover:bg-destructive/10 hover:text-destructive"
          title="Close"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

