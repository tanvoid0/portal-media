import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { restoreConsoleModeOnExit } from "@/hooks/useConsoleMode";
import { recoverDesktopSession } from "@/utils/sessionRecoveryApi";

let exitInFlight = false;

/**
 * Dismiss UI, restore desktop chrome, then quit the app process (required when Portal is the logon shell).
 */
export async function performAppExit(): Promise<void> {
  if (exitInFlight) return;
  exitInFlight = true;

  try {
    try {
      await restoreConsoleModeOnExit();
    } catch (e) {
      console.error("Console mode restore on exit failed:", e);
    }

    if (!isTauri()) {
      window.close();
      return;
    }

    try {
      await invoke("request_app_exit");
      return;
    } catch (e) {
      console.error("request_app_exit failed, falling back to window close:", e);
    }

    try {
      await recoverDesktopSession();
    } catch (e) {
      console.error("recover_desktop_session failed:", e);
    }

    const appWindow = getCurrentWindow();
    try {
      await appWindow.close();
    } catch (e) {
      console.error("window.close failed, trying destroy:", e);
      await appWindow.destroy();
    }
  } finally {
    exitInFlight = false;
  }
}
