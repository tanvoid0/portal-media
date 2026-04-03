import type { ComponentType, SVGAttributes } from "react";
import type { ThemeId } from "@/types/theme";
import { THEME_IDS } from "@/types/theme";
import { SiNetflix, SiPlaystation, SiSteam } from "react-icons/si";
import { FaHeart, FaWater, FaXbox } from "react-icons/fa6";
import { cn } from "@/lib/utils";

type SvgIcon = ComponentType<SVGAttributes<SVGElement> & { className?: string }>;

const THEME_ICONS: Record<ThemeId, SvgIcon> = {
  her: FaHeart,
  ocean: FaWater,
  playstation: SiPlaystation,
  xbox: FaXbox,
  steam: SiSteam,
  netflix: SiNetflix,
};

const THEME_LABELS: Record<ThemeId, string> = {
  her: "Her",
  ocean: "Ocean",
  playstation: "PlayStation",
  xbox: "Xbox",
  steam: "Steam",
  netflix: "Netflix",
};

/** Brand-adjacent colors aligned with `src/styles/themes/<id>.css` primaries */
const THEME_STYLE: Record<
  ThemeId,
  {
    shape: string;
    active: string;
    idle: string;
    iconClass: string;
  }
> = {
  her: {
    shape: "rounded-[0.75rem]",
    active:
      "bg-[hsl(0_70%_50%)] text-white border-[hsl(0_70%_45%)] shadow-[0_4px_18px_-4px_hsl(0_70%_50%/0.55)]",
    idle: "border-[hsl(0_70%_55%/0.35)] bg-[hsl(0_70%_55%/0.12)] text-white hover:bg-[hsl(0_70%_55%/0.2)]",
    iconClass: "text-[hsl(0_72%_62%)]",
  },
  ocean: {
    shape: "rounded-[0.75rem] font-medium",
    active:
      "bg-[hsl(188_86%_48%)] text-[hsl(222_47%_8%)] border-[hsl(188_86%_40%)] shadow-[0_4px_24px_-4px_hsl(188_86%_53%/0.55)]",
    idle: "border-[hsl(188_86%_53%/0.35)] bg-[hsl(188_86%_53%/0.1)] text-white hover:bg-[hsl(188_86%_53%/0.18)]",
    iconClass: "text-[hsl(188_86%_58%)]",
  },
  playstation: {
    shape: "rounded-full font-semibold",
    active:
      "bg-[hsl(215_90%_52%)] text-[hsl(230_38%_8%)] border-[hsl(215_90%_46%)] shadow-[0_6px_28px_-4px_hsl(215_90%_58%/0.55)]",
    idle: "border-[hsl(215_90%_58%/0.35)] bg-[hsl(215_90%_58%/0.12)] text-white hover:bg-[hsl(215_90%_58%/0.2)]",
    iconClass: "text-[hsl(215_90%_68%)]",
  },
  xbox: {
    shape: "rounded-[0.25rem] font-semibold",
    active:
      "bg-[hsl(142_100%_32%)] text-white border-[hsl(142_100%_26%)] shadow-[0_2px_12px_-2px_hsl(142_100%_36%/0.5)]",
    idle: "border-[hsl(142_100%_36%/0.35)] bg-[hsl(142_100%_36%/0.12)] text-white hover:bg-[hsl(142_100%_36%/0.2)]",
    iconClass: "text-[hsl(142_70%_58%)]",
  },
  steam: {
    shape: "rounded-sm font-semibold tracking-tight",
    active:
      "bg-[hsl(213_28%_18%)] text-[hsl(202_100%_55%)] border-[hsl(202_100%_52%)] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.06)]",
    idle: "border-[hsl(202_100%_52%/0.3)] bg-[hsl(213_28%_16%/0.85)] text-[hsl(210_15%_88%)] hover:bg-[hsl(213_26%_22%)]",
    iconClass: "text-[hsl(202_100%_52%)]",
  },
  netflix: {
    shape: "rounded-[0.125rem] font-bold tracking-tight",
    active:
      "bg-[hsl(355_92%_48%)] text-white border-[hsl(355_92%_40%)] shadow-[0_4px_20px_-4px_hsl(355_92%_48%/0.5)]",
    idle: "border-[hsl(355_92%_48%/0.35)] bg-[hsl(355_92%_48%/0.12)] text-white hover:bg-[hsl(355_92%_48%/0.22)]",
    iconClass: "text-[hsl(355_85%_58%)]",
  },
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
        const s = THEME_STYLE[id];
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              "inline-flex items-center gap-2 border-2 px-3.5 py-2 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
              s.shape,
              active ? s.active : s.idle
            )}
          >
            <ThemeIcon id={id} className={cn(active ? "opacity-95" : s.iconClass)} />
            <span>{THEME_LABELS[id]}</span>
          </button>
        );
      })}
    </div>
  );
}
