---
name: Portal Media
description: Console control deck — cover grid, opaque chrome, hard selection frames.
colors:
  background: "hsl(0 0% 6%)"
  foreground: "hsl(0 0% 98%)"
  card: "hsl(0 0% 9%)"
  card-foreground: "hsl(0 0% 98%)"
  primary: "hsl(0 70% 55%)"
  primary-foreground: "hsl(0 0% 100%)"
  muted: "hsl(0 0% 12%)"
  muted-foreground: "hsl(0 0% 65%)"
  secondary: "hsl(0 0% 12%)"
  secondary-foreground: "hsl(0 0% 98%)"
  border: "hsl(0 0% 15%)"
  input: "hsl(0 0% 12%)"
  destructive: "hsl(0 62% 50%)"
  destructive-foreground: "hsl(0 0% 100%)"
typography:
  display:
    fontFamily: "Barlow, ui-sans-serif, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0.025em"
  headline:
    fontFamily: "var(--font-ui)"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Barlow, ui-sans-serif, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "normal"
  body:
    fontFamily: "var(--font-ui)"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: "normal"
  label:
    fontFamily: "var(--font-ui)"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "normal"
rounded:
  none: "0px"
  card: "0.75rem"
  button: "0.5rem"
  input: "0.5rem"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  deck: "100px"
  tile-width: "16rem"
  tile-height: "24rem"
components:
  deck-key:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.display}"
    rounded: "{rounded.none}"
    padding: "12px 16px"
    width: "6.25rem"
  deck-key-hover:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.none}"
  deck-key-active:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.none}"
  panel:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.none}"
    padding: "20px"
  switch:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.none}"
    width: "24px"
    height: "24px"
  switch-on:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.none}"
    width: "24px"
    height: "24px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
    height: "2.5rem"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
    height: "2.5rem"
  filter-key:
    backgroundColor: "transparent"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "2.75rem"
  filter-key-active:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    height: "2.75rem"
  cover-tile:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.card}"
    width: "{spacing.tile-width}"
    height: "{spacing.tile-height}"
  cover-tile-focus:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.none}"
    width: "{spacing.tile-width}"
    height: "{spacing.tile-height}"
---

# Design System: Portal Media

## Overview

**Creative North Star: "The Console Control Deck"**

Portal Media is a fullscreen hub you sit down to. Home is a cover grid you roll through. Sections are five large top keys — Find, Library, Discover, Media, Settings — not a glass settings site and not a sidebar of small links. Chrome is opaque. Selection is a hard primary rectangle that thickens. Cover art carries the color; the frame does not.

Six named themes (`her`, `ocean`, `nimbus`, `vertex`, `forge`, `velvet`), each with light and dark, still own the semantic tokens. Hub geometry does not follow them: deck keys, filters, switches, panels, and utility keys stay square across every theme. Default appearance in code is dark `her`; the values in the frontmatter are that default. Other themes remap the same roles.

Rejected as chrome (confirmed by the shipped kit): frosted glass bars, glow/pulse focus, pill toggles, filled accent keys, and per-theme React forks.

**Key Characteristics:**

- Centered five-key function deck, icon above label, Barlow (`font-hub`) lettering
- Opaque `background` / `card` panels; 1px `border` hairlines, not blur
- Live state is a 3px primary square frame (rest is 2px transparent)
- Primary fill only on Launch / Scan actions
- Cover tiles supply imagery and ambient wash; focus is an inset square overlay
- Form kit consumes CSS variables; chrome overrides radius to `0`

## Colors

Semantic HSL variables on `[data-theme]` × `.light` / `.dark`. Components never hardcode a theme hex. Frontmatter numbers are dark `her`.

### Primary

- **Selection Red** (`primary`): The live frame. Used as a 3px inset/outline on the active deck key, focused tile, selected filter, settings tab, and checked switch. Also the fill for Scan / Launch. Rarity is the point — it is not a wash, not a key background, not body text.
- **On-primary** (`primary-foreground`): Text and icons sitting on a Scan / Launch fill.

Theme remaps of the same role (dark): ocean `hsl(188 86% 53%)`, nimbus `hsl(215 90% 58%)`, vertex `hsl(142 100% 36%)`, forge `hsl(202 100% 52%)`, velvet `hsl(355 92% 48%)`. Chrome still draws a hard rectangle; only the hue changes.

### Neutral

