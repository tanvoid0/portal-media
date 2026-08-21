import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  effectiveStreamingPluginsDir,
  getDisabledStreamingAddonPaths,
  getStreamingAddonZipPath,
  getStreamingPluginsDirOverride,
  setStreamingAddonPathDisabled,
  setStreamingPluginsDirOverride,
  setStreamingAddonZipPath,
} from "@/utils/streamingAddonPrefs";
import type { StreamingAddonListEntry } from "@/types/streamingAddon";
import { cn } from "@/lib/utils";
import { useStreamingAddonStore } from "@/stores/streamingAddonStore";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  FolderOpen,
  PackageOpen,
  Power,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { formatDisplayPath } from "@/utils/formatDisplayPath";
import { formatDiscoverySourcesLine } from "@/utils/streamingAddonDiscoveryUi";

export function StreamingAddonSettingsSection({ embedded = false }: { embedded?: boolean }) {
  const [pluginsDir, setPluginsDir] = useState(() => getStreamingPluginsDirOverride() ?? "");
  const [zipPath, setZipPath] = useState(() => getStreamingAddonZipPath() ?? "");
  const [busy, setBusy] = useState(false);
  const [listBusy, setListBusy] = useState(true);
  const [entries, setEntries] = useState<StreamingAddonListEntry[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [userPluginsDir, setUserPluginsDir] = useState<string | null>(null);

  useEffect(() => {
    const pd =
      effectiveStreamingPluginsDir(pluginsDir, getStreamingPluginsDirOverride()) ?? null;
    void invoke<string>("streaming_addon_user_plugins_dir", { pluginsDirOverride: pd })
      .then(setUserPluginsDir)
      .catch(() => setUserPluginsDir(null));
  }, [pluginsDir]);

  const reloadActiveManifest = useCallback(() => useStreamingAddonStore.getState().load(), []);

  const refreshList = useCallback(async () => {
    setListBusy(true);
    setListError(null);
    try {
      const saved = getStreamingAddonZipPath();
      const disabled = getDisabledStreamingAddonPaths();
      const pd =
        effectiveStreamingPluginsDir(pluginsDir, getStreamingPluginsDirOverride()) ?? null;
      const rows = await invoke<StreamingAddonListEntry[]>("list_streaming_catalog_addons", {
        overrideZipPath: saved ?? null,
        previewZipPath: zipPath.trim() || null,
        disabledAddonPaths: disabled.length ? disabled : null,
        pluginsDirOverride: pd,
      });
      setEntries(rows);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Could not scan add-ons");
      setEntries([]);
    } finally {
      setListBusy(false);
    }
  }, [zipPath, pluginsDir]);

  useEffect(() => {
    const t = window.setTimeout(() => void refreshList(), 350);
    return () => window.clearTimeout(t);
  }, [refreshList]);

  const pickZip = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "Archive", extensions: ["zip"] }],
        title: "Choose media-stream-addon.zip",
      });
      const path = typeof selected === "string" ? selected : null;
      if (path) setZipPath(path);
    } catch {
      /* dialog cancelled or error */
    }
  };

  const pickPluginsFolder = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: true,
        title: "Choose folder for streaming add-on zips",
      });
      const path = typeof selected === "string" ? selected : null;
      if (path) setPluginsDir(path);
    } catch {
      /* dialog cancelled or error */
    }
  };

  const saveStreamingPrefs = async () => {
    setBusy(true);
    try {
      setStreamingPluginsDirOverride(pluginsDir.trim() || null);
      setStreamingAddonZipPath(zipPath.trim() || null);
      await refreshList();
      await reloadActiveManifest();
      toast.success("Streaming add-on settings saved");
    } finally {
      setBusy(false);
    }
  };

  const clearZipOverride = async () => {
    setBusy(true);
    try {
      setStreamingAddonZipPath(null);
      setZipPath("");
      await refreshList();
      await reloadActiveManifest();
      toast.success("Zip override cleared");
    } finally {
      setBusy(false);
    }
  };

  const restartApplication = async () => {
    try {
      await relaunch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not restart the app");
    }
  };

  const toggleAddonDisabled = async (archivePath: string, nextDisabled: boolean) => {
    setStreamingAddonPathDisabled(archivePath, nextDisabled);
    await refreshList();
    await reloadActiveManifest();
  };

  const deleteAddonZip = async (archivePath: string) => {
    const ok = globalThis.confirm(
      "Delete this add-on archive from disk? This cannot be undone."
    );
    if (!ok) return;
    setListError(null);
    try {
      await invoke("delete_streaming_addon_zip", {
        path: archivePath,
        pluginsDirOverride: getStreamingPluginsDirOverride()?.trim() || null,
      });
      setStreamingAddonPathDisabled(archivePath, false);
      await refreshList();
      await reloadActiveManifest();
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Could not delete archive");
    }
  };

  const showAddonInFolder = async (archivePath: string) => {
    try {
      await revealItemInDir(archivePath);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Could not open file location");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        {!embedded && (
          <h3 className="flex items-center gap-2 text-xl font-semibold text-foreground">
            <PackageOpen className="h-5 w-5 shrink-0" aria-hidden />
            Streaming catalog add-ons
          </h3>
        )}
        <p className={cn("text-xs leading-relaxed text-muted-foreground", !embedded && "mt-1")}>
          Zips need <span className="text-foreground">manifest.json</span> at the root. Folder scans for{" "}
          <span className="font-mono text-xs">*.zip</span>; optional path picks one archive.{" "}
          <span>Save applies without restart.</span> Env{" "}
          <span className="font-mono text-xs">PORTAL_MEDIA_STREAMING_ADDON_ZIP</span> is also honored.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Resolved folder{pluginsDir.trim() ? " (override)" : ""}:
        </p>
        {userPluginsDir ? (
          <p className="break-all font-mono text-xs leading-relaxed text-muted-foreground" title={userPluginsDir}>
            {formatDisplayPath(userPluginsDir)}
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label>Plugins folder</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={pluginsDir}
            onChange={(e) => setPluginsDir(e.target.value)}
            placeholder="Empty = app data plugins (see path above)"
            className="flex-1"
            spellCheck={false}
          />
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 rounded-none"
            onClick={() => void pickPluginsFolder()}
            disabled={busy}
          >
            Browse…
          </Button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Add-on zip (optional override)</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={zipPath}
            onChange={(e) => setZipPath(e.target.value)}
            placeholder="No custom path (auto-detect)"
            className="flex-1"
            spellCheck={false}
          />
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 rounded-none"
            onClick={() => void pickZip()}
            disabled={busy}
          >
            Browse…
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="rounded-none" onClick={() => void saveStreamingPrefs()} disabled={busy}>
          Save
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-none"
          onClick={() => void clearZipOverride()}
          disabled={busy}
        >
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
          Clear zip override
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-none"
          onClick={() => void restartApplication()}
          disabled={busy}
          title="Full process restart. Can conflict with tauri dev on Windows if the exe is locked."
        >
          Restart app
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="rounded-none"
          onClick={() => void refreshList()}
          disabled={busy || listBusy}
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", listBusy && "animate-spin")} aria-hidden />
          Refresh list
        </Button>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-foreground">Archives</h4>
        <p className="text-xs text-muted-foreground">
          Turn off skips an archive without deleting it. Edit <span className="font-mono">manifest.json</span>{" "}
          inside the zip, then refresh.
        </p>
        {listError ? (
          <div className="flex items-center gap-2 rounded-none border border-destructive/40 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
            {listError}
          </div>
        ) : null}
        {listBusy && !listError ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Scanning for add-on archives…
          </p>
        ) : null}
        {!listError && !listBusy && entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No zips found. Add one under the resolved folder, set a zip override, or use the env variable.
          </p>
        ) : null}
        <ul className="max-h-80 space-y-3 overflow-y-auto pr-1">
          {entries.map((entry) => {
            const displayPath = formatDisplayPath(entry.path);
            const discoveryLine = formatDiscoverySourcesLine(entry.discoverySources);
            return (
              <li
                key={entry.path}
                className={cn(
                  "flex flex-col gap-3 rounded-none border p-4 text-sm",
                  entry.isActive
                    ? "border-[3px] border-primary"
                    : "border-border",
                  entry.isUserDisabled && !entry.isActive && "opacity-70"
                )}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  {entry.isActive ? (
                    <span className="inline-flex items-center gap-1 border-2 border-primary px-2 py-0.5 text-xs font-medium text-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      Active
                    </span>
                  ) : entry.isUserDisabled ? (
                    <span className="inline-flex items-center gap-1 border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      <Power className="h-3.5 w-3.5" aria-hidden />
                      Off in app
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Not selected</span>
                  )}
                  {entry.summary ? (
                    <>
                      <span className="font-medium text-foreground">{entry.summary.displayName}</span>
                      <span className="text-xs text-muted-foreground sm:text-sm">
                        v{entry.summary.version} · <span className="font-mono text-xs">{entry.summary.id}</span>
                      </span>
                      {!entry.summary.enabled ? (
                        <span className="text-xs text-muted-foreground">Disabled in manifest</span>
                      ) : null}
                    </>
                  ) : null}
                </div>
                <div className="rounded-none border border-border bg-background px-3 py-2.5">
                  <p className="break-all font-mono text-xs leading-relaxed text-muted-foreground" title={entry.path}>
                    {displayPath}
                  </p>
                </div>
                {discoveryLine ? (
                  <p className="text-xs leading-snug text-muted-foreground">{discoveryLine}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Switch
                    label="Enabled"
                    checked={!entry.isUserDisabled}
                    disabled={busy || listBusy}
                    aria-label={
                      entry.isUserDisabled
                        ? "Enable add-on — allow this archive when choosing the active catalog"
                        : "Disable add-on — exclude this archive without deleting the file"
                    }
                    onChange={() => void toggleAddonDisabled(entry.path, !entry.isUserDisabled)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-none"
                      disabled={busy || listBusy}
                      onClick={() => void showAddonInFolder(entry.path)}
                    >
                      <FolderOpen className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Show in folder
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-none text-destructive hover:text-destructive"
                      disabled={busy || listBusy}
                      onClick={() => void deleteAddonZip(entry.path)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Delete
                    </Button>
                  </div>
                </div>
                {entry.summary ? (
                  <div className="mt-0.5 space-y-2.5 border-t border-border pt-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                      <span className="shrink-0 text-xs font-hub tracking-wide text-muted-foreground">
                        {entry.summary.launchExecutable ? "App" : "Origin"}
                      </span>
                      <span className="break-all text-xs leading-snug text-muted-foreground">
                        {entry.summary.launchExecutable || entry.summary.webOrigin}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {entry.summary.libraryBookmark ? (
                        <span className="border border-border px-2 py-1 text-xs text-foreground">Bookmark</span>
                      ) : null}
                      {entry.summary.tmdbStreamButton ? (
                        <span className="border border-border px-2 py-1 text-xs text-foreground">TMDB button</span>
                      ) : null}
                      {entry.summary.browserBrandRuleCount > 0 ? (
                        <span className="border border-border px-2 py-1 text-xs text-foreground">
                          {entry.summary.browserBrandRuleCount} brand rules
                        </span>
                      ) : null}
                      <span className="border border-border px-2 py-1 text-xs text-foreground">
                        Favicon · {entry.summary.iconFaviconDomain}
                      </span>
                    </div>
                  </div>
                ) : null}
                {entry.error ? (
                  <div className="flex items-start gap-1.5 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    {entry.error}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
