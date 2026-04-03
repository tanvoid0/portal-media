import { test, expect, type Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "screenshots");

/** Same filenames as referenced from README and /docs (public/screenshots). */
const targets: { name: string; path: string }[] = [
  { name: "library-all", path: "/library/all" },
  { name: "library-discover", path: "/library/discover" },
  { name: "library-media", path: "/library/media" },
  { name: "settings-library", path: "/settings/game" },
  { name: "settings-api", path: "/settings/api" },
  { name: "settings-appearance", path: "/settings/appearance" },
  { name: "settings-streaming", path: "/settings/streaming" },
  { name: "settings-controller", path: "/settings/controller" },
  { name: "docs", path: "/docs" },
];

async function waitForAppShell(page: Page) {
  await page.waitForFunction(
    () => !document.querySelector('[data-testid="portal-boot-splash"]'),
    { timeout: 25_000 }
  );
  await expect(page.locator("header").first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(500);
}

test.describe("demo screenshots", () => {
  test("capture main surfaces", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    fs.mkdirSync(outDir, { recursive: true });

    for (const t of targets) {
      await page.goto(t.path, { waitUntil: "domcontentloaded" });
      await waitForAppShell(page);
      const file = path.join(outDir, `${t.name}.png`);
      await page.screenshot({ path: file, fullPage: false });
    }
  });
});
