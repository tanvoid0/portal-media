import { getSafeImageSource } from "@/utils/imageUtils";
import { streamingProviderLogoFallbackUrl } from "@/utils/tmdbStreamLinks";
import type { TmdbProviderRow } from "@/types/metadata";
import { cn } from "@/lib/utils";

const MAX_LOGOS = 6;

/** Small brand marks for “available on” (discover / detail surfaces). */
export function StreamingProviderLogosRow({
  providers,
  className,
}: {
  providers: TmdbProviderRow[];
  className?: string;
}) {
  const flatrate = providers.filter((p) => p.offerKind === "flatrate");
  const list = (flatrate.length > 0 ? flatrate : providers).slice(0, MAX_LOGOS);
  if (list.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 mt-1.5", className)} aria-label="Streaming availability">
      {list.map((p) => {
        const src = p.logoUrl ?? streamingProviderLogoFallbackUrl(p.providerId);
        return (
          <span
            key={`${p.providerId}-${p.offerKind}`}
            title={p.providerName}
            className="inline-flex h-6 w-6 shrink-0 overflow-hidden rounded-md bg-black/30 ring-1 ring-white/15"
          >
            {src ? (
              <img
                src={getSafeImageSource(src)}
                alt=""
                className="h-full w-full object-contain p-0.5"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.opacity = "0";
                }}
              />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