- **Stage** (`background`): Full-bleed hub and overlay scrim (`background/80` on Find).
- **Ink** (`foreground`): Titles, active labels, switch inner mark.
- **Panel** (`card` / `card-foreground`): Opaque settings groups and the Find dialog surface. Slightly lifted from stage (9% vs 6% in dark `her`).
- **Quiet** (`muted` / `muted-foreground`): Resting deck/filter labels, descriptions, clock at 80% ink.
- **Rule** (`border`): Header rules, setting-row dividers, resting tile stroke (`border-2`).
- **Field** (`input`): Input track fill behind the Find field.

### Tertiary

- **Hazard** (`destructive` / `destructive-foreground`): Power-key hover and destructive actions only.

**The Selection-Only Accent Rule.** Primary appears as a thickening frame or as Scan / Launch fill. It does not fill deck keys, tabs, or panel backgrounds.

**The Token Kit Rule.** Six palettes restyle the same variables. New surfaces consume `primary`, `card`, `border`, `foreground` — never a one-off `text-white` or a theme-named class.

## Typography

**Display Font:** Barlow 500/600 (self-hosted `@fontsource/barlow`, `font-hub` → `"Barlow", ui-sans-serif, sans-serif`)
**Body Font:** `--font-ui` per theme (system stacks: Segoe / ui-sans / Arial / Helvetica Neue depending on theme)
**Label/Mono Font:** Tabular numerals on the clock; InputGlyph uses `--font-mono` where present

**Character:** Hub lettering is compact, wide-tracked Barlow — console key captions, not a marketing display face. Settings copy stays on the theme UI stack so the six looks still speak through body type.

### Hierarchy

- **Display** (600, 0.95rem, tracking-wide): Function-deck labels. Icons sit 28×28 above the word.
- **Headline** (600, 1.125rem, tracking-tight): `PanelTitle`. Empty-library line uses 1.25rem / 600 on the inherited sans stack.
- **Title** (500, 0.875rem): Settings section tabs and library filter keys (`font-hub`).
- **Body** (400, 0.875rem, leading-relaxed): `PanelDescription`, setting help, Find helper line. Keep it short; this is TV-distance copy.
- **Label** (500, 0.875rem): `SettingRow` titles and `Label`. Clock is 0.875rem / 600 / tabular-nums / tracking-wide.

### Named Rules

**The Hub Lettering Rule.** Deck keys, library filters, and settings section tabs use `font-hub` (Barlow). Settings paragraphs and panel titles stay on `font-ui`. Do not swap Barlow onto every surface, and do not put a theme display face on the five keys.

## Layout

The shell is a column: opaque stage, then a 3-column header (`1fr auto 1fr`) at least 100px tall (`min-h-[6.25rem]`), then optional secondary row, then the outlet.

Header padding is 16px, 24px from the `lg` breakpoint. The function deck is the center track — five keys, 4px gaps, each key at least 100px wide. Window utilities (docs/home, fullscreen, power, appearance, clock) sit in the right track with 6px gaps and 44×44 hit targets. The left track is a drag region when the window is not fullscreen.

Library keeps a secondary row under a top border: category keys, a 1px `border` rule, Favourites, a spacer, then sort keys. Settings keeps a horizontally scrolling section-tab row (`min-h-[3rem]`) instead. Docs has no secondary row. Settings content is a 64rem-max column (`max-w-5xl`) with 20–24px page padding; docs is 48rem (`max-w-3xl`).

Cover tiles are 14rem × 23rem. Find is a fullscreen scrim with a square `Panel` at `max-w-2xl`, started 18vh from the top.

Rhythm: 4 / 8 / 12 / 16 / 20 / 24px. Chrome motion on frames is 150ms; do not invent a second spacing scale per theme.

## Elevation & Depth

Chrome is flat. Depth is a tonal step from `background` to `card` plus a 1px `border`, not a drop shadow and not blur. The library may wash the stage with cover-derived ambient radials (`AmbientBackgroundLayer` when the library chrome is active); settings and docs turn that layer off. Find uses `background/80` as a scrim and `shadow-card` on the dialog panel only.

Cover tiles still attach `--shadow-card` through the `Card` primitive. That shadow is a theme token, not a glow, and it is not the focus language.

### Shadow Vocabulary

- **None (chrome rest):** Deck keys, filters, switches, utility keys — stroke only.
- **Card** (`box-shadow: var(--shadow-card)`): Cover tiles and the Find `Panel`. Values vary by theme; do not replace them with a primary halo.

### Named Rules

**The Hard-Frame Focus Rule.** Focus and selection thicken a primary rectangle (2px transparent → 3px `primary`). They do not pulse, glow, scale the chrome, or draw a soft ring. Text fields still use `--ring` / `--ring-width` because the Input primitive has not been squared to the deck.

