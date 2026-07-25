import { cn } from "@/lib/utils";

function Pulse({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted/50", className)} />;
}

export function SaveExplorerSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="flex gap-2 flex-wrap">
        <Pulse className="h-9 w-28" />
        <Pulse className="h-9 w-32" />
        <Pulse className="h-9 w-24" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-border/40 bg-card/30 overflow-hidden p-4 space-y-3"
        >
          <div className="flex gap-3">
            <Pulse className="w-12 h-12 rounded-xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Pulse className="h-4 w-2/5 max-w-[12rem]" />
              <Pulse className="h-3 w-1/3 max-w-[8rem]" />
            </div>
          </div>
          <Pulse className="h-16 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}
