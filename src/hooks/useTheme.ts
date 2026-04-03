import { useThemeStore } from "@/stores/themeStore";

export { hydrateThemeFromStorage } from "@/stores/themeStore";

export function useTheme() {
  const themeId = useThemeStore((s) => s.themeId);
  const appearance = useThemeStore((s) => s.appearance);
  const setThemeId = useThemeStore((s) => s.setThemeId);
  const setAppearance = useThemeStore((s) => s.setAppearance);
  const toggleAppearance = useThemeStore((s) => s.toggleAppearance);

  return {
    themeId,
    setThemeId,
    appearance,
    setAppearance,
    toggleAppearance,
    /** @deprecated Prefer `appearance`; kept for Sonner and brief call sites. */
    theme: appearance,
    toggleTheme: toggleAppearance,
  };
}
