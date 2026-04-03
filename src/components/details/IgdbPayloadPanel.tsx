import type { IgdbGamePayload } from "@/types/metadata";
import { linkIconFromUrl } from "@/utils/igdbLinkIcons";
import { displayLabelForExternalUrl, tailwindIconTextClassForExternalUrl } from "@/utils/linkBrandFromUrl";
import { cn } from "@/lib/utils";

export function IgdbPayloadPanel({
  payload,
  websiteLinksMode = "inline",
}: {
  payload: IgdbGamePayload;
  websiteLinksMode?: "inline" | "hidden";
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2.5">
      <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-full sm:w-auto sm:mr-2">
          IGDB
        </p>
        {payload.releaseDate ? (
          <p className="text-[11px] text-muted-foreground">{payload.releaseDate}</p>
        ) : null}
      </div>
      {payload.genres.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {payload.genres.map((g) => (
            <span
              key={g}
              className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/15"
            >
              {g}
            </span>
          ))}
        </div>
      ) : null}
      {(payload.summary || payload.storyline) && (
        <p className="text-xs text-foreground/90 leading-relaxed line-clamp-5">
          {payload.summary || payload.storyline}
        </p>
      )}
      {websiteLinksMode === "inline" && payload.websiteLinks.length > 0 ? (
        <ul className="text-[11px] space-y-1">
          {payload.websiteLinks.slice(0, 10).map((w) => {
            const Icon = linkIconFromUrl(w.url, w.label);
            const tint = tailwindIconTextClassForExternalUrl(w.url);
            return (
              <li key={w.url} className="min-w-0">
                <a
                  href={w.url}
                  target="_blank"
                  rel="noreferrer"
                  title={w.url}
                  className="group flex items-center gap-2 rounded-md px-1 py-0.5 text-foreground hover:bg-primary/10"
                >
                  <Icon className={cn("h-3 w-3 shrink-0 opacity-95", tint)} aria-hidden />
                  <span className="truncate font-medium group-hover:text-primary">
                    {displayLabelForExternalUrl(w.url, w.label)}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
