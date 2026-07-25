import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@tauri-apps/api/core";

/** Restore taskbar, Explorer desktop, and schedule shell revert when Portal was the logon shell. */
export async function recoverDesktopSession(): Promise<void> {
  if (!isTauri()) return;
  await invoke("recover_desktop_session");
}

/** Restore session state and terminate the Portal process. */
export async function requestAppExit(): Promise<void> {
  if (!isTauri()) return;
  await invoke("request_app_exit");
}
