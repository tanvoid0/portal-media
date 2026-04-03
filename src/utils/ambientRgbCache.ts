type Rgb = { r: number; g: number; b: number };

const LS_PREFIX = "portal_media.ambient.v1.";
const MAX_MEMORY_ENTRIES = 96;

/** FNV-1a 32-bit — short, stable keys for localStorage (avoid huge data: URLs as keys). */
function fnv1aKey(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${input.length}x${(h >>> 0).toString(16)}`;
}

const memory = new Map<string, Rgb | null>();

function touch(key: string) {
  const v = memory.get(key);
  if (!memory.has(key)) return;
  memory.delete(key);
  memory.set(key, v as Rgb | null);
}

function evictOldest() {
  const first = memory.keys().next().value;
  if (first !== undefined) memory.delete(first);
}

/**
 * `undefined` = not cached yet; `Rgb` = cached successful sample (memory or localStorage).
 */
export function getCachedAmbientRgb(imageSrc: string): Rgb | null | undefined {
  const key = fnv1aKey(imageSrc);
  if (memory.has(key)) {
    const v = memory.get(key)!;
    touch(key);
    return v;
  }
  if (typeof localStorage === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return undefined;
    const parts = raw.split(",").map((x) => parseInt(x, 10));
    if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
      localStorage.removeItem(LS_PREFIX + key);
      return undefined;
    }
    const rgb: Rgb = { r: parts[0], g: parts[1], b: parts[2] };
    memory.set(key, rgb);
    while (memory.size > MAX_MEMORY_ENTRIES) evictOldest();
    return rgb;
  } catch {
    return undefined;
  }
}

export function setCachedAmbientRgb(imageSrc: string, rgb: Rgb | null) {
  const key = fnv1aKey(imageSrc);
  memory.delete(key);
  // Don't cache failures — WebView/CORS ordering can fail once then succeed; caching `null` blocked retries.
  if (!rgb) return;

  memory.set(key, rgb);
  while (memory.size > MAX_MEMORY_ENTRIES) evictOldest();

  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(LS_PREFIX + key, `${rgb.r},${rgb.g},${rgb.b}`);
    } catch {
      // quota or private mode — memory cache still helps this session
    }
  }
}
