import { convertFileSrc, isTauri } from "@tauri-apps/api/core";

/**
 * Validates if a string is a valid URL or data URI
 */
export function isValidImageSource(src: string | undefined | null): boolean {
  if (!src) return false;

  if (src.startsWith("data:")) {
    return true;
  }

  try {
    const url = new URL(src);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    // fall through
  }

  if (isProbablyLocalAssetPath(src)) {
    return true;
  }

  return false;
}

function isProbablyLocalAssetPath(s: string): boolean {
  if (!s || s.includes("\0")) return false;
  // Windows absolute file path (cached library icons)
  if (/^[a-zA-Z]:[\\/]/.test(s)) return true;
  if (s.startsWith("\\\\")) return true;
  // Unix absolute path
  if (s.startsWith("/") && !s.startsWith("//")) return true;
  return false;
}

/**
 * Gets a safe image source, falling back to a placeholder if invalid
 */
export function getSafeImageSource(src: string | undefined | null): string {
  if (!src) {
    return placeholder();
  }

  if (src.startsWith("data:")) {
    return src;
  }

  try {
    const url = new URL(src);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return src;
    }
  } catch {
    // not a URL
  }

  if (isProbablyLocalAssetPath(src)) {
    if (isTauri()) {
      return convertFileSrc(src);
    }
  }

  return placeholder();
}

function placeholder(): string {
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='600'%3E%3Crect fill='%231e293b' width='400' height='600'/%3E%3Ctext fill='%23647591' font-family='sans-serif' font-size='20' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3ENo Cover%3C/text%3E%3C/svg%3E";
}
