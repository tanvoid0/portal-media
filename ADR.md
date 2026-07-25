# ADR — Windows Gaming & Media Console Shell

**ADR-001**  
**Title:** Controller-First Gaming & Media Shell for Windows  
**Status:** Accepted (partially implemented)  
**Date:** 2026-05-21  
**Product:** Portal Media (`portal-media`)

---

## Context

Modern high-end PCs deliver strong gaming and media performance but weak living-room usability.

The default Windows flow is fragmented:

- Boot into desktop and Explorer
- Launch Steam / Epic / Battle.net / browsers manually
- Configure overlays and utilities separately
- Navigate with mouse and keyboard
- Manage HDR, audio, and displays per session

Consoles, Steam Deck, and smart TVs hide that complexity behind a single, controller-first surface.

**Goal:** A controller-first **shell experience** on Windows 11 that:

- feels like a console dashboard at boot
- hides desktop complexity during play and watch sessions
- treats games and media as first-class “experiences”
- launches and focuses external apps instead of reimplementing them
- stays compatible with Windows, store launchers, and anti-cheat

**Non-goals:** custom OS, hypervisor, or replacing game/media engines (Steam, Netflix, etc.).

---

## Decision

Build **Portal Media** as the primary shell UX: a fullscreen, controller-driven hub that orchestrates games, embedded browsing, and Windows shortcuts.

| Layer | Role |
|-------|------|
| **Portal UI** | Library, discover, settings, in-app “shell chrome” (nav, overlays, hints) |
| **Tauri host** | Windowing, IPC, library scan, launch, embedded webviews, metadata cache |
| **Windows 11** | Real OS, drivers, DRM, anti-cheat, store clients |

Portal Media is a **shell in product terms** (session hub + launcher + media container), not necessarily `explorer.exe` replacement on day one.

---

## Implementation status (as of 2026-05-21)

What exists today is a **standalone Tauri application** that runs beside Explorer. In-app naming (`AppShell`, `ShellChromeContext`, streaming add-ons) describes the **application shell**, not the Windows logon shell.

| Area | Status | Notes |
|------|--------|-------|
| Controller-first UI | **Done** | Spatial nav, shelves, configurable gamepad bindings |
| Game library scan | **Done** | Steam, Epic, GOG, Xbox, Windows apps, manual entries |
| Game launch | **Done** | URI schemes + detached processes; PID focus for switcher |
| Embedded browser / media | **Done** | Separate Tauri webview windows, tabs, positioning |
| Session model (in-app) | **Partial** | `library` / `browser` / `externalGame`; switcher + PID watchdog |
| Global shell hotkeys (Phase 2) | **Done** | Ctrl+Shift+Tab (switcher), Ctrl+Shift+H (quick access) |
| Focus watchdog (Phase 2) | **Done** | `SetWinEventHook` + process poll; return-to-Portal on game exit |
| Streaming catalog add-ons | **Done** | Zip `manifest.json`; see [docs/PLUGINS.md](docs/PLUGINS.md) |
| Metadata (IGDB / TMDB) | **Done** | Credentials + SQLite metadata cache |
| Platform sync hooks | **Partial** | Connect / sync / auth commands; evolving |
| Library persistence | **Done** | SQLite manual library + scan snapshots |
| Automation profiles (display, audio, tools) | **Done** | Phase 3: launch/exit profiles in Settings → Console & startup |
| Process tree cleanup on exit | **Not started** | Launch works; orchestrated teardown is future |
| Windows shell replacement | **Done** | Phase 4: optional `Winlogon\Shell`; UAC, backup, recovery — [docs/WINLOGON_SHELL.md](docs/WINLOGON_SHELL.md) |
| Desktop chrome takeover (taskbar, tray) | **Done** | Console mode: SHAppBar autohide + taskbar hide; restore on exit / crash recovery |
| Login startup + Console mode | **Done** | Settings → Console & startup; HKCU Run, Ctrl+Shift+Q escape, persisted recovery |

**Implication:** The ADR’s *behavioral* target (console-like hub) is largely reachable inside the app; the *system integration* target (true shell) is still roadmap.

---

## Deployment model: standalone app vs Windows shell

### Today — standalone app (Phase 0)

```
[ Explorer + taskbar + tray always present ]
         │
         └── User starts Portal Media (or startup shortcut)
                   └── Borderless / fullscreen Tauri window
                   └── External games & browser webviews as sibling HWNDs
```

