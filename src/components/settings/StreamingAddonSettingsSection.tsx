import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  /** Persists paths and reloads the active manifest — no process restart (Rust reads prefs on each invoke). */
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

  /** Full restart can race `tauri dev` on Windows (exe file lock during Rust relink). Prefer Save above. */
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
    <div
      className={cn(
        "space-y-4",
        !embedded && "glass rounded-xl p-6 border border-white/5"
      )}
    >
      <div>
        {!embedded && (
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <PackageOpen className="w-5 h-5 text-white/80 shrink-0" aria-hidden />
            Streaming catalog add-ons
          </h3>
        )}
        <p className={cn("text-white/50 text-xs leading-relaxed", !embedded ? "mt-1" : "")}>
          Zips need <span className="text-white/70">manifest.json</span> at the root. Folder scans for{" "}
          <span className="font-mono text-[11px] text-white/60">*.zip</span>; optional path picks one archive.{" "}
          <span className="text-white/45">Save applies without restart.</span> Env{" "}
          <span className="font-mono text-[10px] text-white/55">PORTAL_MEDIA_STREAMING_ADDON_ZIP</span> is also honored.
        </p>
        <p className="text-[11px] text-white/45 mt-2">
          Resolved folder{pluginsDir.trim() ? " (override)" : ""}:
        </p>
        {userPluginsDir && (
          <p
            className="text-[11px] text-white/45 font-mono break-all leading-relaxed"
            title={userPluginsDir}
          >
            {formatDisplayPath(userPluginsDir)}
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-white/70">Plugins folder</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={pluginsDir}
            onChange={(e) => setPluginsDir(e.target.value)}
            placeholder="Empty = app data plugins (see path above)"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/35 flex-1"
            spellCheck={false}
          />
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 text-foreground"
            onClick={() => void pickPluginsFolder()}
            disabled={busy}
          >
            Browse…
          </Button>
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-white/70">Add-on zip (optional override)</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={zipPath}
            onChange={(e) => setZipPath(e.target.value)}
            placeholder="No custom path (auto-detect)"
            className="bg-white/5 border-white/10 text-white placeholder:text-white/35 flex-1"
            spellCheck={false}
          />
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 text-foreground"
            onClick={() => void pickZip()}
            disabled={busy}
          >
            Browse…
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => void saveStreamingPrefs()}
          disabled={busy}
        >
          Save
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-white/20 text-white hover:bg-white/10"
          onClick={() => void clearZipOverride()}
          disabled={busy}
        >
          <RotateCcw className="w-4 h-4 mr-2" aria-hidden />
          Clear zip override
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-white/20 text-white hover:bg-white/10"
          onClick={() => void restartApplication()}
          disabled={busy}
          title="Full process restart. Can conflict with tauri dev on Windows if the exe is locked."
        >
          Restart app
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="text-white/80 hover:text-white hover:bg-white/10"
          onClick={() => void refreshList()}
          disabled={busy || listBusy}
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", listBusy && "animate-spin")} aria-hidden />
          Refresh list
        </Button>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-white/90">Archives</h4>
        <p className="text-[11px] text-white/45">
          Turn off skips an archive without deleting it. Edit <span className="font-mono text-white/55">manifest.json</span>{" "}
          inside the zip, then refresh.
        </p>
        {listError && (
          <div className="flex items-center gap-2 text-sm text-amber-300 bg-amber-400/10 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden />
            {listError}
          </div>
        )}
        {listBusy && !listError && (
          <p className="text-white/50 text-sm flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Scanning for add-on archives…
          </p>
        )}
        {!listError && !listBusy && entries.length === 0 && (
          <p className="text-white/45 text-xs">
            No zips found. Add one under the resolved folder, set a zip override, or use the env variable.
          </p>
        )}
        <ul className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {entries.map((entry) => {
            const displayPath = formatDisplayPath(entry.path);
            const discoveryLine = formatDiscoverySourcesLine(entry.discoverySources);
            return (
            <li
              key={entry.path}
              className={cn(
                "rounded-xl border p-4 text-sm flex flex-col gap-3",
                entry.isActive
                  ? "border-emerald-500/40 bg-emerald-500/[0.08]"
                  : entry.isUserDisabled
                    ? "border-amber-500/35 bg-amber-500/[0.06]"
                    : "border-white/10 bg-white/[0.03]"
              )}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                {entry.isActive ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/25 text-emerald-100 px-2 py-0.5 text-xs font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
                    Active
                  </span>
                ) : entry.isUserDisabled ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 text-amber-100/95 px-2 py-0.5 text-xs font-medium">
                    <Power className="w-3.5 h-3.5" aria-hidden />
                    Off in app
                  </span>
                ) : (
                  <span className="text-xs text-white/45">Not selected</span>
                )}
                {entry.summary && (
                  <>
                    <span className="font-medium text-white">{entry.summary.displayName}</span>
                    <span className="text-white/45 text-xs sm:text-sm">
                      v{entry.summary.version} · <span className="font-mono text-[11px]">{entry.summary.id}</span>
                    </span>
                    {!entry.summary.enabled && (
                      <span className="text-xs text-amber-300/90">Disabled in manifest</span>
                    )}
                  </>
                )}
              </div>
              <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2.5">
                <p
                  className="font-mono text-xs text-white/70 break-all leading-relaxed"
                  title={entry.path}
                >
                  {displayPath}
                </p>
              </div>
              {discoveryLine ? (
                <p className="text-[11px] text-white/45 leading-snug">{discoveryLine}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-3 min-h-8">
                  <span className="text-sm font-medium text-white/90">Enabled</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!entry.isUserDisabled}
                    aria-label={
                      entry.isUserDisabled
                        ? "Enable add-on — allow this archive when choosing the active catalog"
                        : "Disable add-on — exclude this archive without deleting the file"
                    }
                    disabled={busy || listBusy}
                    onClick={() => void toggleAddonDisabled(entry.path, !entry.isUserDisabled)}
                    className={cn(
                      "relative h-8 w-14 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      !entry.isUserDisabled ? "bg-primary" : "bg-white/20"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ease-out",
                        !entry.isUserDisabled ? "translate-x-6" : "translate-x-0"
                      )}
                      aria-hidden
                    />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 border-white/15 text-white/85 hover:bg-white/10"
                  disabled={busy || listBusy}
                  onClick={() => void showAddonInFolder(entry.path)}
                >
                  <FolderOpen className="w-3.5 h-3.5 mr-1.5" aria-hidden />
                  Show in folder
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 border-red-400/35 text-red-200/95 hover:bg-red-500/15"
                  disabled={busy || listBusy}
                  onClick={() => void deleteAddonZip(entry.path)}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" aria-hidden />
                  Delete
                </Button>
                </div>
              </div>
              {entry.summary && (
                <div className="border-t border-white/10 pt-3 mt-0.5 space-y-2.5">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                    <span className="text-[10px] uppercase tracking-wider text-white/40 shrink-0">Origin</span>
                    <span className="text-xs text-white/70 break-all leading-snug">{entry.summary.webOrigin}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {entry.summary.libraryBookmark && (
                      <span className="rounded-md bg-white/10 px-2 py-1 text-[11px] text-white/85">Bookmark</span>
                    )}
                    {entry.summary.tmdbStreamButton && (
                      <span className="rounded-md bg-white/10 px-2 py-1 text-[11px] text-white/85">TMDB button</span>
                    )}
                    {entry.summary.browserBrandRuleCount > 0 && (
                      <span className="rounded-md bg-white/10 px-2 py-1 text-[11px] text-white/85">
                        {entry.summary.browserBrandRuleCount} brand rules
                      </span>
                    )}
                    <span className="rounded-md bg-white/10 px-2 py-1 text-[11px] text-white/85">
                      Favicon · {entry.summary.iconFaviconDomain}
                    </span>
                  </div>
                </div>
              )}
              {entry.error && (
                <div className="flex items-start gap-1.5 text-xs text-amber-200/90">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
                  {entry.error}
                </div>
              )}
            </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
