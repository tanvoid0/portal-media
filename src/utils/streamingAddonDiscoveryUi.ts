const EXACT: Record<string, string> = {
  "Path in settings field (save in Settings to persist)": "Preview field",
  "Saved settings path": "Saved path",
  "Environment PORTAL_MEDIA_STREAMING_ADDON_ZIP": "Environment variable",
};

const DIR_PREFIX = /^(Custom plugins folder|App data \(plugins folder\)|Project plugins\/) · (.+)$/;

function shortenOne(raw: string): string {
  if (EXACT[raw]) return EXACT[raw];
  const dir = raw.match(DIR_PREFIX);
  if (dir) {
    const loc =
      dir[1] === "Custom plugins folder"
        ? "Custom folder"
        : dir[1] === "App data (plugins folder)"
          ? "App data"
          : "Project plugins";
    return `${loc}: ${dir[2]}`;
  }
  if (raw.startsWith("media-stream-addon.zip next to working-directory parent")) {
    return "Next to cwd parent";
  }
  if (raw.startsWith("media-stream-addon.zip next to executable")) {
    return "Next to app";
  }
  return raw;
}

/** One readable line for “where this zip was found”, without long Rust strings. */
export function formatDiscoverySourcesLine(sources: string[]): string {
  if (sources.length === 0) return "";
  const short = sources.map(shortenOne);
  const uniq = [...new Set(short)];
  const hasPreview = uniq.includes("Preview field");
  const hasSaved = uniq.includes("Saved path");
  if (hasPreview && hasSaved) {
    const rest = uniq.filter((s) => s !== "Preview field" && s !== "Saved path");
    return ["Settings path", ...rest].join(" · ");
  }
  return uniq.join(" · ");
}
