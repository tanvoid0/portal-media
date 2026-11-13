# Portal Media - Game Launcher

[![GitHub repository](https://img.shields.io/badge/GitHub-tanvoid0%2Fportal--media-181717?style=flat-square&logo=github)](https://github.com/tanvoid0/portal-media)
[![GitHub release](https://img.shields.io/github/v/release/tanvoid0/portal-media?sort=semver&style=flat-square)](https://github.com/tanvoid0/portal-media/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](#license)

A lightweight, fullscreen game and app launcher with a **console-style** (horizontal shelf) UI, optimized for controller navigation and minimal resource usage.

### Screenshots

Fullscreen, console-style launcher — horizontal shelves, big cover art, controller-first navigation.

<p align="center">
  <img src="docs/readme/library-games.png" alt="Games library — console-style cover shelf" width="860" />
</p>

#### Library shelves

<p align="center">
  <img src="docs/readme/library-all.png" alt="All — games, apps and media together" width="410" />
  &nbsp;
  <img src="docs/readme/library-favorites.png" alt="Favourites" width="410" />
</p>
<p align="center">
  <img src="docs/readme/library-media.png" alt="Media — streaming apps" width="410" />
  &nbsp;
  <img src="docs/readme/library-apps.png" alt="Apps" width="410" />
</p>

#### Settings

<p align="center">
  <img src="docs/readme/settings-game.png" alt="Settings — Library & sync" width="410" />
  &nbsp;
  <img src="docs/readme/settings-appearance.png" alt="Settings — Appearance / themes" width="410" />
</p>
<p align="center">
  <img src="docs/readme/settings-controller.png" alt="Settings — Controller" width="410" />
  &nbsp;
  <img src="docs/readme/settings-api.png" alt="Settings — Metadata & APIs" width="410" />
</p>

#### In-app documentation

<p align="center">
  <img src="docs/readme/docs.png" alt="In-app /docs page" width="860" />
</p>

> Library shelves above use representative demo data. Regenerate the gallery with `pnpm exec playwright test e2e/readme-gallery.spec.ts` (writes to `docs/readme/`); settings/docs come from the layout-only `pnpm screenshots`.

## Features

- **Fullscreen Mode**: Borderless, always-on-top option for immersive experience
- **Controller Navigation**: Common gamepad layouts (asymmetric face buttons, shape-labeled face buttons, and generic fallbacks)
- **Auto-Detection**: Automatically scans Steam, Epic Games, GOG, and Windows apps
- **Manual Addition**: Add custom games, apps, and bookmarks
- **Big-tile UI**: Horizontal scrolling, large cards, smooth animations
- **Low Resource Usage**: Built with Tauri for native performance
- **Fast Launch**: Direct executable launching, no launcher overhead
- **Search**: Quick search functionality to find games
- **Bookmarks**: Add web links as launchable items
- **Controller Everywhere**: Settings and docs are fully d-pad navigable; on-screen keyboard opens automatically for text fields in gamepad mode
- **Power Menu**: Exit, sleep, restart, or shut down the PC from the shell — console style
- **Console Feedback**: Synthesized navigation sounds and controller rumble (toggles in Settings → Controller)
- **Native Gamepad Layer**: Back+Start focuses Portal even while a game or browser owns the screen; right stick becomes a virtual cursor inside the embedded browser

## Add-ons and plugins

Streaming catalog add-ons are optional zip archives with a `manifest.json`; the app loads them from your profile `plugins` folder or configured paths. See **[docs/PLUGINS.md](docs/PLUGINS.md)** for the manifest schema, packaging, discovery order, and a roadmap for future game/app plugin surfaces.

## Technology Stack

- **Framework**: Tauri 2.0 (Rust backend + Web frontend)
- **Frontend**: React + TypeScript + Vite
- **UI Library**: TailwindCSS + shadcn/ui
- **State Management**: Zustand
- **Package Manager**: pnpm

## Development

### Prerequisites

- Node.js 18+ and pnpm
- Rust (for Tauri backend)
- Windows SDK (for Windows builds)

### Setup

1. Install dependencies:
```bash
pnpm install
```

2. Run in development mode:
```bash
pnpm tauri dev
```

3. Build for production:
```bash
pnpm tauri build
```

### Demo screenshots (automation)

Regenerate **layout-only** images under `public/screenshots/` for the in-app **Documentation** page (`/docs`). This uses Playwright + Vite only (no Tauri), so metadata and your library usually look empty—**not** a substitute for the README gallery above.

```bash
pnpm screenshots:install   # once per machine: download Chromium for Playwright
pnpm screenshots          # starts Vite on port 1420, captures each route, writes PNGs
```

Requires port **1420** free (stop `pnpm dev` / `tauri dev` first).

## Controls

### Keyboard
- **Arrow Left/Right**: Navigate between games
- **Enter/Space**: Launch selected game
- **Escape**: Back/Exit

### Gamepad
- **D-pad Left/Right or Left Stick**: Navigate between games
- **South face button** (e.g. bottom): Launch selected game
- **East face button** (e.g. right): Back
- **Menu**: Open settings

## Game Detection

The app automatically scans for:
- **Steam**: Reads from Steam library folders
- **Epic Games**: Scans Epic Games Launcher installations
- **GOG**: Scans GOG Galaxy games
- **Windows Apps**: Scans Start Menu and common install directories

## Adding Games Manually

1. Go to Settings
2. Use the "Add Bookmark" feature for web links
3. For local games, the app will detect them automatically during scanning


TODO://
* Uninstall games

Save cloud sync (Google Drive) is available under **Settings → Library & sync**. See [docs/SAVE_CLOUD_SYNC.md](docs/SAVE_CLOUD_SYNC.md).

## License

MIT
