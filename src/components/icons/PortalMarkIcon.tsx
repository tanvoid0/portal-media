import { useId } from "react";
import { cn } from "@/lib/utils";

export interface PortalMarkIconProps {
  className?: string;
  /** Pixel size; default scales with parent when omitted */
  size?: number;
  /** Use theme primary/accent via CSS variables instead of fixed brand gradient */
  themed?: boolean;
}

/**
 * App mark: portal ring + luminous core. Matches `public/portal-icon.svg` when themed=false.
 */
export function PortalMarkIcon({ className, size, themed = true }: PortalMarkIconProps) {
  const gid = useId().replace(/:/g, "");
  const ringGrad = `pm-ring-${gid}`;
  const coreGrad = `pm-core-${gid}`;

  return (
    <svg
      className={cn(themed && "text-primary", className)}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      width={size}
      height={size}
    >
      {themed ? (
        <defs>
          <linearGradient id={ringGrad} x1="72" y1="56" x2="440" y2="456" gradientUnits="userSpaceOnUse">
            <stop stopColor="hsl(var(--primary))" />
            <stop offset="0.55" stopColor="hsl(var(--primary) / 0.85)" />
            <stop offset="1" stopColor="hsl(var(--accent))" />
          </linearGradient>
          <radialGradient id={coreGrad} cx="38%" cy="32%" r="68%">
            <stop stopColor="hsl(var(--primary-foreground) / 0.95)" />
            <stop offset="0.5" stopColor="hsl(var(--primary) / 0.9)" />
            <stop offset="1" stopColor="hsl(var(--primary) / 0.55)" />
          </radialGradient>
        </defs>
      ) : (
        <defs>
          <linearGradient id={ringGrad} x1="72" y1="56" x2="440" y2="456" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8b5cf6" />
            <stop offset="0.55" stopColor="#6366f1" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
          <radialGradient id={coreGrad} cx="38%" cy="32%" r="68%">
            <stop stopColor="#e9d5ff" />
            <stop offset="0.45" stopColor="#a78bfa" />
            <stop offset="1" stopColor="#5b21b6" />
          </radialGradient>
        </defs>
      )}
      <circle
        cx="256"
        cy="256"
        r="198"
        fill={themed ? "hsl(var(--background))" : "#07080d"}
        stroke={`url(#${ringGrad})`}
        strokeWidth="44"
      />
      <circle
        cx="256"
        cy="256"
        r="118"
        stroke={`url(#${ringGrad})`}
        strokeOpacity={0.22}
        strokeWidth="14"
      />
      <circle cx="256" cy="256" r="68" fill={`url(#${coreGrad})`} />
    </svg>
  );
}
