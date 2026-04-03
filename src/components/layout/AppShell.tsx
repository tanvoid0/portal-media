import { Outlet } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { ExitModal } from "@/components/ExitModal";
import { BrowserView } from "@/components/BrowserView";
import { BrowserMinimized } from "@/components/BrowserMinimized";
import { Toaster } from "@/components/ui/toaster";
import { useShellChrome } from "@/context/ShellChromeContext";
import { useNavBindingsStore } from "@/stores/navBindingsStore";
import ControllerHintBar from "./ControllerHintBar";
import GameOptionsMenu from "./GameOptionsMenu";
import QuickAccessOverlay from "./QuickAccessOverlay";
import AppSwitcherOverlay from "./AppSwitcherOverlay";

export function AppShell() {
  const { showExitModal, setShowExitModal, onConfirmExit } = useShellChrome();
  const remoteBindingsEnabled = useNavBindingsStore((s) => s.remoteBindingsEnabled);

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      <div className="fixed inset-0 bg-background z-0" />

      <Navigation />

      <div className="flex flex-col h-screen relative z-10 overflow-hidden min-h-0">
        <Outlet />
        {remoteBindingsEnabled ? <ControllerHintBar /> : null}
      </div>

      <GameOptionsMenu />
      <QuickAccessOverlay />
      <AppSwitcherOverlay />

      <ExitModal
        isOpen={showExitModal}
        onClose={() => setShowExitModal(false)}
        onConfirm={onConfirmExit}
      />

      <BrowserView />
      <BrowserMinimized />
      <Toaster />
    </div>
  );
}
