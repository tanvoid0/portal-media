import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { PortalMarkIcon } from "@/components/icons/PortalMarkIcon";
import { cn } from "@/lib/utils";

const SHARD_COUNT = 11;

export interface PortalBootSplashProps {
  onComplete: () => void;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

export function PortalBootSplash({ onComplete }: PortalBootSplashProps) {
  const reduced = usePrefersReducedMotion();
  const [exiting, setExiting] = useState(false);

  const shards = useMemo(
    () =>
      Array.from({ length: SHARD_COUNT }, (_, i) => {
        const t = (i / SHARD_COUNT) * Math.PI * 2;
        const wobble = 40 + (i % 4) * 28;
        return {
          sx: `${Math.cos(t) * (160 + wobble)}px`,
          sy: `${Math.sin(t * 1.07) * (130 + wobble * 0.85)}px`,
          sr: `${(i % 5) * 31 - 62}deg`,
          delay: `${i * 0.035}s`,
          accent: i % 3 === 0,
        };
      }),
    []
  );

  useEffect(() => {
    if (reduced) {
      const t = window.setTimeout(() => {
        setExiting(true);
        window.setTimeout(onComplete, 380);
      }, 420);
      return () => window.clearTimeout(t);
    }

    const exitAt = 2680;
    const doneAt = 3280;
    const t1 = window.setTimeout(() => setExiting(true), exitAt);
    const t2 = window.setTimeout(onComplete, doneAt);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [reduced, onComplete]);

  return (
    <div
      className={cn(
        "portal-boot-root fixed inset-0 z-[200000] flex flex-col items-center justify-center overflow-hidden bg-background",
        exiting && "portal-boot-root-exit"
      )}
      role="status"
      aria-live="polite"
      aria-label="Opening Portal Media"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_42%,hsl(var(--primary)/0.14),transparent_62%)]"
        aria-hidden
      />

      <div className="relative flex h-[min(52vw,320px)] w-[min(52vw,320px)] items-center justify-center">
        {!reduced ? (
          <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
            {shards.map((s, i) => (
              <span
                key={i}
                className={cn(
                  "portal-boot-shard absolute rounded-[3px]",
                  s.accent ? "bg-accent/50" : "bg-primary/45"
                )}
                style={
                  {
                    width: i % 2 === 0 ? 10 : 7,
                    height: i % 3 === 0 ? 12 : 8,
                    "--sx": s.sx,
                    "--sy": s.sy,
                    "--sr": s.sr,
                    animationDelay: s.delay,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        ) : null}

        <div
          className={cn(
            "relative z-[1] w-[min(42vw,220px)] drop-shadow-[0_0_48px_hsl(var(--primary)/0.35)]",
            reduced ? "portal-boot-emblem-static" : "portal-boot-emblem"
          )}
        >
          <PortalMarkIcon className="h-full w-full" themed />
        </div>
      </div>

      <div
        className={cn(
          "mt-10 text-center transition-opacity duration-700",
          exiting ? "opacity-0" : "opacity-100"
        )}
      >
        <p className="text-[0.65rem] font-medium uppercase tracking-[0.55em] text-muted-foreground/90">
          Portal
        </p>
        <p className="mt-1 text-xs font-light tracking-[0.35em] text-muted-foreground/55">Media</p>
      </div>
    </div>
  );
}
