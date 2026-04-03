import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { StreamingAddonManifest } from "@/types/streamingAddon";
import type { Game } from "@/types/game";
import {
  getDisabledStreamingAddonPaths,
  getStreamingAddonZipPath,
  getStreamingPluginsDirOverride,
} from "@/utils/streamingAddonPrefs";

type StreamingAddonState = {
  manifest: StreamingAddonManifest | null;
  load: () => Promise<void>;
  libraryBookmarkRow: () => Omit<Game, "id"> | null;
};

function faviconUrlForDomain(domain: string, size: 128 | 256): string {
  return `https://www.google.com/s2/favicons?sz=${size}&domain=${encodeURIComponent(domain)}`;
}

function hostMatchesSuffix(hostname: string, suffix: string): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, "");
  const s = suffix.toLowerCase().replace(/^\./, "");
  return h === s || h.endsWith(`.${s}`);
}

/** Match bookmark / browser URLs against optional add-on branding (from zip manifest). */
export function matchStreamingAddonHost(hostname: string): { accentColor?: string } | null {
  const brand = useStreamingAddonStore.getState().manifest?.browserBrand;
  if (!brand?.hostSuffixes?.length) return null;
  const h = hostname.toLowerCase().replace(/^www\./, "");
  for (const suf of brand.hostSuffixes) {
    if (hostMatchesSuffix(h, suf)) {
      return { accentColor: brand.accentColor ?? undefined };
    }
  }
  return null;
}

export function matchStreamingAddonName(name: string): { accentColor?: string } | null {
  const brand = useStreamingAddonStore.getState().manifest?.browserBrand;
  if (!brand?.nameIncludes?.length) return null;
  const n = name.toLowerCase();
  for (const frag of brand.nameIncludes) {
    if (n.includes(frag.toLowerCase())) {
      return { accentColor: brand.accentColor ?? undefined };
    }
  }
  return null;
}

export const useStreamingAddonStore = create<StreamingAddonState>((set, get) => ({
  manifest: null,

  load: async () => {
    try {
      const overrideZipPath = getStreamingAddonZipPath();
      const disabled = getDisabledStreamingAddonPaths();
      const pluginsDir = getStreamingPluginsDirOverride()?.trim();
      const m = await invoke<StreamingAddonManifest | null>("load_streaming_addon", {
        overrideZipPath: overrideZipPath ?? null,
        disabledAddonPaths: disabled.length ? disabled : null,
        pluginsDirOverride: pluginsDir || null,
      });
      set({ manifest: m });
    } catch {
      set({ manifest: null });
    }
  },

  libraryBookmarkRow: () => {
    const m = get().manifest;
    if (!m?.enabled || !m.features.libraryBookmark) return null;
    const origin = m.webOrigin.replace(/\/$/, "");
    return {
      name: m.displayName,
      path: origin,
      executable: origin,
      cover_art: undefined,
      icon: faviconUrlForDomain(m.icon.faviconDomain, 256),
      platform: "Web",
      category: "Media",
      launch_type: "Url",
    };
  },
}));
