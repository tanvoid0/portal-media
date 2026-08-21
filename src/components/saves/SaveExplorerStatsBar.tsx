import { formatSaveBytes, formatSaveModifiedRelative } from "@/utils/saveBundleDisplay";
import { cn } from "@/lib/utils";
import { Clock, FolderArchive, Gamepad2, HardDrive } from "lucide-react";

function StatCell({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof HardDrive;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-none border border-border px-3 py-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none border border-border text-foreground">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold tabular-nums text-foreground">{value}</p>
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
    <div className={cn("grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4", className)}>
      <StatCell icon={Gamepad2} label="Games" value={String(gameCount)} />
      <StatCell icon={FolderArchive} label="Locations" value={String(locationCount)} />
      <StatCell icon={HardDrive} label="On disk" value={formatSaveBytes(totalBytes)} />
      <StatCell
        icon={Clock}
        label="Latest save"
        value={newestModified ? formatSaveModifiedRelative(newestModified) : "—"}
      />
    </div>
  );
}
