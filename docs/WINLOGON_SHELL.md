# Windows shell replacement (Phase 4)

Portal Media can optionally replace `explorer.exe` as the Windows logon shell by setting:

```text
HKLM\Software\Microsoft\Windows NT\CurrentVersion\Winlogon
  Shell = <full path to portal-media.exe>
```

This is **optional** and **advanced**. Phases 1–3 (Console mode, global hotkeys, automation) work without changing Winlogon.

## Before you enable

1. Confirm Phases 1–3 behave well on your HTPC (taskbar hide, game exit → Portal, automation restore).
2. Enable **Console mode** in Settings → Console & startup.
3. Note your Portal install path (shown in Settings when supported).
4. You will see a **UAC** prompt — administrator rights are required to write `HKLM`.

After enabling, **sign out or restart** Windows. The next logon starts Portal instead of the desktop.

## What Portal does at logon

- Runs as the Winlogon shell (parent process is `winlogon.exe`).
- Starts `explorer.exe` in the background if it is not already running (system tray / shell services).
- Applies Console mode defaults for that session (taskbar hide, Big Picture fullscreen).

## Automatic recovery on exit

When Portal started as the Windows logon shell, closing the app (Exit, window close, or crash after a prior Console mode session) now:

1. Restores the taskbar and desktop chrome (Console mode).
2. Starts `explorer.exe` and reopens the desktop shell.
3. Schedules **Revert to Explorer on next Portal start** so the next launch can restore `explorer.exe` in the registry (UAC).

In **development** (`tauri dev`), if `http://127.0.0.1:1420` is not reachable within a few seconds, the same recovery runs automatically so a failed dev server does not leave a blank desktop.

Manual recovery from a running session: Settings → Console & startup, or Task Manager → Run → `explorer.exe`. Emergency: `portal-media.exe --revert-winlogon-shell`.

## Revert on next Portal start (recovery flag)

If the desktop does not appear or you cannot reach Settings:

1. **Settings → Console & startup → Revert to Explorer on next Portal start** (when Portal still opens), **or**
2. From Task Manager → Run:
   ```text
   "C:\path\to\portal-media.exe" --revert-winlogon-shell
   ```
3. Approve **UAC** when prompted.
4. Portal restores `Shell` to Explorer (usually `explorer.exe`) on that launch.
5. **Sign out or restart** for a normal desktop.

## Disable / revert

**Preferred (while Windows still boots normally):**

1. Open Portal (from Task Manager → Run, another user session, or Safe Mode with networking).
2. Settings → Console & startup → turn off **Use Portal as Windows shell**.
3. Approve UAC. Sign out or restart.

Portal restores the backed-up `Shell` value (usually `explorer.exe`).

**Registry (Safe Mode or recovery):**

1. Boot into **Safe Mode** (hold Shift while choosing Restart → Troubleshoot → Advanced → Startup Settings).
2. Open Registry Editor (`regedit`).
3. Navigate to `HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon`.
4. Set `Shell` to `explorer.exe`.
5. Restart.

**Emergency desktop:**

- `Ctrl+Shift+Esc` — Task Manager → File → Run → `explorer.exe`
- `Ctrl+Shift+Q` — restores taskbar / Console mode chrome when Portal is running

## Backup file

Before the first enable, Portal saves the previous `Shell` value under:

```text
%APPDATA%\com.tauri.dev\   (or your app identifier)\winlogon_shell_backup.json
```

Disable uses this backup when present.

## Support checklist

- [ ] Single-monitor: sign out → Portal starts at logon
- [ ] Dual-monitor: secondary taskbar handled by Console mode
- [ ] Disable shell → `explorer.exe` returns after sign out
- [ ] Safe Mode revert documented for your household

## Product positioning

Until you opt in, Portal is a **standalone app** with Console mode — not a Windows shell replacement. See [ADR.md](../ADR.md).