**The Opaque Chrome Rule.** Hub chrome is `bg-background` / `bg-card`. Do not introduce `backdrop-filter` or `.glass` on the deck, header, settings panels, or Find overlay.

## Shapes

Hub chrome is square: `rounded-none` on deck keys, filters, settings tabs, utility keys, switches, `Panel`, Scan / Open Settings, and the tile focus overlay (`ShelfFocusRing`). Resting chrome stroke is 2px transparent (or `border` on tiles); live stroke is 3px `primary`. Switches are 24×24 square frames with a 5px-inset foreground mark when on — not pills, not a primary fill.

Cover tile *bodies* still clip to `--radius-card` (`rounded-card`, 0.75rem in `her`). Button and Input primitives still read `--radius-button` / `--radius-input` unless a chrome caller passes `rounded-none`. Nimbus still sets `--radius-button: 9999px`; that token must not leak onto the deck.

**The Square Deck Rule.** New hub controls (keys, tabs, toggles, panels, selection frames) are 0 radius even when the active theme’s card/button radius is round or pill.

## Components

### Buttons

- **Shape:** Square on hub actions (`rounded-none`). The unscoped `Button` primitive still uses `rounded-button` + `--font-weight-button`; chrome callers override.
- **Primary (Scan / Launch):** `bg-primary` / `text-primary-foreground`, min width ~9rem on the empty library. This is the only filled accent control on the hub.
- **Outline:** `border-input` on `background`, square, same min width — “Open Settings”.
- **Ghost keys:** Transparent, 2px transparent border; hover paints `border` and ink; live state uses the 3px primary frame. Utility icons are 20×20 in a 44×44 square.
- **Hover / Focus:** 150ms on `border-width` and color. `focus-visible` on a deck key is the same 3px primary frame, not a CSS outline.

### Chips

Library filters and settings tabs are ghost keys, not chips: transparent fill, Barlow, 2px/3px square frame, optional 16px Lucide icon. Selected Favourites fills the star; it does not fill the key.

### Cards / Containers

- **Panel:** Square, `bg-card`, `border-ui` `border`, `font-ui`. Header 20px / 20px / 12px; body 20px. Stack panels with default page gap, not nested glass cards.
- **Cover tile:** 16rem wide, 2:3 poster. Art is the face; the title sits centered under the poster — not a caption band on the art. Focus is a 3px primary rectangle on the poster only. No gradient wash, shine, or launch chip on the tile.
- **Find overlay:** Full-viewport scrim, square `Panel` `max-w-2xl`. The field inside still uses the Input primitive (theme radius + ring).

### Inputs / Fields

- **Style:** `h-control` (2.5rem in `her`; Find overlay uses 3rem / `text-base`), `bg-background`, `border-input`, `rounded-input`, `font-ui`.
- **Focus:** `--ring` / `--ring-width` / `--ring-offset-width` on the primitive. Do not invent a second glow.
- **Disabled:** 50% opacity.

### Navigation

Five `DeckKey`s in `FunctionDeck`, always mounted on library, settings, and docs chrome. Active section is a data attribute (`data-active=true`), including Find while the overlay is open. Settings sections are a second row of square tabs. Spatial nav on leftover form surfaces may still set `[data-console-focus]` (2px primary outline, 0.5rem radius) — that is a form fallback, not the deck language.

### Switch

24×24 square, 2px `border`. Checked: 3px `primary` border and a foreground square inset 5px. Not a sliding pill, not a primary-filled box.

### Setting row

Label and description left, control right, `border-b` between rows, 16px vertical padding. Built for a d-pad at TV distance and a pointer at a desk.

## Do's and Don'ts

### Do:

- **Do** treat the five top keys as the product’s primary navigation — icon above Barlow label, centered, square frame that thickens.
- **Do** use `primary` only as a 3px selection frame or as Scan / Launch fill.
- **Do** build settings and overlays from `Panel`, `SettingRow`, `Switch`, `Label`, and `Separator` on semantic tokens.
- **Do** keep cover art as the color source (tile imagery + optional ambient wash); keep chrome opaque.
- **Do** leave theme palettes first-class: remap variables, do not fork components.

### Don't:

- **Don't** fill deck keys, filters, or tabs with `primary` or with glass/blur.
- **Don't** use pill toggles, pill tabs, or `rounded-2xl` search capsules on the hub — Find is a large square overlay.
- **Don't** pulse, glow, or soft-ring focus on the deck or the cover grid.
- **Don't** introduce per-theme React branches or hardcoded `text-white` / `border-white/20` recipes on new surfaces.
- **Don't** let `--radius-button: 9999px` (nimbus) or other theme radii restyle the function deck.
