import { createContext, useContext, type ReactNode } from "react";
import type { ThemeAppearance } from "@/types/theme";

export interface ShellChromeValue {
  showExitModal: boolean;
  setShowExitModal: (open: boolean) => void;
  appearance: ThemeAppearance;
  toggleAppearance: () => void;
  isMaximized: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onConfirmExit: () => void;
}

const ShellChromeContext = createContext<ShellChromeValue | null>(null);

export function ShellChromeProvider({
  value,
  children,
}: {
  value: ShellChromeValue;
  children: ReactNode;
}) {
  return <ShellChromeContext.Provider value={value}>{children}</ShellChromeContext.Provider>;
}

export function useShellChrome(): ShellChromeValue {
  const v = useContext(ShellChromeContext);
  if (!v) throw new Error("useShellChrome must be used within ShellChromeProvider");
  return v;
}
