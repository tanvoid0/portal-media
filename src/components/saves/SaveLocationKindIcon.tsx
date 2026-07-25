import { Cloud, FolderOpen, Gamepad2, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SaveLocationKind } from "@/utils/saveBundleDisplay";
import { saveLocationKindLabel } from "@/utils/saveBundleDisplay";

const KIND_STYLES: Record<
  SaveLocationKind,
  { Icon: typeof HardDrive; ring: string; bg: string; text: string }
> = {
  steam: {
    Icon: Cloud,
    ring: "ring-[#66c0f4]/35",
    bg: "bg-[#1b2838]/80",
    text: "text-[#66c0f4]",
  },
  documents: {
    Icon: FolderOpen,
    ring: "ring-amber-400/35",
    bg: "bg-amber-500/15",
    text: "text-amber-300",
  },
  install: {
    Icon: HardDrive,
    ring: "ring-emerald-400/35",
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
  },
  other: {
    Icon: Gamepad2,
    ring: "ring-primary/30",
    bg: "bg-primary/15",
    text: "text-primary",
  },
};

export function SaveLocationKindIcon({
  kind,
  size = "md",
  showLabel = false,
  className,
}: {
  kind: SaveLocationKind;
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}) {
  const s = KIND_STYLES[kind];
  const Icon = s.Icon;
  const box = size === "sm" ? "w-8 h-8 rounded-lg" : "w-10 h-10 rounded-xl";
  const icon = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <span className={cn("inline-flex items-center gap-2 shrink-0", className)}>
      <span
        className={cn(
          box,
          "inline-flex items-center justify-center ring-1",
          s.bg,
          s.ring
        )}
        title={saveLocationKindLabel(kind)}
      >
        <Icon className={cn(icon, s.text)} aria-hidden />
      </span>
      {showLabel ? (
        <span className={cn("text-[10px] font-semibold uppercase tracking-wide", s.text)}>
          {saveLocationKindLabel(kind)}
        </span>
      ) : null}
    </span>
  );
}
