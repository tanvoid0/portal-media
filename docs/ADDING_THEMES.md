# Adding a new UI theme

This app switches look and feel at runtime by setting `data-theme="<id>"` and `class="light"` or `class="dark"` on `<html>`. Colors, radii, shadows, fonts, and control sizes come from **CSS custom properties** defined per theme. Shared components under `src/components/ui/` read those tokens through Tailwind—**do not add theme-specific branches in React** for the same effect.

Use this checklist when adding a theme (e.g. `aurora`).

## Checklist

1. **Pick a theme id**  
   - Lowercase, no spaces, URL-safe (matches `[a-z0-9-]+`).  
   - Used as: filename, `data-theme` value, TypeScript literal, and CSS selectors.

2. **Register the id in TypeScript**  
   - File: `src/types/theme.ts`  
   - Append `"yourid"` to the `THEME_IDS` array (keep `as const`).  
   - `ThemeId` updates automatically.  
   - `themeStore` / `loadThemeId()` validate against this list—no store changes needed.

3. **Create the stylesheet**  
   - File: `src/styles/themes/<yourid>.css`  
   - Wrap rules in `@layer base { ... }`.  
   - Define **two** blocks (both required):
     - `[data-theme="<yourid>"].light { ... }`
     - `[data-theme="<yourid>"].dark { ... }`  
   - Copy `src/styles/themes/her.css` (or `forge.css`) as a template and replace values.  
   - **Every variable listed below must exist in both blocks** so light and dark never fall back to another theme’s tokens.

4. **Import the stylesheet**  
   - File: `src/styles/index.css`  
   - Add near the top (with other theme imports):  
     `@import "./themes/<yourid>.css";`  
   - Order only matters for readability; selectors are keyed by `data-theme`.

5. **Add a Settings picker entry**  
   - File: `src/components/settings/ThemeAppearancePicker.tsx`  
   - Extend `THEME_ICONS`, `THEME_LABELS`, `THEME_HINTS`, and `THEME_STYLE` for `yourid` (each is a `Record<ThemeId, …>`—must cover all ids).

6. **Verify**  
   - Run `pnpm run build`.  
   - Run the app, open **Settings → Appearance**, select the new theme, toggle **light/dark** from the top bar.  
   - Confirm cards, buttons, inputs, and glass panels look correct.

## Required CSS variables (contract)

Semantic colors use **HSL components only** (no `hsl()` wrapper)—Tailwind wraps them as `hsl(var(--token))`.

| Variable | Role |
|----------|------|
| `--background`, `--foreground` | Page / body |
| `--card`, `--card-foreground` | `Card` surface |
| `--popover`, `--popover-foreground` | Popovers (if used) |
| `--primary`, `--primary-foreground` | Primary actions |
| `--secondary`, `--secondary-foreground` | Secondary surfaces |
| `--muted`, `--muted-foreground` | Muted text / tracks |
| `--accent`, `--accent-foreground` | Hover / accent |
| `--destructive`, `--destructive-foreground` | Danger actions |
| `--border`, `--input`, `--ring` | Borders and focus ring color |

Structural tokens (full CSS values as needed):

| Variable | Role |
|----------|------|
| `--radius` | Base radius (also used by Tailwind `rounded-lg` scale) |
| `--radius-card` | `Card` |
| `--radius-button` | `Button` |
| `--radius-input` | `Input` |
| `--control-height` | Default control height |
| `--control-height-sm` | Small |
| `--control-height-lg` | Large |
| `--control-height-icon` | Icon buttons (width uses same value) |
| `--shadow-card` | Full `box-shadow` for cards |
| `--shadow-button` | Full `box-shadow` for primary/destructive buttons (`none` is valid) |
| `--border-width-ui` | Default border width for cards, inputs, glass |
| `--ring-width` | Focus ring thickness |
| `--ring-offset-width` | Focus ring offset |
| `--font-ui` | `font-family` stack for UI primitives |
| `--font-weight-button` | Numeric weight (e.g. `500`, `600`, `700`) |
| `--slider-track-height` | Range slider track height |
| `--slider-track-radius` | Range slider track radius |
| `--glass-blur` | Backdrop blur for `.glass` / `.glass-dark` / `.glass-ultra` |
| `--glass-saturate` | Backdrop saturate for those utilities |

If you add a **new** global token, you must:

1. Document it here and in every existing theme file, **or** provide a safe default via `var(--new-token, fallback)` in CSS that uses it.  
2. If it needs a Tailwind utility, extend `tailwind.config.js` and update the relevant file in `src/components/ui/` **once** (still no per-theme TSX).

## How runtime switching works (do not duplicate)

- `src/stores/themeStore.ts` sets `document.documentElement.dataset.theme` and `classList` (`light` / `dark`).  
- `src/main.tsx` calls `hydrateThemeFromStorage()` before React mounts.  
- Invalid ids in `localStorage` fall back to `DEFAULT_THEME_ID` in `src/types/theme.ts`.

## Files you should not need to touch for a normal new theme

- `src/stores/themeStore.ts` (unless changing persistence keys or behavior)  
- `src/hooks/useTheme.ts`  
- `tailwind.config.js` (unless adding new token categories)  
- Individual feature components (e.g. `GameCard.tsx`)—prefer tokens + shared UI

## Reference files

| Purpose | Path |
|---------|------|
| Minimal full token set | `src/styles/themes/her.css` |
| Flat / industrial example | `src/styles/themes/forge.css` |
| Theme id list | `src/types/theme.ts` |
| UI primitives | `src/components/ui/button.tsx`, `card.tsx`, `input.tsx`, `slider.tsx` |
| Glass utilities | `src/styles/index.css` (`@layer utilities`) |
