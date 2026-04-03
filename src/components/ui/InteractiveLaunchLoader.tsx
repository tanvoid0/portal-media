import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const ORBIT_DEGREES = [0, 55, 110, 165, 220, 275];
const INNER_ORBIT_DEGREES = [30, 90, 150, 210, 270, 330];

export interface InteractiveLaunchLoaderProps {
  title: string;
  subtitle?: string;
  className?: string;
  /** Larger hit area for parallax tilt */
  compact?: boolean;
}

export function InteractiveLaunchLoader({
  title,
  subtitle,
  className,
  compact = false,
}: InteractiveLaunchLoaderProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: py * 10, y: -px * 10 });
  }, []);

  const onPointerLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
  }, []);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-6 text-center select-none",
        className
      )}
    >
      <div
        ref={wrapRef}
        className={cn(
          "group relative flex items-center justify-center touch-none",
          compact ? "h-28 w-28" : "h-36 w-36"
        )}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        style={{
          perspective: "420px",
        }}
      >
        <div
          className="launch-loader-glow-ring absolute rounded-full border border-primary/25"
          aria-hidden
        />
        <div
          className="launch-loader-glow-ring-delay absolute rounded-full border border-accent/20"
          aria-hidden
        />

        <div
          className="launch-loader-orbit absolute inset-0"
          style={{ transformStyle: "preserve-3d" }}
          aria-hidden
        >
          {ORBIT_DEGREES.map((deg, i) => (
            <span
              key={deg}
              className="launch-loader-satellite absolute left-1/2 top-1/2 rounded-full bg-primary shadow-[0_0_14px_hsl(var(--primary)/0.85)]"
              style={{
                width: compact ? 7 : 9,
                height: compact ? 7 : 9,
                marginLeft: compact ? -3.5 : -4.5,
                marginTop: compact ? -3.5 : -4.5,
                transform: `rotate(${deg}deg) translateY(${compact ? "-2.65rem" : "-3.35rem"})`,
                animationDelay: `${i * 0.12}s`,
              }}
            />
          ))}
        </div>

        <div
          className="launch-loader-orbit-reverse absolute inset-[12%]"
          aria-hidden
        >
          {INNER_ORBIT_DEGREES.map((deg, i) => (
            <span
              key={deg}
              className="launch-loader-satellite-inner absolute left-1/2 top-1/2 rounded-full bg-accent/90 shadow-[0_0_10px_hsl(var(--accent)/0.7)]"
              style={{
                width: compact ? 5 : 6,
                height: compact ? 5 : 6,
                marginLeft: compact ? -2.5 : -3,
                marginTop: compact ? -2.5 : -3,
                transform: `rotate(${deg}deg) translateY(${compact ? "-1.35rem" : "-1.65rem"})`,
                animationDelay: `${i * 0.1 + 0.2}s`,
              }}
            />
          ))}
        </div>

        <div
          className="launch-loader-core-wrap relative z-[1]"
          style={{
            transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transition: "transform 0.2s ease-out",
            transformStyle: "preserve-3d",
          }}
        >
          <div
            className={cn(
              "launch-loader-core relative overflow-hidden",
              compact ? "h-14 w-14" : "h-[4.25rem] w-[4.25rem]"
            )}
          >
            <div
              className="absolute inset-0 bg-gradient-to-br from-primary via-primary/70 to-accent/80 opacity-95"
              aria-hidden
            />
            <div className="launch-loader-shimmer absolute inset-0 opacity-40" aria-hidden />
          </div>
        </div>
      </div>

      <div className="space-y-1.5 max-w-[min(90vw,20rem)] px-2">
        <p className="text-lg font-semibold tracking-tight text-foreground">{title}</p>
        {subtitle ? (
          <p className="text-sm text-muted-foreground break-words leading-snug">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
