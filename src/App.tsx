import { useState, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout";
import { NavigateBinder } from "@/components/layout/NavigateBinder";
import { RouterSync } from "@/components/layout/RouterSync";
import { LibraryMain } from "@/components/layout/LibraryMain";
import { SettingsLayout } from "@/components/settings/SettingsLayout";
import { SettingsGamePage } from "@/components/settings/pages/SettingsGamePage";
import { SettingsAppearancePage } from "@/components/settings/pages/SettingsAppearancePage";
import { SettingsApiPage } from "@/components/settings/pages/SettingsApiPage";
import { SettingsControllerPage } from "@/components/settings/pages/SettingsControllerPage";
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

  return (
    <Routes>
      <Route
        element={
          <AppShell
            showExitModal={showExitModal}
            setShowExitModal={setShowExitModal}
            appearance={appearance}
            toggleAppearance={toggleTheme}
            isMaximized={isMaximized}
            isFullscreen={isFullscreen}
            onToggleFullscreen={onToggleFullscreen}
            onConfirmExit={handleExit}
          />
        }
      >
        <Route index element={<LibraryMain />} />
        <Route path="settings" element={<SettingsLayout />}>
          <Route index element={<Navigate to="game" replace />} />
          <Route path="game" element={<SettingsGamePage />} />
          <Route path="appearance" element={<SettingsAppearancePage />} />
          <Route path="api" element={<SettingsApiPage />} />
          <Route path="controller" element={<SettingsControllerPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
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
