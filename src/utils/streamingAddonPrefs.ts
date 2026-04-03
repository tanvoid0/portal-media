const STORAGE_KEY = "portal_media_streaming_addon_zip_path";
const DISABLED_PATHS_KEY = "portal_media_streaming_addon_disabled_paths";
const PLUGINS_DIR_OVERRIDE_KEY = "portal_media_streaming_plugins_dir_override";

/** Folder used for default zip discovery and for scanning `*.zip` add-ons (replaces app-data `plugins` when set). */
export function effectiveStreamingPluginsDir(
  fieldValue: string,
  saved: string | null
): string | null {
  const fromField = fieldValue.trim();
  if (fromField) return fromField;
  const fromSaved = saved?.trim();
  return fromSaved || null;
}

export function getStreamingPluginsDirOverride(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(PLUGINS_DIR_OVERRIDE_KEY)?.trim();
    return v || null;
  } catch {
    return null;
  }
}

export function setStreamingPluginsDirOverride(path: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!path?.trim()) localStorage.removeItem(PLUGINS_DIR_OVERRIDE_KEY);
    else localStorage.setItem(PLUGINS_DIR_OVERRIDE_KEY, path.trim());
  } catch {
    // ignore
  }
}

export function getStreamingAddonZipPath(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY)?.trim();
    return v || null;
  } catch {
    return null;
  }
}

export function setStreamingAddonZipPath(path: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!path?.trim()) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, path.trim());
  } catch {
    // ignore
  }
}

export function getDisabledStreamingAddonPaths(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DISABLED_PATHS_KEY);
    if (!raw?.trim()) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  } catch {
    return [];
  }
}

export function setDisabledStreamingAddonPaths(paths: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const next = [...new Set(paths.map((p) => p.trim()).filter(Boolean))];
    if (next.length === 0) localStorage.removeItem(DISABLED_PATHS_KEY);
    else localStorage.setItem(DISABLED_PATHS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

/** Toggle whether a resolved archive path is skipped when choosing the active add-on (matches list row `path`). */
export function setStreamingAddonPathDisabled(archivePath: string, disabled: boolean): void {
  const key = archivePath.trim();
  if (!key) return;
  const cur = getDisabledStreamingAddonPaths();
  const set = new Set(cur);
  if (disabled) set.add(key);
  else set.delete(key);
  setDisabledStreamingAddonPaths([...set]);
}
