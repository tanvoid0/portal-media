import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLinkGlyph } from "@/components/content/ExternalLinkGlyph";
import { toast } from "sonner";
import {
  BookOpen,
  ExternalLink,
  Gamepad2,
  KeyRound,
  LayoutGrid,
  Library,
  Monitor,
  Package,
  Palette,
  Search,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LIBRARY_SECTIONS } from "@/nav/libraryRoutes";

/** Filenames match `e2e/screenshots.spec.ts` → `public/screenshots/*.png`. */
const DEMO_SCREENSHOTS = [
  { file: "library-all.png", caption: "Library — All" },
  { file: "library-discover.png", caption: "Library — Discover (TMDB / IGDB grids)" },
  { file: "library-media.png", caption: "Library — Media" },
  { file: "settings-library.png", caption: "Settings — Library & sync" },
  { file: "settings-api.png", caption: "Settings — Metadata API" },
  { file: "settings-appearance.png", caption: "Settings — Appearance" },
  { file: "settings-streaming.png", caption: "Settings — Streaming add-ons" },
  { file: "settings-controller.png", caption: "Settings — Controller & keyboard" },
  { file: "docs.png", caption: "Documentation (this page)" },
] as const;

const TWITCH_APPS = "https://dev.twitch.tv/console/apps";
const IGDB_DOCS = "https://api-docs.igdb.com/#account-creation";
const TMDB_API_SETTINGS = "https://www.themoviedb.org/settings/api";
const TMDB_DOCS = "https://developer.themoviedb.org/docs/getting-started";

function openExternal(url: string) {
  void openUrl(url).catch(() => toast.error("Could not open link"));
}

function JumpLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Button
      asChild
      variant="secondary"
      size="sm"
      className="rounded-xl h-9 text-xs font-medium border-border/60 bg-muted/40 hover:bg-muted/60"
    >
      <NavLink to={to}>{children}</NavLink>
    </Button>
  );
}

function GuideList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-4 space-y-1.5 text-sm text-muted-foreground">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

