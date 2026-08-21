import type { ComponentType, SVGAttributes } from "react";
import type { ThemeId } from "@/types/theme";
import { THEME_IDS } from "@/types/theme";
import { FrameKey } from "@/components/ui/frame-key";
import { Cloud, Factory, Film, Heart, LayoutGrid, Waves } from "lucide-react";
import { cn } from "@/lib/utils";

type SvgIcon = ComponentType<SVGAttributes<SVGElement> & { className?: string }>;

const THEME_ICONS: Record<ThemeId, SvgIcon> = {
  her: Heart,
  ocean: Waves,
  nimbus: Cloud,
  vertex: LayoutGrid,
  forge: Factory,
  velvet: Film,
};

const THEME_LABELS: Record<ThemeId, string> = {
  her: "Her",
  ocean: "Ocean",
  nimbus: "Nimbus",
  vertex: "Vertex",
  forge: "Forge",
  velvet: "Velvet",
};

/** Short tooltips: mood of each palette without naming third-party brands */
const THEME_HINTS: Record<ThemeId, string> = {
  her: "Warm accent, romantic rounded chrome",
  ocean: "Cool teal, calm rounded panels",
  nimbus: "Deep blue, pill buttons, soft outer glow",
  vertex: "Green accent, flat squared tiles",
  forge: "Dark gunmetal with bright cyan highlights",
  velvet: "Scarlet on near-black, poster-row mood",
};

/** Swatch is palette identity, not chrome. Hues match DESIGN.md theme remaps. */
const THEME_SWATCH: Record<ThemeId, string> = {
  her: "hsl(0 70% 55%)",
  ocean: "hsl(188 86% 53%)",
  nimbus: "hsl(215 90% 58%)",
  vertex: "hsl(142 100% 36%)",
  forge: "hsl(202 100% 52%)",
  velvet: "hsl(355 92% 48%)",
};

function ThemeIcon({ id, className }: { id: ThemeId; className?: string }) {
  const Icon = THEME_ICONS[id];
  return <Icon className={cn("size-[18px] shrink-0", className)} aria-hidden />;
}

type Props = {
  value: ThemeId;
  onChange: (id: ThemeId) => void;
};

export function ThemeAppearancePicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {THEME_IDS.map((id) => {
        const active = value === id;
        return (
          <FrameKey
            key={id}
            title={THEME_HINTS[id]}
            active={active}
            onClick={() => onChange(id)}
            aria-pressed={active}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-none border border-border"
              style={{ background: THEME_SWATCH[id] }}
              aria-hidden
            />
            <ThemeIcon id={id} />
            <span>{THEME_LABELS[id]}</span>
          </FrameKey>
        );
      })}
    </div>
  );
}
