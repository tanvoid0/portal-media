import { defineConfig, devices } from "@playwright/test";

const port = 1420;
const host = "127.0.0.1";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://${host}:${port}`,
    viewport: { width: 1920, height: 1080 },
    colorScheme: "dark",
  },
  webServer: {
    command: `pnpm exec vite --host ${host} --port ${String(port)} --strictPort`,
    url: `http://${host}:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
