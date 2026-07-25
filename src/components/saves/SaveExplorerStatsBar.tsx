import { formatSaveBytes, formatSaveModifiedRelative } from "@/utils/saveBundleDisplay";
import { cn } from "@/lib/utils";
import { Clock, FolderArchive, Gamepad2, HardDrive } from "lucide-react";

function StatPill({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof HardDrive;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-3 py-2 min-w-0",
        "bg-muted/15 border-border/50 backdrop-blur-sm",
        accent
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="w-4 h-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {label}
        </p>
        <p className="text-sm font-semibold text-foreground tabular-nums truncate">{value}</p>
      </div>
    </div>
  );
}

export function SaveExplorerStatsBar({
  gameCount,
  locationCount,
  totalBytes,
  newestModified,
  className,
}: {
  gameCount: number;
  locationCount: number;
  totalBytes: number;
  newestModified: number;
  className?: string;
}) {
  if (locationCount === 0) return null;

  return (
    <div
      className={cn(
        "grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3",
        className
      )}
    >
      <StatPill icon={Gamepad2} label="Games" value={String(gameCount)} />
      <StatPill icon={FolderArchive} label="Locations" value={String(locationCount)} />
      <StatPill icon={HardDrive} label="On disk" value={formatSaveBytes(totalBytes)} />
      <StatPill
        icon={Clock}
        label="Latest save"
        value={newestModified ? formatSaveModifiedRelative(newestModified) : "—"}
      />
    </div>
  );
}
