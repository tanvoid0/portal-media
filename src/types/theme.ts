/**
 * Each id maps to `[data-theme="<id>"]` on `<html>` and a stylesheet in
 * `src/styles/themes/<id>.css` imported from `src/styles/index.css`.
 * Per light/dark block, define semantic colors plus structural tokens
 * (`--radius-card`, `--shadow-card`, `--font-ui`, `--control-height`, …)
 * so UI primitives pick up the look without per-theme React branches.
 */
export const THEME_IDS = [
  "her",
  "ocean",
  "playstation",
  "xbox",
  "steam",
  "netflix",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export type ThemeAppearance = "light" | "dark";

export const DEFAULT_THEME_ID: ThemeId = "her";

export const DEFAULT_APPEARANCE: ThemeAppearance = "dark";
