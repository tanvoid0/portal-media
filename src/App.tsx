import { useState, useCallback, useMemo } from "react";
import { PortalBootSplash } from "@/components/layout/PortalBootSplash";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout";
import { LibraryChromeLayout } from "@/components/layout/LibraryChromeLayout";
import { SettingsChromeLayout } from "@/components/layout/SettingsChromeLayout";
import { NavigateBinder } from "@/components/layout/NavigateBinder";
import { RouterSync } from "@/components/layout/RouterSync";
import { LibraryMain } from "@/components/layout/LibraryMain";
import { GameDetailsPage } from "@/components/layout/GameDetailsPage";
import { GameSavesPage } from "@/components/layout/GameSavesPage";
import { TmdbDetailsPage } from "@/components/layout/TmdbDetailsPage";
import { IgdbDetailsPage } from "@/components/layout/IgdbDetailsPage";
import { ShellChromeProvider } from "@/context/ShellChromeContext";
import { SettingsGamePage } from "@/components/settings/pages/SettingsGamePage";
import { SettingsAppearancePage } from "@/components/settings/pages/SettingsAppearancePage";
import { SettingsApiPage } from "@/components/settings/pages/SettingsApiPage";
import { SettingsControllerPage } from "@/components/settings/pages/SettingsControllerPage";
import { SettingsStreamingPage } from "@/components/settings/pages/SettingsStreamingPage";
import { DocsChromeLayout } from "@/components/layout/DocsChromeLayout";
import { DocsPage } from "@/components/docs/DocsPage";
import { SpotifyPage } from "@/pages/spotify/SpotifyPage";
import { useGames } from "@/hooks/useGames";
import { useUiSounds } from "@/hooks/useUiSounds";
import { useBrowserNavigation } from "@/hooks/useBrowserNavigation";
import { useTheme } from "@/hooks/useTheme";
import { useWindowChrome } from "@/hooks/useWindowChrome";
import { useAppShellEvents } from "@/hooks/useAppShellEvents";
import { useConsoleMode } from "@/hooks/useConsoleMode";
import { performAppExit } from "@/utils/performAppExit";
import { useShellOverlayStore } from "@/stores/shellOverlayStore";
import { useShellHotkeys } from "@/hooks/useShellHotkeys";
import { useFocusWatchdog } from "@/hooks/useFocusWatchdog";
import { useSaveSyncOnGameExit } from "@/hooks/useSaveSyncOnGameExit";
import { useNativeGamepad } from "@/hooks/useNativeGamepad";
import { useWinlogonShell } from "@/hooks/useWinlogonShell";
import { SettingsSystemPage } from "@/components/settings/pages/SettingsSystemPage";
import { SettingsSavesPage } from "@/components/settings/pages/SettingsSavesPage";

function ShellRoutes({ bootDone }: { bootDone: boolean }) {
  const [showExitModal, setShowExitModalRaw] = useState(false);
  const setShowExitModal = useCallback((open: boolean) => {
    setShowExitModalRaw(open);
    useShellOverlayStore.getState().setExitConfirmOpen(open);
  }, []);
  const { appearance, toggleTheme } = useTheme();
  const { isMaximized, isFullscreen, handleToggleMaximize } = useWindowChrome();

  const onToggleFullscreen = useCallback(() => {
    void handleToggleMaximize();
  }, [handleToggleMaximize]);

  const enterFullscreen = useCallback(async () => {
    if (!isTauri()) return;
    const appWindow = getCurrentWindow();
    if (await appWindow.isFullscreen()) return;
    if (await appWindow.isMaximized()) {
      await appWindow.unmaximize();
    }
    await appWindow.setFullscreen(true);
  }, []);

  useConsoleMode({ bootDone, enterFullscreen });
  useWinlogonShell({ bootDone });
  useShellHotkeys({ bootDone });
  useFocusWatchdog({ bootDone });
  useSaveSyncOnGameExit({ bootDone });
  useNativeGamepad();
  useAppShellEvents(setShowExitModal, onToggleFullscreen);

  const handleExit = useCallback(async () => {
    setShowExitModal(false);
    await performAppExit();
  }, [setShowExitModal]);

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
            <Route path="game/:gameId/saves" element={<GameSavesPage />} />
            <Route path="game/:gameId" element={<GameDetailsPage />} />
            <Route path="tmdb/:mediaType/:id" element={<TmdbDetailsPage />} />
            <Route path="igdb/:igdbId" element={<IgdbDetailsPage />} />
          </Route>
          <Route path="settings" element={<SettingsChromeLayout />}>
            <Route index element={<Navigate to="game" replace />} />
            <Route path="game" element={<SettingsGamePage />} />
            <Route path="saves" element={<SettingsSavesPage />} />
            <Route path="appearance" element={<SettingsAppearancePage />} />
            <Route path="api" element={<SettingsApiPage />} />
            <Route path="streaming" element={<SettingsStreamingPage />} />
            <Route path="navigation" element={<Navigate to="controller" replace />} />
            <Route path="controller" element={<SettingsControllerPage />} />
            <Route path="system" element={<SettingsSystemPage />} />
          </Route>
          <Route path="docs" element={<DocsChromeLayout />}>
            <Route index element={<DocsPage />} />
          </Route>
          <Route path="spotify" element={<SpotifyPage />} />
          <Route index element={<Navigate to="library/all" replace />} />
          <Route path="*" element={<Navigate to="/library/all" replace />} />
        </Route>
      </Routes>
    </ShellChromeProvider>
  );
}

function App() {
  const [bootDone, setBootDone] = useState(false);
  const onBootComplete = useCallback(() => setBootDone(true), []);

  useGames();
  useUiSounds();
  useBrowserNavigation();

  return (
    <BrowserRouter>
      <NavigateBinder />
      <RouterSync />
      <ShellRoutes bootDone={bootDone} />
      {!bootDone ? <PortalBootSplash onComplete={onBootComplete} /> : null}
    </BrowserRouter>
  );
}

export default App;
