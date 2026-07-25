import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import {
  formatSaveBytes,
  formatSaveModifiedRelative,
  saveLocationKind,
} from "@/utils/saveBundleDisplay";
import { openSaveBundleLocation } from "@/utils/openSaveBundle";
import { SaveLocationKindIcon } from "@/components/saves/SaveLocationKindIcon";
import type { SaveBundle } from "@/types/saveSync";
import { appNavigate } from "@/nav/appNavigate";
import { Copy, FolderOpen, Gamepad2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const KIND_ACCENT: Record<string, string> = {
  steam: "border-l-[#66c0f4]",
  documents: "border-l-amber-400",
  install: "border-l-emerald-400",
  other: "border-l-primary",
};

export function SaveBundleListItem({
  bundle,
  showGameLink = true,
  compact = false,
  variant = "library",
  style,
}: {
  bundle: SaveBundle;
  showGameLink?: boolean;
  compact?: boolean;
  variant?: "library" | "settings";
  style?: CSSProperties;
}) {
  const kind = saveLocationKind(bundle);
  const isSettings = variant === "settings";

  const openFolder = async () => {
    try {
      await openSaveBundleLocation(bundle);
    } catch {
      toast.error("Could not open save location");
    }
  };

  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(bundle.localPath);
      toast.success("Path copied");
    } catch {
      toast.error("Could not copy path");
    }
  };

  return (
    <li
      style={style}
      className={cn(
        "group rounded-xl border border-l-[3px] overflow-hidden transition-all duration-panel spring-ease",
        KIND_ACCENT[kind],
        compact ? "px-2.5 py-2" : "px-3 py-3 sm:px-3.5",
        isSettings
          ? "border-white/10 bg-black/25 hover:bg-white/[0.06] hover:border-white/20"
          : "border-border/40 bg-muted/10 hover:bg-muted/25 hover:border-border/60"
      )}
    >
      <div className="flex gap-3">
        <SaveLocationKindIcon kind={kind} size={compact ? "sm" : "md"} className="pt-0.5" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p
              className={cn(
                "text-sm font-medium leading-snug",
                isSettings ? "text-white" : "text-foreground"
              )}
            >
              {bundle.label}
            </p>
            <span
              className={cn(
                "text-[10px] font-medium tabular-nums shrink-0 rounded-md px-1.5 py-0.5",
                isSettings ? "bg-white/10 text-white/60" : "bg-muted text-muted-foreground"
              )}
            >
              {formatSaveBytes(bundle.sizeBytes)}
            </span>
          </div>
          {!compact && showGameLink ? (
            <p className={cn("text-xs", isSettings ? "text-white/50" : "text-muted-foreground")}>
              {bundle.gameName} · {bundle.platform}
            </p>
          ) : null}
          <p
            className={cn(
              "text-[11px] font-mono leading-relaxed break-all line-clamp-2",
              isSettings ? "text-white/45" : "text-muted-foreground"
            )}
            title={bundle.localPath}
          >
            {bundle.localPath}
          </p>
          <p className={cn("text-[10px]", isSettings ? "text-white/40" : "text-muted-foreground")}>
            Updated {formatSaveModifiedRelative(bundle.modifiedUtc)}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-0.5 opacity-90 group-hover:opacity-100">
            <Button
              type="button"
              size="sm"
              variant={isSettings ? "secondary" : "secondary"}
              className={cn(
                "h-8 rounded-lg text-xs gap-1.5",
                isSettings && "bg-white/15 text-white hover:bg-white/25 border-0"
              )}
              onClick={() => void openFolder()}
            >
              <FolderOpen className="w-3.5 h-3.5" aria-hidden />
              Open
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(
                "h-8 rounded-lg text-xs gap-1.5",
                isSettings && "border-white/15 text-white/80 hover:bg-white/10 hover:text-white"
              )}
              onClick={() => void copyPath()}
            >
              <Copy className="w-3.5 h-3.5" aria-hidden />
              Copy path
            </Button>
            {showGameLink ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(
                  "h-8 rounded-lg text-xs gap-1.5",
                  isSettings && "text-white/70 hover:text-white hover:bg-white/10"
                )}
                onClick={() => appNavigate(`/game/${encodeURIComponent(bundle.gameId)}`)}
              >
                <Gamepad2 className="w-3.5 h-3.5" aria-hidden />
                Game
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
