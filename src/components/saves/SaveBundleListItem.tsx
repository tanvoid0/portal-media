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

export function SaveBundleListItem({
  bundle,
  showGameLink = true,
  compact = false,
  variant: _variant = "library",
  style,
}: {
  bundle: SaveBundle;
  showGameLink?: boolean;
  compact?: boolean;
  variant?: "library" | "settings";
  style?: CSSProperties;
}) {
  const kind = saveLocationKind(bundle);

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
        "group overflow-hidden rounded-none border border-border bg-background",
        compact ? "px-2.5 py-2" : "px-3 py-3 sm:px-3.5"
      )}
    >
      <div className="flex gap-3">
        <SaveLocationKindIcon kind={kind} size={compact ? "sm" : "md"} className="pt-0.5" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm font-medium leading-snug text-foreground">{bundle.label}</p>
            <span className="shrink-0 rounded-none bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {formatSaveBytes(bundle.sizeBytes)}
            </span>
          </div>
          {!compact && showGameLink ? (
            <p className="text-xs text-muted-foreground">
              {bundle.gameName} · {bundle.platform}
            </p>
          ) : null}
          <p
            className="line-clamp-2 break-all font-mono text-xs leading-relaxed text-muted-foreground"
            title={bundle.localPath}
          >
            {bundle.localPath}
          </p>
          <p className="text-xs text-muted-foreground">
            Updated {formatSaveModifiedRelative(bundle.modifiedUtc)}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 gap-1.5 rounded-none text-xs"
              onClick={() => void openFolder()}
            >
              <FolderOpen className="h-3.5 w-3.5" aria-hidden />
              Open
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 rounded-none text-xs"
              onClick={() => void copyPath()}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Copy path
            </Button>
            {showGameLink ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 rounded-none text-xs"
                onClick={() => appNavigate(`/game/${encodeURIComponent(bundle.gameId)}`)}
              >
                <Gamepad2 className="h-3.5 w-3.5" aria-hidden />
                Game
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
