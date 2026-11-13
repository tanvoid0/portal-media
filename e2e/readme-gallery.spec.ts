import { test, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * README gallery capture.
 *
 * Unlike `screenshots.spec.ts` (layout-only, empty library), this seeds a small
 * demo library by stubbing the Tauri bridge the frontend reads — `window.isTauri`
 * and `window.__TAURI_INTERNALS__.invoke` (see `src/stores/gameStore.ts` and
 * `@tauri-apps/api/core`). No native build required; the real React UI renders
 * with representative data so the README shelves look populated.
 *
 * Output: `docs/readme/*.png` (filenames referenced from README.md).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "docs", "readme");

const steamCover = (id: number) =>
  `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/library_600x900.jpg`;
const favicon = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;

type DemoGame = Record<string, unknown>;

const DEMO_GAMES: DemoGame[] = [
  { id: "demo-elden-ring", name: "Elden Ring", category: "Game", launch_type: "Steam", platform: "Steam", cover_art: steamCover(1245620), is_installed: true, playtime_total: 7200 },
  { id: "demo-hades", name: "Hades", category: "Game", launch_type: "Steam", platform: "Steam", cover_art: steamCover(1145360), is_installed: true, playtime_total: 5400 },
  { id: "demo-hollow-knight", name: "Hollow Knight", category: "Game", launch_type: "Steam", platform: "Steam", cover_art: steamCover(367520), is_installed: true, playtime_total: 3600 },
  { id: "demo-bg3", name: "Baldur's Gate 3", category: "Game", launch_type: "Steam", platform: "Steam", cover_art: steamCover(1086940), is_installed: true, playtime_total: 9000 },
  { id: "demo-cyberpunk", name: "Cyberpunk 2077", category: "Game", launch_type: "Steam", platform: "Steam", cover_art: steamCover(1091500), is_installed: true, playtime_total: 4200 },
  { id: "demo-stardew", name: "Stardew Valley", category: "Game", launch_type: "Steam", platform: "Steam", cover_art: steamCover(413150), is_installed: true, playtime_total: 2600 },
  { id: "demo-celeste", name: "Celeste", category: "Game", launch_type: "Steam", platform: "Steam", cover_art: steamCover(504230), is_installed: true, playtime_total: 1800 },
  { id: "demo-rdr2", name: "Red Dead Redemption 2", category: "Game", launch_type: "Steam", platform: "Steam", cover_art: steamCover(1174180), is_installed: true, playtime_total: 6100 },
  { id: "demo-app-spotify", name: "Spotify", category: "App", launch_type: "Executable", platform: "Windows", icon: favicon("spotify.com") },
  { id: "demo-app-discord", name: "Discord", category: "App", launch_type: "Executable", platform: "Windows", icon: favicon("discord.com") },
  { id: "demo-app-obs", name: "OBS Studio", category: "App", launch_type: "Executable", platform: "Windows", icon: favicon("obsproject.com") },
  { id: "demo-app-blender", name: "Blender", category: "App", launch_type: "Executable", platform: "Windows", icon: favicon("blender.org") },
  { id: "demo-app-vlc", name: "VLC", category: "App", launch_type: "Executable", platform: "Windows", icon: favicon("videolan.org") },
  { id: "demo-app-steam", name: "Steam", category: "App", launch_type: "Executable", platform: "Windows", icon: favicon("steampowered.com") },
];

const FAVORITE_IDS = ["demo-elden-ring", "demo-hades", "demo-bg3"];

// Only the data-driven surfaces need the seeded library. Settings/docs pages
// render fine without the stub and are captured by `screenshots.spec.ts`.
const targets: { name: string; path: string }[] = [
  { name: "library-all", path: "/library/all" },
  { name: "library-games", path: "/library/games" },
  { name: "library-apps", path: "/library/apps" },
  { name: "library-media", path: "/library/media" },
  { name: "library-favorites", path: "/library/favorites" },
  { name: "detail-game", path: "/game/demo-elden-ring" },
];

async function waitForAppShell(page: Page) {
  await page.waitForFunction(
    () => !document.querySelector('[data-testid="portal-boot-splash"]'),
    { timeout: 25_000 }
  );
  await page.locator("header").first().waitFor({ state: "visible", timeout: 15_000 });
  // Let cover art load from the CDN before snapping.
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1200);
}

test.describe("readme gallery", () => {
  test("capture populated surfaces", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    fs.mkdirSync(outDir, { recursive: true });

    // Stub the Tauri bridge + seed favourites BEFORE any app code runs.
    await page.addInitScript(
      ([games, favIds]) => {
        const w = window as unknown as Record<string, unknown>;
        w.isTauri = true;
        const callbacks = new Map<number, (p: unknown) => void>();
        let nextId = 1;
        w.__TAURI_INTERNALS__ = {
          metadata: {
            currentWindow: { label: "main" },
            currentWebview: { label: "main", windowLabel: "main" },
          },
          transformCallback(cb: (p: unknown) => void, _once?: boolean) {
            const id = nextId++;
            callbacks.set(id, cb);
            return id;
          },
          unregisterCallback(id: number) {
            callbacks.delete(id);
          },
          convertFileSrc(src: string) {
            return src;
          },
          async invoke(cmd: string) {
            if (cmd === "load_cached_library" || cmd === "scan_games") return games;
            // Benign default for every other backend command.
            return null;
          },
        };
        try {
          localStorage.setItem("portal_media_favorite_ids", JSON.stringify(favIds));
        } catch {
          /* ignore */
        }
      },
      [DEMO_GAMES, FAVORITE_IDS] as const
    );

    for (const t of targets) {
      try {
        await page.goto(t.path, { waitUntil: "domcontentloaded" });
        await waitForAppShell(page);
        await page.screenshot({ path: path.join(outDir, `${t.name}.png`), fullPage: false });
      } catch (err) {
        console.warn(`[readme-gallery] skipped ${t.name} (${t.path}): ${String(err)}`);
      }
    }
  });
});