export function DocsPage() {
  const sectionList = LIBRARY_SECTIONS.join(", ");

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="space-y-2 pb-3">
          <div className="flex items-start gap-3">
            <BookOpen className="w-6 h-6 text-primary shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0 space-y-2">
              <CardTitle className="text-2xl font-semibold tracking-tight">Portal Media</CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                A desktop shell for your games, apps, and media bookmarks: local library scanning, optional
                online metadata, an embedded browser for streaming sites, and settings you control. Nothing
                here phones home with your API keys—credentials stay on your machine.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <JumpLink to="/settings/game">Library & sync</JumpLink>
            <JumpLink to="/settings/streaming">Streaming</JumpLink>
            <JumpLink to="/settings/appearance">Appearance</JumpLink>
            <JumpLink to="/settings/api">Metadata API</JumpLink>
            <JumpLink to="/settings/controller">Controller</JumpLink>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Interface gallery</CardTitle>
          <CardDescription className="text-sm">
            Demo stills (1920×1080, dark theme) produced by{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">pnpm screenshots</code> — see README for
            setup. Your content and API state will differ.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          {DEMO_SCREENSHOTS.map(({ file, caption }) => (
            <figure key={file} className="space-y-2 min-w-0">
              <img
                src={`/screenshots/${file}`}
                alt={caption}
                className="w-full rounded-xl border border-border/60 shadow-sm bg-muted/20"
                loading="lazy"
              />
              <figcaption className="text-xs text-muted-foreground">{caption}</figcaption>
            </figure>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-sky-500" aria-hidden />
            Library & main shell
          </CardTitle>
          <CardDescription className="text-sm">
            The default experience after launch: category rail, filters, grid, and search.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <GuideList
            items={[
              `Routes use /library/{section} with sections: ${sectionList}. The URL is the source of truth for which shelf you are viewing.`,
              "The left category rail switches between All, Games, Apps, Media, Discover, and Favorites; selection stays in sync with the address bar.",
              "Favorites, sort order, and the compact search field live in the top chrome. Search focuses the library filter.",
              "Each tile can open a detail page for installed titles. Row actions (play, hide, folder, etc.) apply only when the item is installed.",
              "Discover shows TMDB-powered grids when a key is configured; game discovery on the same shelf uses IGDB when Twitch credentials are set.",
              "Back / forward in the top bar navigate in-app history (library, details, settings, this page)—separate from the embedded browser.",
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Library className="w-4 h-4 text-violet-500" aria-hidden />
            Detail pages
          </CardTitle>
          <CardDescription className="text-sm">Three flavors of “details” in one shell.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <GuideList
            items={[
              "/game/{id} — your installed library entry: launch, install path, hide, and metadata panels when enriched.",
              "/tmdb/{mediaType}/{id} — browse movies or TV from Discover (or add-on actions). Watch providers and links reflect TMDB data.",
              "/igdb/{id} — browse a game from IGDB-backed discover without installing it. No launch row until it exists in your library.",
              "From browse-only pages, use the settings prompts to add API keys if something looks empty.",
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Monitor className="w-4 h-4 text-amber-500" aria-hidden />
            Embedded browser
          </CardTitle>
          <CardDescription className="text-sm">Fullscreen-friendly viewing without losing the app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <GuideList
            items={[
              "Opening a bookmark or stream opens an in-window browser layer. You can minimize it to a chip and return to the library.",
              "Borderless / fullscreen layouts hide the OS title bar; move the pointer to the top edge to reveal a thin escape strip (home, back, close, window size).",
              "Site permissions and media controls use the same session as long as the browser stays open.",
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-500" aria-hidden />
            Quick access & overlays
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <GuideList
            items={[
              "Quick access (Win / Meta tap when enabled) jumps to Library, this documentation, Settings, the app switcher, or a minimized browser.",
              "The app switcher lists recent in-app surfaces so you can bounce between library, details, and browser sessions.",
              "Controller hint text at the bottom is hidden on Settings, Documentation, and whenever remote-style navigation is disabled.",
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-purple-500" aria-hidden />
            Metadata APIs
          </CardTitle>
          <CardDescription className="text-sm">Optional enrichment for artwork, copy, and discover grids.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">TMDB (movies & TV)</p>
            <GuideList
              items={[
                "Create a read-only API key in your TMDB account and paste it into Metadata API settings.",
                "Powers Discover shelves, detail pages, and streaming provider rows where TMDB exposes data.",
              ]}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => openExternal(TMDB_API_SETTINGS)}>
                <ExternalLinkGlyph
                  url={TMDB_API_SETTINGS}
                  labelHint="TMDB"
                  size="sm"
                  className="mr-1"
                  neutralIconClassName="text-muted-foreground"
                />
                API settings
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => openExternal(TMDB_DOCS)}>
                <ExternalLinkGlyph
                  url={TMDB_DOCS}
                  labelHint="TMDB docs"
                  size="sm"
                  className="mr-1"
                  neutralIconClassName="text-muted-foreground"
                />
                Developer docs
              </Button>
            </div>
          </div>
          <div className="h-px bg-border" />
          <div className="space-y-2">
            <p className="font-medium text-foreground">IGDB (games)</p>
            <GuideList
              items={[
                "Requires a Twitch developer application (Client ID + Client Secret). IGDB tokens are obtained on demand.",
                "Saving credentials uses the OS secret store when the platform provides one. Fields clear after save.",
                "Use Test connection before bulk enrich; the same page exposes cache clear and “enrich all” for your library.",
              ]}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => openExternal(TWITCH_APPS)}>
                <ExternalLinkGlyph
                  url={TWITCH_APPS}
                  labelHint="Twitch"
                  size="sm"
                  className="mr-1"
                  neutralIconClassName="text-muted-foreground"
                />
                Twitch console
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => openExternal(IGDB_DOCS)}>
                <ExternalLinkGlyph
                  url={IGDB_DOCS}
                  labelHint="IGDB"
                  size="sm"
                  className="mr-1"
                  neutralIconClassName="text-muted-foreground"
                />
                IGDB account docs
              </Button>
            </div>
          </div>
          <JumpLink to="/settings/api">Open Metadata API settings</JumpLink>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="w-4 h-4 text-orange-500" aria-hidden />
            Library sync & streaming add-ons
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Library & platforms</p>
          <GuideList
            items={[
              "Platform rows scan common launcher install manifests on disk (Steam, Epic, GOG, Ubisoft Connect, Xbox).",
              "Bookmarks and manual paths let you pin web or arbitrary executables next to scanned games.",
              "Use rescan actions after installing or moving games so tiles and icons stay accurate.",
            ]}
          />
          <JumpLink to="/settings/game">Open Library & sync</JumpLink>
          <div className="h-px bg-border my-2" />
          <p className="font-medium text-foreground">Streaming catalog ZIP</p>
          <GuideList
            items={[
              "Optional add-ons ship as ZIP files with a root manifest.json describing bookmarks, TMDB deep links, and light browser branding.",
              "Production loads use your user data directory; a repo-local plugins/ folder is only for development.",
              "Only one streaming catalog add-on is honored at startup today—pick the archive in Streaming settings.",
            ]}
          />
          <JumpLink to="/settings/streaming">Open Streaming settings</JumpLink>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="w-4 h-4 text-pink-500" aria-hidden />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <GuideList
            items={[
              "Choose a theme preset; each one remaps surfaces, glow, and shelf treatments consistently.",
              "Light/dark appearance toggles from the sun/moon control in the top-right of Library, Settings, and Documentation.",
            ]}
          />
          <p className="text-xs text-muted-foreground/90">
            Adding or editing themes? See <span className="font-mono text-foreground/80">docs/ADDING_THEMES.md</span>.
          </p>
          <JumpLink to="/settings/appearance">Open Appearance</JumpLink>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-green-500" aria-hidden />
            Controller, keyboard, and remote-style navigation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <GuideList
            items={[
              "Remote navigation is opt-in and marked experimental. When disabled, spatial grid shortcuts and the hint bar stay off.",
              "Bindings cover Back, Select, Menu, Search, shoulder/tab cycling, and more. Each action can mix keyboard chords and gamepad buttons.",
              "Settings and Documentation pages intentionally behave like forms: use Tab / Shift+Tab or the mouse; spatial moves return on the library grid.",
            ]}
          />
          <JumpLink to="/settings/controller">Open Controller settings</JumpLink>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" aria-hidden />
            Data & privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <GuideList
            items={[
              "Library snapshots and UI preferences stay local unless you opt into a future cloud feature.",
              "API traffic goes straight from your PC to TMDB, Twitch token endpoints, or IGDB as configured—there is no vendor proxy in this app.",
              "Clear saved keys or metadata cache anytime from the Metadata API settings card.",
            ]}
          />
        </CardContent>
      </Card>

      <p
        className={cn(
          "text-center text-[11px] text-muted-foreground/70 px-2 pb-2 flex items-center justify-center gap-1 flex-wrap"
        )}
      >
        <ExternalLink className="w-3 h-3 shrink-0 opacity-70" aria-hidden />
        Canonical schemas for plugins, themes, and experimental sync notes live under{" "}
        <span className="font-mono text-muted-foreground">docs/</span> in the repository.
      </p>
    </div>
  );
}
