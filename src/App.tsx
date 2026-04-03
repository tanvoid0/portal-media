import { useState, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AppShell } from "@/components/layout";
import { useGames } from "@/hooks/useGames";
import { useBrowserNavigation } from "@/hooks/useBrowserNavigation";
import { useTheme } from "@/hooks/useTheme";
import { useWindowChrome } from "@/hooks/useWindowChrome";
import { useAppShellEvents } from "@/hooks/useAppShellEvents";
import { useAppShellStore } from "@/stores/appShellStore";

function App() {
  const currentView = useAppShellStore((s) => s.currentView);
  const setCurrentView = useAppShellStore((s) => s.setCurrentView);
  const [showExitModal, setShowExitModal] = useState(false);
  const { appearance, toggleTheme } = useTheme();
  const { isMaximized, isFullscreen, handleToggleMaximize } = useWindowChrome();

  useGames();
  useBrowserNavigation();

  const onToggleFullscreen = useCallback(() => {
    void handleToggleMaximize();
  }, [handleToggleMaximize]);

  useAppShellEvents(setCurrentView, setShowExitModal, onToggleFullscreen);

  const handleExit = useCallback(async () => {
    const appWindow = getCurrentWindow();
    await appWindow.close();
  }, []);

  return (
    <AppShell
      currentView={currentView}
      setCurrentView={setCurrentView}
      showExitModal={showExitModal}
      setShowExitModal={setShowExitModal}
      appearance={appearance}
      toggleAppearance={toggleTheme}
      isMaximized={isMaximized}
      isFullscreen={isFullscreen}
      onToggleFullscreen={onToggleFullscreen}
      onConfirmExit={handleExit}
    />
  );
}

export default App;
