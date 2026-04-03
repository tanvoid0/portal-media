# Add-ons, plugins, and extensibility

This document describes **today’s** streaming-catalog add-on format, how the app discovers and loads it, and **planned** directions for richer plugin surfaces (streaming, games, apps). It is the canonical reference for authors building new add-ons.

## Terminology

| Term | Meaning |
|------|---------|
| **Streaming catalog add-on** | A zip archive with a root `manifest.json` that configures optional TMDB/library streaming UX (today’s only packaged add-on type). |
| **Plugin (roadmap)** | A broader notion: optional modules that extend launch, metadata, or library sources. Not yet a single loader; see [Games & apps plugins (roadmap)](#games--apps-plugins-roadmap). |
| **Active add-on** | The one manifest the shell **loads at startup** for streaming integration. Only one archive is active today. |

Code and UI sometimes say “plugin” colloquially; this file uses **add-on** for the zip-backed streaming feature to avoid confusion with future Tauri-side plugins.

---

## Streaming catalog add-on (implemented)

### Purpose

An add-on supplies, without rebuilding the app:

- Optional **default library bookmark** (web origin).
- Optional **TMDB title details** action that opens a **hash-router** catalog URL (`#/metadetails/…` or `#/search?…`) derived from `webOrigin` plus TMDB/IMDb data.
- Optional **in-app browser branding** hints (host suffixes, bookmark name fragments, accent color).

The host application remains generic: strings and URLs come from the manifest, not from hard-coded service names in the repo.

### Archive layout

1. **Format**: standard ZIP, deflate-supported (e.g. from Explorer, `Compress-Archive`, `zip`).
2. **Required entry**: exactly one file at archive root named `manifest.json` (no nested folder for that name).
3. **Encoding**: UTF-8 JSON. Avoid a UTF-8 BOM if parsers err on first byte.

### `manifest.json` schema (v1)

All keys use **camelCase** to match serde / frontend IPC.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Stable machine id (e.g. reverse-DNS or slug). Used for logs and future multi-addon keys. |
| `version` | string | yes | Semver or opaque string for support/debugging. |
| `enabled` | boolean | yes | If `false`, the archive is ignored for **load** (listing may still show it as disabled). |
| `displayName` | string | yes | Human-facing label (bookmark name, TMDB action label). |
| `webOrigin` | string | yes | Origin only, no path: `https://example.com`. Trailing `/` is stripped. Used to build hash-router deep links. |
| `icon` | object | yes | `{ "faviconDomain": "example.com" }` — used for Google favicon helper URLs in the UI. |
| `features` | object | yes | `{ "libraryBookmark": boolean, "tmdbStreamButton": boolean }` — toggles bookmark row and TMDB catalog button. |
| `browserBrand` | object | no | Optional tile hints when browsing or matching bookmarks. |

`browserBrand` fields:

| Field | Type | Description |
|-------|------|-------------|
| `hostSuffixes` | string[] | Hostname suffixes (e.g. `example.com`, `foo.bar`) matched after normalizing `www.`. |
| `nameIncludes` | string[] | Lowercase substring checks against bookmark **name**. |
| `accentColor` | string \| null | Optional CSS hex for platform chip (e.g. `#7c6cff`). |

**Deep link contract** (frontend): `webOrigin` must point to a SPA that supports routes of the form:

- `#/metadetails/movie/{imdbId}` / `#/metadetails/series/{imdbId}` when IMDb `tt…` is present.
- `#/search?search={encodedTitle}` as fallback.

If you add a catalog that uses different routes, a future manifest version should expose a **template** or **strategy** field; v1 assumes the above pattern (see `addonMetadetailsDeepLink` in `src/utils/tmdbStreamLinks.ts`).

### Example `manifest.json`

```json
{
  "id": "com.example.streaming-catalog",
  "version": "1.0.0",
  "enabled": true,
  "displayName": "My catalog",
  "webOrigin": "https://catalog.example",
  "icon": { "faviconDomain": "catalog.example" },
  "features": {
    "libraryBookmark": true,
    "tmdbStreamButton": true
  },
  "browserBrand": {
    "hostSuffixes": ["catalog.example", "watch.example"],
    "accentColor": "#5b6cf0",
    "nameIncludes": ["my catalog"]
  }
}
```

### Packaging workflow

1. Create `manifest.json` as above.
2. Zip it so `manifest.json` is at the **root** of the archive (not `dist/manifest.json` unless that is the only root entry you intend — prefer flat root).
3. Name the default archive **`media-stream-addon.zip`** if you rely on default resolution, **or** use any `*.zip` name under the user plugins directory (all are listed; default **load** still prefers `media-stream-addon.zip` per resolution order below).
4. Copy the zip to the user plugins folder (see Settings → Streaming; path shown in UI) or use a saved path / env override.

### Discovery and “active” archive

The backend resolves the **active** zip in this order (first existing file wins):

1. **Saved path** in app settings (`portal_media_streaming_addon_zip_path` in localStorage; **Save** in Settings persists it and reloads the add-on in the current session).
2. Environment variable **`PORTAL_MEDIA_STREAMING_ADDON_ZIP`** (absolute path).
3. **`{resolvedPlugins}/media-stream-addon.zip`** where **`{resolvedPlugins}`** is **app data**  
    `{appData}/com.tanvoid0.portal-media/plugins/` by default, **or** a **custom plugins folder** from settings (`portal_media_streaming_plugins_dir_override` in localStorage; e.g. `portal_media/plugins`).
4. **`{cwd}/plugins/media-stream-addon.zip`** — local dev; repo’s `plugins/` folder may hold zips for team workflows.
5. **`{cwd}/../media-stream-addon.zip`** (legacy).
6. **`{executable_dir}/../media-stream-addon.zip`** (legacy).

**Listing**: command `list_streaming_catalog_addons` dedupes by canonical path and includes **every `*.zip`** under:

- **`{resolvedPlugins}`** (app data or custom folder)
- `{cwd}/plugins/` (if directory exists)

plus the same override/env/legacy paths as above.

### Tauri API

| Command | Role |
|---------|------|
| `load_streaming_addon` | Returns the parsed manifest for the **active** archive, or `null`. Args: `overrideZipPath`, `disabledAddonPaths`, `pluginsDirOverride` (optional; empty = app data `plugins`). |
| `list_streaming_catalog_addons` | Scans candidates; returns path, discovery labels, summary or parse error, `isActive`, `isUserDisabled`. Args: `overrideZipPath`, `previewZipPath`, `disabledAddonPaths`, `pluginsDirOverride` (optional). |
| `streaming_addon_user_plugins_dir` | Ensures the **resolved** plugins dir exists; returns absolute path. Arg: `pluginsDirOverride` (optional). |
| `delete_streaming_addon_zip` | Deletes a zip under resolved plugins folder or `{cwd}/plugins/`. Args: `path`, `pluginsDirOverride` (optional). |

Implementation: `src-tauri/src/streaming_addon.rs`.

### Frontend touchpoints

| Area | Location |
|------|----------|
| Load at startup | `src/stores/streamingAddonStore.ts` → `useGames` |
| TMDB details actions | `src/components/layout/TmdbDetailsContent.tsx` |
| Default bookmarks | `src/utils/defaultBookmarks.ts` |
| Browser / bookmark tiles | `src/components/PlatformLabel.tsx` (`matchStreamingAddonHost` / `Name`) |
| Deep links & favicon helper | `src/utils/tmdbStreamLinks.ts` |
| Settings UI | `src/components/settings/StreamingAddonSettingsSection.tsx`, route `/settings/streaming` |
| TypeScript types | `src/types/streamingAddon.ts` |

### Repository layout

- **`plugins/`** at repo root: optional place to keep add-on zips for development or internal distribution (track in git only if policy allows).

---

## Evolving streaming add-ons

### Versioning

- Today there is **no** `manifestSchemaVersion` field; treat all manifests as **v1** implicit.
- Recommended for future v2: add `"schemaVersion": 2`, keep v1 parsers accepting missing field as `1`.

### Multiple simultaneous streaming add-ons

- **Current behavior**: one **active** manifest drives bookmark + TMDB button + store state.
- **Future options**: merge multiple manifests (Union of features with conflict rules), or “primary” + “secondary” actions in TMDB UI. Would require IPC and store shape changes; coordinate in a design note before implementing.

### Security & privacy

- Add-ons are **data files**, not sandboxed code. Only load zips from trusted paths.
- Manifests may reference external origins; CSP/network behavior is still that of the embedded browser.

---

## Games & apps plugins (roadmap)

Nothing in this section is implemented as a generic plugin host yet. It records **intended surfaces** so new work aligns with a common model.

### Goals

| Surface | Games | Apps / media bookmarks |
|---------|-------|-------------------------|
| **Launch** | Pre/post hooks, wrapper args, compatibility shims | URL schemes, containerized web apps (future) |
| **Metadata** | Extra fields, artwork providers, achievement links | N/A or minimal |
| **Library source** | Store APIs, manual CSV/importers | Bookmark providers |

### Suggested plugin “capabilities” (future)

Express each extension as a small manifest (JSON or TOML) declaring **capabilities**:

- `library.source` — contributes rows to SQLite / library cache.
- `metadata.provider` — keyed fetch for a `Game` id (today: IGDB/TMDB only).
- `launch.hook` — optional command run before/after `launch_game` (with user consent).
- `streaming.catalog` — **today’s zip manifest** is the first instance of this class.

A future **plugin registry** might live under `{appData}/plugins/manifests/` with typed subfolders, while streaming remains zip-backed for backward compatibility.

### Implementation notes (when picking this up)

1. Prefer **Tauri commands + explicit IPC** over dynamic scripting in the WebView.
2. Keep **secrets** in existing keyring / app-support patterns (`metadata/secrets.rs`).
3. Add **Settings** sections per capability family (parallel to **Streaming**).
4. Document each new command in this file or a sibling `docs/PLUGINS_<DOMAIN>.md` if the file grows too large.

---

## Related files

| File | Purpose |
|------|---------|
| `src-tauri/src/streaming_addon.rs` | Zip IO, manifest types, discovery, IPC |
| `src-tauri/src/lib.rs` | Command registration |
| `docs/PLUGINS.md` | This document |

For cloud library sync ideas, see [CLOUD_LIBRARY_SYNC.md](./CLOUD_LIBRARY_SYNC.md).
