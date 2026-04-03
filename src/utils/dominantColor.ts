import { getCachedAmbientRgb, setCachedAmbientRgb } from "@/utils/ambientRgbCache";

export type Rgb = { r: number; g: number; b: number };

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function weightedVibrantFromImageData(data: Uint8ClampedArray): Rgb | null {
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let wSum = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
    if (l < 0.1 || l > 0.96 || s < 0.12) continue;
    const w = s * s * (1 - Math.abs(l - 0.42));
    rSum += data[i] * w;
    gSum += data[i + 1] * w;
    bSum += data[i + 2] * w;
    wSum += w;
  }

  if (wSum < 1e-4) {
    let tr = 0;
    let tg = 0;
    let tb = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      tr += data[i];
      tg += data[i + 1];
      tb += data[i + 2];
      n += 1;
    }
    if (n === 0) return null;
    return { r: clampByte(tr / n), g: clampByte(tg / n), b: clampByte(tb / n) };
  }

  return {
    r: clampByte(rSum / wSum),
    g: clampByte(gSum / wSum),
    b: clampByte(bSum / wSum),
  };
}

function loadImage(src: string, crossOriginForRemote: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOriginForRemote && (src.startsWith("http://") || src.startsWith("https://"))) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

async function extractFromImageSource(src: string, crossOriginForRemote: boolean): Promise<Rgb | null> {
  try {
    const img = await loadImage(src, crossOriginForRemote);
    const nw = img.naturalWidth || img.width;
    const nh = img.naturalHeight || img.height;
    if (nw < 1 || nh < 1) return null;

    const maxSide = 72;
    const scale = Math.min(1, maxSide / Math.max(nw, nh));
    const w = Math.max(1, Math.round(nw * scale));
    const h = Math.max(1, Math.round(nh * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    return weightedVibrantFromImageData(imageData.data);
  } catch {
    return null;
  }
}

async function fetchImageAsDataUrlViaTauri(url: string): Promise<string | null> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<string>("fetch_image_as_data_url", { url });
  } catch {
    return null;
  }
}

/**
 * Parses #RGB / #RRGGBB into RGB (for brand fallbacks).
 */
export function hexToRgb(hex: string): Rgb | null {
  const h = hex.trim();
  const m6 = /^#?([0-9a-f]{6})$/i.exec(h);
  if (m6) {
    const n = parseInt(m6[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const m3 = /^#?([0-9a-f]{3})$/i.exec(h);
  if (m3) {
    const s = m3[1];
    return {
      r: parseInt(s[0] + s[0], 16),
      g: parseInt(s[1] + s[1], 16),
      b: parseInt(s[2] + s[2], 16),
    };
  }
  return null;
}

async function extractVibrantDominantColorUncached(src: string): Promise<Rgb | null> {
  const isRemote = src.startsWith("http://") || src.startsWith("https://");

  if (src.startsWith("data:")) {
    return extractFromImageSource(src, false);
  }

  if (isRemote) {
    let rgb = await extractFromImageSource(src, true);
    if (rgb) return rgb;
    const dataUrl = await fetchImageAsDataUrlViaTauri(src);
    if (dataUrl) {
      rgb = await extractFromImageSource(dataUrl, false);
      if (rgb) return rgb;
    }
    return null;
  }

  return extractFromImageSource(src, false);
}

/**
 * Picks a saturated "hero" tone from cover/icon art. Remote URLs that block canvas CORS
 * (e.g. Google favicons) are fetched via Tauri when available, then sampled from a data URL.
 * Results are cached (memory + localStorage for hits) to avoid repeat network/canvas work.
 */
export async function extractVibrantDominantColorFromImageSource(src: string): Promise<Rgb | null> {
  const cached = getCachedAmbientRgb(src);
  if (cached !== undefined) return cached;

  const rgb = await extractVibrantDominantColorUncached(src);
  setCachedAmbientRgb(src, rgb);
  return rgb;
}

/** @deprecated Use extractVibrantDominantColorFromImageSource */
export async function extractVibrantDominantColor(src: string): Promise<Rgb | null> {
  return extractVibrantDominantColorFromImageSource(src);
}