- Explorer remains the OS shell.
- Portal can maximize or enter “Big Picture” fullscreen (taskbar hidden **while Portal owns focus**).
- Games and media run as normal Windows processes; Portal tracks PIDs where available.

This matches how many “launcher” products ship first: low risk, no logon shell changes, easier debugging.

### Target — shell-like integration without replacing Windows

A useful analogy is **[MyDockFinder](https://www.mydockfinder.com/)** (and similar “Mac on Windows” shells): they **do not replace the kernel or Explorer process model**. They **re-skin and re-home** desktop chrome:

- custom dock instead of the taskbar
- custom top bar / menu strip
- controlled notification / system tray presentation
- optional auto-start so the PC *feels* like a different shell

Portal Media should follow the same **UX substitution** pattern before (or instead of) aggressive `Winlogon\Shell` replacement:

| Windows surface | Standalone today | Shell-like target (MyDockFinder-style) |
|-----------------|------------------|----------------------------------------|
| Taskbar | Visible when not fullscreen | Hide or replace while “Console mode” is on |
| System tray / notifications | Unchanged | Suppress or redirect to Portal overlays |
| Alt+Tab / task switching | OS default | Portal app switcher as primary UX |
| Boot experience | Desktop then app | Optional auto-start → fullscreen Portal |
| Explorer shell process | `explorer.exe` | Still `explorer.exe`; Portal owns attention |

**Phase 1 — Console mode (shipped):** Portal can start at login, enter Big Picture fullscreen, hide the taskbar via `SHAppBarMessage` + Win32 show/hide while active, restore on exit, and expose Ctrl+Shift+Q as a global escape. Explorer keeps running. See [Phase 1 — Console mode (Win32)](#phase-1--console-mode-win32) for concrete APIs.

**Phase 4 (optional, last):** Registry `Shell = PortalMedia.exe` only after Phases 1–3 are stable—direct boot into Portal, with documented escape hatch (safe mode, shell revert). See [Shell strategy](#shell-strategy-revised-roadmap).

```text
Phase 0 (now)     Phase 1 (next)           Phases 2–3              Phase 4 (optional)
──────────────────────────────────────────────────────────────────────────────────────
Standalone app    Console mode + startup   Focus + automation      Winlogon shell
Explorer default  Taskbar/tray policy      Stronger switcher       Boot → Portal only
Manual launch     Explorer still runs      Still explorer.exe      explorer not UI shell
```

---

## High-level architecture (implemented stack)

```text
+----------------------------------------------------------+
|              Portal Media (Tauri 2 + React)              |
|----------------------------------------------------------|
| UI: shelves, details, settings, docs, shell overlays     |
| Navigation: universalNavCore + gamepad/keyboard bindings |
| State: Zustand (library, browser, sessions, overlays)    |
|----------------------------------------------------------|
| Rust commands: scan, launch, focus PID, browser windows  |
| SQLite: manual library, metadata cache, snapshots        |
| Streaming add-ons: zip manifest loader (plugins folder)  |
|----------------------------------------------------------|
| Windows 11 — Explorer, DXGI, store clients, Edge/WebView2 |
+----------------------------------------------------------+
```

Frontend “shell” components (`AppShell`, `ShellChromeContext`, `shellOverlayStore`) implement **in-application** chrome, not OS shell hooks.

---

## Core design principles

### 1. Controller first

Fully operable with Xbox / PlayStation-style layouts and remappable actions (`Settings → Controller`). Mouse and keyboard remain supported for desk use.

Navigation: predictable focus, large targets, TV-safe layout, no mouse-only dead ends.

### 2. One active experience (intent)

At most one foreground *experience* should dominate attention: library, embedded browser session, or external game. The app switcher and session store move toward this; full OS-level enforcement (killing stray overlays, blocking Alt+Tab) is future work.

### 3. External apps stay external

Portal orchestrates—scan, launch, focus, embed browsing—it does not reimplement Steam, Netflix, or game runtimes.

### 4. Plugin-shaped extensibility

**Implemented:** streaming catalog add-ons (zip + `manifest.json`).  
**Roadmap:** game/app library sources per [docs/PLUGINS.md](docs/PLUGINS.md).

Provider contract (conceptual; not a single interface yet):

```typescript
interface CatalogAddon {
  id: string;
  version: string;
  webOrigin: string;
  features: { libraryBookmark: boolean; tmdbStreamButton: boolean };
}
```

### 5. Automation is event-driven (Phase 3 shipped)

Launch/exit profiles run on game launch and when a tracked process exits: disable secondary displays (`QueryDisplayConfig` / `SetDisplayConfig`), set default playback device (Core Audio / PolicyConfig), optional companion executables, with snapshot restore on exit. HDR and GPU vendor profiles remain external-tool territory.

Example future profile:

```yaml
onLaunch:
  - disableMonitor: 2
  - setAudioDevice: "Headset"
  - launch: "RTSS.exe"
onExit:
  - restoreDisplays
  - restoreAudio
```

---

## Technical decisions

### UI host: Tauri 2 + React + TypeScript

**Chosen** for this repository.

| Option | Verdict |
|--------|---------|
| **Tauri 2** | **Selected** — small footprint, native window control, Rust for OS integration |
| WPF / WinUI | Strong on Windows only; heavier fullscreen/controller iteration |
| Avalonia (.NET) | Viable cross-platform shell; not the stack in use (see [superseded notes](#superseded-planning-notes)) |
| Electron | Higher idle memory; weaker living-room ergonomics |

### Storage: SQLite (rusqlite)

Used for manual library rows, metadata cache, and scan snapshots—not a separate “orchestration DB” yet.

### Media strategy

Streaming services without APIs: dedicated webviews (Tauri `WebviewWindow`), kiosk-style flows, controller navigation in the host UI. Deep links and branding via streaming add-ons and TMDB integration.

### Controller input

**Implemented:** browser Gamepad API + unified navigation core + per-action bindings.  
**Not implemented:** SDL3 / Windows GameInput as primary stack (acceptable unless hotplug/latency requirements force native APIs).

### Security posture

Prefer standard Win32/Tauri APIs—process launch, window focus, shell icon extraction—over injection, kernel drivers, or in-game hooks.

---

## Session model (current code)

Sessions are **in-app** records used by the app switcher, not full OS session objects.

```text
AppSession
 ├── library      (Portal dashboard)
 ├── browser      (embedded webview stack)
 └── externalGame (launched title; optional pid for focus)
```

**Implemented:** upsert on launch, focus via `focus_window_by_pid`, switcher UI.  
**Planned:** child process tree tracking, exit hooks, suspend/resume, crash recovery.

---

## Shell strategy (revised roadmap)

| Phase | Description | Shell fidelity |
|-------|-------------|----------------|
| **0** | Standalone Portal window; user launches manually | App only |
| **1** | Startup entry + “Console mode”: fullscreen, taskbar autohide/hide while active, tray policy | MyDockFinder-like |
| **2** | Global hotkeys, focus watchdog, stronger app switcher vs Alt+Tab | **Shipped** (shell hotkeys + watchdog; Alt+Tab not blocked) |
| **3** | Automation engine + launch/exit profiles | **Shipped** (display, audio, companion launch) |
| **4** | Optional `Winlogon\Shell` replacement | **Shipped** (Settings + recovery docs) |

Registry reference (Phase 4 only):

```registry
HKLM\Software\Microsoft\Windows NT\CurrentVersion\Winlogon
Shell = portal-media.exe
```

Requires recovery documentation (revert to `explorer.exe`, safe mode).

### Phase 1 — Console mode (Win32)

Implement Console mode as a **Rust module** in the Tauri backend (e.g. `src-tauri/src/console_mode.rs`) with two IPC commands: `enable_console_mode` / `disable_console_mode`. The frontend toggles it from Settings and calls **disable** on graceful exit; Rust uses a guard (or `Drop`) so a crash still attempts restore on next launch.

| Goal | Preferred API | Notes |
|------|---------------|-------|
| Start at login | `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` value, Startup folder `.lnk`, or Task Scheduler “At logon” | User-scoped; no admin for Phase 1. Expose on/off in Settings. |
| Fullscreen dashboard | Tauri `Window::set_fullscreen(true)` (already used for Big Picture) | Hides taskbar on the monitor that owns the fullscreen HWND. |
| Taskbar hide (primary) | `SHAppBarMessage(ABM_SETSTATE, ABS_AUTOHIDE \| ABS_ALWAYSONTOP)` via `windows` crate | More reliable than fullscreen alone when games exit to desktop briefly. |
| Taskbar hide (fallback) | `FindWindowW("Shell_TrayWnd")` + `ShowWindow(SW_HIDE)`; re-show on disable | Simple; restore `SW_SHOW` on exit. Secondary monitor taskbars (`Shell_SecondaryTrayWnd`) need the same treatment on multi-monitor HTPCs. |
| Work area (optional) | `SystemParametersInfoW(SPI_SETWORKAREA, …)` or `SHAppBarMessage(ABM_SETPOS)` | Only if autohide leaves a dead gap; save previous rect and restore on disable. |
| Foreground / focus | `AllowSetForegroundWindow(ASFW_ANY)` then `SetForegroundWindow`; existing `focus_window_by_pid` | Call before raising Portal after a game exits. Reduces “flash desktop” time. |
| Global escape | `RegisterHotKey` (e.g. Ctrl+Shift+Q) → disable Console mode + restore taskbar | Required safety valve when taskbar is hidden. Document in Settings / docs. |
| Startup with Explorer | Do **not** change `Winlogon\Shell` in Phase 1 | `explorer.exe` keeps running; Portal is a top-level app. |

**Tray and notifications (Phase 1 scope — conservative):**

| Goal | API / approach | Notes |
|------|----------------|-------|
| Do not break system tray | Avoid killing `explorer.exe` or blocking `Shell_TrayWnd` messages | Breaking tray breaks volume, network, and power UX. |
| De-emphasize tray while in Console mode | Hide taskbar (above); optional `SHAppBarMessage(ABM_GETTASKBARPOS)` to detect layout | Full “replace notification center” is Phase 2+ (custom overlay UI in Portal). |
| Toast awareness (optional) | `RegisterShellHookWindow` / `WH_SHELL` (`HSHELL_WINDOWACTIVATED`, etc.) | Use for focus watchdog and “return to Portal when app closes”—not for reimplementing Action Center. |

**Suggested enable sequence:**

```text
enable_console_mode:
  1. Save current work area / taskbar visibility state
  2. SHAppBarMessage(ABM_SETSTATE, autohide+ontop) [+ secondary trays if present]
  3. set_fullscreen(true) on main Portal window
  4. AllowSetForegroundWindow + SetForegroundWindow
  5. RegisterHotKey(escape chord)

disable_console_mode (exit, toggle off, or hotkey):
  1. UnregisterHotKey
  2. set_fullscreen(false)
  3. Restore ABM_SETSTATE / ShowWindow(taskbar)
  4. SPI_SETWORKAREA restore if modified
```

**Phase 2 (shipped):** `RegisterHotKey` for app switcher (`Ctrl+Shift+Tab`) and quick access (`Ctrl+Shift+H`); `SetWinEventHook(EVENT_SYSTEM_FOREGROUND)` + process poll for tracked game PIDs; `focus_portal_main_window` with `AllowSetForegroundWindow` on game exit. Alt+Tab is intentionally **not** blocked—Portal switcher is the recommended UX.

**Phase 2+ (future):** Custom notification overlay; optional Alt+Tab filtering (high risk).

**Phase 3 automation (display/audio preview):**

| Action | API |
|--------|-----|
| Disable secondary display | `QueryDisplayConfig` / `SetDisplayConfig` (CFGSDC flags) or `ChangeDisplaySettingsExW` |
| Default playback device | `IMMDeviceEnumerator` (Core Audio) via `windows` / `wasapi` |
| HDR / GPU profiles | External tools or vendor CLI—no kernel hooks |

Dependencies: extend `windows` crate features (`Win32_UI_Shell`, `Win32_UI_WindowsAndMessaging`, `Win32_System_SystemServices` for SPI). Keep all P/Invoke in Rust; frontend only invokes Tauri commands.

---

## Consequences

### Product and positioning

- Market as **“controller-first game & media hub”** or **“Console mode for Windows”**, not as a **Windows shell replacement**, until Phase 4 is shipped and documented.
- In-app copy should say **Big Picture / Console mode**, not “OS shell,” to match what `AppShell` actually is.

### User support

- Users must always have a **documented escape**: global hotkey to exit Console mode, Task Manager (Ctrl+Shift+Esc), and Settings → disable startup / Console mode.
- First-run or enabling Console mode should show a one-time notice: how to restore the taskbar if Portal closes unexpectedly (re-run app, hotkey, or log off).

### Engineering

- Console mode state must be **idempotent** (enable twice, disable twice) and **persist a “last known good” flag** so the next launch calls `disable_console_mode` if the previous session died mid-enable.
- Automated tests cannot fully cover Win32 shell chrome; maintain a **manual HTPC checklist**: single- and dual-monitor, game exclusive fullscreen exit, sleep/resume, Steam overlay, secondary taskbar restore.
- New Rust surface area belongs in one module with unit-tested “save/restore” structs for work area and app bar state.

### Compatibility

- **Multi-monitor:** hiding only the primary taskbar leaves secondary taskbars visible until explicitly handled—call out in release notes for HTPC setups.
- **Exclusive fullscreen games** may bypass Portal focus; rely on game exit + shell hook / user opening guide—not on injecting into the game process.
- **Anti-cheat:** Phase 1 APIs are standard shell/window calls; still avoid hooks and injection (aligned with [Risks](#risks)).

### Operations

- Startup (`Run` / Task Scheduler) is visible in Windows settings; no silent elevation.
- Phase 4 (`Winlogon\Shell`) requires separate installer docs, recovery USB guidance, and support playbooks—out of scope until Phase 1–3 are stable.

---

## Performance goals

| Metric | Target | Notes |
|--------|--------|-------|
| Cold start to library | < 5 s | Measure on target HTPC hardware |
| Input → focus move | < 16 ms | UI thread + nav core |
| Idle memory | < 400 MB | Tauri + webview when browser closed |
| In-game impact | None by default | No game process injection |

---

## Risks

| Risk | Mitigation |
|------|------------|
| Streaming DRM in embedded webviews | Official engines; Edge/WebView2 where required; test per provider |
| Anti-cheat vs overlays/hooks | External orchestration only; no injection |
| Windows focus fights | Centralized focus manager + PID retry (started); expand watchdog |
| Shell replacement bricks desktop | Phase 4 optional; Phase 1 keeps Explorer; document revert |
| False sense of “shell” | ADR and UX copy distinguish app shell vs OS shell |

---

## MVP scope (revised)

### Delivered (MVP+)

- Controller-first library UI
- Multi-platform game detection and launch
- Embedded browser for media/bookmarks
- Fullscreen / borderless chrome
- Streaming catalog add-ons
- Basic session switcher
- IGDB/TMDB metadata

### Next MVP for “shell-like” living room

- ~~Login startup + Console mode (taskbar/tray policy)~~ — **done** (Settings → Console & startup)
- ~~Stronger one-active-experience (focus + switcher)~~ — **done** (Phase 2 watchdog + global switcher hotkey)
- ~~Launch/exit automation profiles (minimal: display + audio)~~ — **done** (Phase 3)

### Explicitly later

- Quick resume / multi-suspend
- Cloud library authority ([docs/CLOUD_LIBRARY_SYNC.md](docs/CLOUD_LIBRARY_SYNC.md))
- ~~Winlogon shell replacement~~ — **done** (optional; see [docs/WINLOGON_SHELL.md](docs/WINLOGON_SHELL.md))
- AI / social / marketplace

---

## Example user flow (target end state)

```text
PC boots → Portal starts (Console mode, taskbar hidden)
    → Controller connects
    → User picks Cyberpunk 2077
    → Portal: automation profile (HDR, monitor 2 off, optional tools)
    → Game launches; Portal minimizes or backgrounds
    → User quits game
    → Portal restores displays/audio → dashboard
```

**Today:** With Phase 4 enabled, boot can land directly in Portal; otherwise open Portal manually or use login startup (HKCU Run). Automation profiles run on game launch/exit when configured.

---

## Superseded planning notes

Early drafts referenced **Atlas**, **C# + Avalonia**, **Kotlin `ProviderPlugin`**, **SDL3**, and **gRPC plugin IPC**. The shipped codebase is **Portal Media** with **Tauri + React + Rust** and zip-based streaming add-ons. Those choices are not wrong for a greenfield rewrite but are **not** this repo’s implementation path unless explicitly revisited.

---

## Final decision (confirmed)

Proceed with:

1. **Portal Media** as the controller-first hub (Tauri + React).
2. **Standalone-first deployment**, evolving toward **MyDockFinder-style desktop chrome substitution** before optional Explorer replacement.
3. **External orchestration** for games and media; add-ons for catalog extensibility.
4. **Reliability and low friction** over OS-level hacks until Phase 1–3 prove stable.

Priority order: **reliability → navigation speed → living-room UX → automation → true Winlogon shell**.
