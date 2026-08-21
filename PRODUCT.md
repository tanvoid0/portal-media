# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users run Portal Media as their Windows session hub: a living-room TV with a controller **and** a desk with mouse and keyboard, equally. The job is to find, launch, and return from games, apps, and media without dropping into Explorer, Steam, or a browser first.

Other audiences (family members on the same PC, people using optional Winlogon shell replacement) share the same surface; there is no separate admin or guest UI.

## Product Purpose

Portal Media is a fullscreen, controller-capable game and media launcher for Windows. It scans installed stores, presents a console-style library, launches real executables and URIs, and optionally acts as the session shell (console mode, taskbar hide, Winlogon replacement).

Success is: sit down, find the title, launch it, come back to Portal when it exits — on a couch or at a desk — without fighting chrome, forms, or inconsistent controls.

## Positioning

It is a **Windows shell experience** that orchestrates existing launchers, DRM, and anti-cheat instead of replacing them. Neighboring products (Steam Big Picture, Xbox app, Playnite) own a store or a library; Portal owns the session: library + embedded browser + power/session controls + return-to-hub, on the real OS.

## Operating Context

- Typical scene: TV or monitor, gamepad and/or mouse+keyboard, often fullscreen or console mode.
- Library is populated from Steam, Epic, GOG, Xbox, Windows apps, and manual entries; metadata from IGDB/TMDB when credentials exist.
- Settings and docs must be d-pad navigable; an on-screen keyboard opens for text fields in gamepad mode.
- Overlays: app switcher, quick access, game options, exit/power, search popover.
- Optional: launch-at-login, hide taskbar, Winlogon `Shell` replacement, save cloud sync, streaming add-ons, Spotify, AI-assisted library search.

## Capabilities and Constraints

Confirmed:

- Tauri 2 + React + TypeScript + Vite + Tailwind; state in Zustand.
- Current UI primitives under `src/components/ui/` are incomplete (button, card, input, slider, toaster); most screens use one-off glass/glow classes and hardcoded light-on-dark colors.
- Six runtime themes (`her`, `ocean`, `nimbus`, `vertex`, `forge`, `velvet`), each with light and dark, driven by CSS variables on `<html data-theme>`. Themes must remain first-class; components must consume tokens, not theme-specific React branches.
- Controller spatial navigation, native XInput layer, UI sounds, rumble, reduced-motion tile tokens already exist and stay.
- Do not reimplement Steam/Netflix/engines; launch and focus external apps.
- Dual-distance UX: the same chrome must work at TV distance (large hit targets, clear focus) and at a desk (dense, precise, mouse-reachable).
- This pass covers the **whole product**: library shelves, details, settings, overlays, and search — by replacing control quality and look, not by cutting features.

Undecided (not blocking):

- Whether a third-party component library is added versus expanding the local kit on the existing Tailwind/shadcn tokens.

## Brand Commitments

- Name: **Portal Media**.
- Identity: console-style horizontal shelves and big tiles as the library mechanism.
- Six named themes stay; do not collapse them for a single “gaming” skin.
- Binding request for this work: a **proper UI kit** (shared form controls, lists, dialogs, chrome) with **gaming aesthetics** that is **practical and modern**, not gradient-tinted one-off components.
- Default appearance in code today is dark / theme `her`; users can change both.

## Evidence on Hand

- Real installed-library data at runtime (user machine); Playwright demo screenshots under `public/screenshots/` are layout-only and often empty — do not treat them as the live library.
- README gallery paths under `docs/readme/` may be missing; do not fabricate screenshots or testimonials.
- Product docs: `README.md`, `ADR.md`, `docs/ADDING_THEMES.md`, `docs/WINLOGON_SHELL.md`, plugin and save-sync docs.
- No customer quotes, benchmarks, or pricing exist; do not invent them.

## Product Principles

1. **Same hub, two distances** — every control must be usable with a d-pad at TV distance and with a pointer at a desk.
2. **Launch, don’t recreate** — Portal orchestrates stores, browsers, and Windows; it is not a new storefront.
3. **One control vocabulary** — buttons, fields, toggles, dialogs, and lists are kit components on theme tokens, not per-screen glass recipes.
4. **Task over decoration** — finding and launching a title outranks glow, gradients, and novelty chrome.
5. **Themes style the kit; the kit does not fork** — six looks, one component grammar.

## Accessibility & Inclusion

- Keyboard and gamepad are first-class; mouse is first-class too.
- Existing spatial nav, focus rings, on-screen keyboard, and `prefers-reduced-motion` tile behavior stay.
- Contrast and focus must remain valid across all six themes in light and dark.
- No separate WCAG certification was established; do not claim one.
