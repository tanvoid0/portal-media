import { useState, useCallback, useMemo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout";
import { LibraryChromeLayout } from "@/components/layout/LibraryChromeLayout";
import { SettingsChromeLayout } from "@/components/layout/SettingsChromeLayout";
import { NavigateBinder } from "@/components/layout/NavigateBinder";
import { RouterSync } from "@/components/layout/RouterSync";
import { LibraryMain } from "@/components/layout/LibraryMain";
import { GameDetailsPage } from "@/components/layout/GameDetailsPage";
import { TmdbDetailsPage } from "@/components/layout/TmdbDetailsPage";
import { ShellChromeProvider } from "@/context/ShellChromeContext";
import { SettingsGamePage } from "@/components/settings/pages/SettingsGamePage";
import { SettingsAppearancePage } from "@/components/settings/pages/SettingsAppearancePage";
import { SettingsApiPage } from "@/components/settings/pages/SettingsApiPage";
import { SettingsControllerPage } from "@/components/settings/pages/SettingsControllerPage";
import { SettingsStreamingPage } from "@/components/settings/pages/SettingsStreamingPage";
import { useGames } from "@/hooks/useGames";
import { useBrowserNavigation } from "@/hooks/useBrowserNavigation";
import { useTheme } from "@/hooks/useTheme";
import { useWindowChrome } from "@/hooks/useWindowChrome";
import { useAppShellEvents } from "@/hooks/useAppShellEvents";

function ShellRoutes() {
  const [showExitModal, setShowExitModal] = useState(false);
  const { appearance, toggleTheme } = useTheme();
  const { isMaximized, isFullscreen, handleToggleMaximize } = useWindowChrome();

  const onToggleFullscreen = useCallback(() => {
    void handleToggleMaximize();
  }, [handleToggleMaximize]);

  useAppShellEvents(setShowExitModal, onToggleFullscreen);

  const handleExit = useCallback(async () => {
    const appWindow = getCurrentWindow();
    await appWindow.close();
  }, []);

  const shellChrome = useMemo(
    () => ({
      showExitModal,
      setShowExitModal,
      appearance,
      toggleAppearance: toggleTheme,
      isMaximized,
      isFullscreen,
      onToggleFullscreen,
      onConfirmExit: handleExit,
    }),
    [
      showExitModal,
      appearance,
      toggleTheme,
      isMaximized,
      isFullscreen,
      onToggleFullscreen,
      handleExit,
    ]
  );

  return (
    <ShellChromeProvider value={shellChrome}>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route element={<LibraryChromeLayout />}>
            <Route path="library/:section" element={<LibraryMain />} />
            <Route path="game/:gameId" element={<GameDetailsPage />} />
            <Route path="tmdb/:mediaType/:id" element={<TmdbDetailsPage />} />
          </Route>
          <Route path="settings" element={<SettingsChromeLayout />}>
            <Route index element={<Navigate to="game" replace />} />
            <Route path="game" element={<SettingsGamePage />} />
            <Route path="appearance" element={<SettingsAppearancePage />} />
            <Route path="api" element={<SettingsApiPage />} />
            <Route path="streaming" element={<SettingsStreamingPage />} />
            <Route path="controller" element={<SettingsControllerPage />} />
          </Route>
          <Route index element={<Navigate to="library/all" replace />} />
          <Route path="*" element={<Navigate to="/library/all" replace />} />
        </Route>
      </Routes>
    </ShellChromeProvider>
  );
}

function App() {
  useGames();
  useBrowserNavigation();

  return (
    <BrowserRouter>
      <NavigateBinder />
      <RouterSync />
      <ShellRoutes />
    </BrowserRouter>
  );
}

export default App;
