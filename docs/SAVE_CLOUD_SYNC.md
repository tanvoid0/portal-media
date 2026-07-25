# Save cloud sync (Google Drive)

Portal Media can back up **local save folders** to the signed-in user’s Google Drive using OAuth 2.0 (PKCE) and a smart merge similar to console cloud saves.

## Setup

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → create **OAuth client ID** → type **Desktop app**.
2. Enable **Google Drive API** for the project.
3. Add authorized redirect URI: `http://127.0.0.1:38476/oauth/callback`
4. In Portal → **Settings → Library & sync → Save cloud sync**, paste the Client ID and **Sign in with Google**.

Optional: set environment variable `PORTAL_GOOGLE_OAUTH_CLIENT_ID` instead of saving the ID in settings.

## What gets synced

Discovery scans (when possible):

- Steam `userdata/<steamid>/<appid>/remote`
- `Documents/My Games/<title>/`
- Install-folder `Saved`, `SaveGames`, `saves`, etc.

Each location becomes a **bundle** (zipped on upload). A manifest in Drive tracks checksums and timestamps.

## Smart sync (PS5-style)

On each sync, Portal compares **local**, **cloud**, and **last-sync baseline**:

| Situation | Action |
|-----------|--------|
| Only local | Upload |
| Only cloud | Download (if path exists locally) |
| Same checksum | Skip |
| Only one side changed since baseline | Sync the changed side |
| Both changed | **Auto newer**: keep file with later `modified` time; **Ask**: show conflict UI |

Tokens are stored in the OS credential store (with app-data fallback), same pattern as metadata API keys.

## Drive layout

```
Portal Media Saves/
  portal_save_manifest.json
  saves/
    <bundle_id>.zip
```

Scope: `https://www.googleapis.com/auth/drive.file` (files created/opened by this app only).

## Save data explorer

Browse local save folders (separate from cloud upload):

- **Settings → Save data** — all games, grouped list with search
- **Settings → Library & sync** — **Save data explorer** button
- **Game details** — **Save data** section per title; **View all** opens `/game/<id>/saves`

Each list item supports **Open folder** (File Explorer) and **Game** (jump to details).
