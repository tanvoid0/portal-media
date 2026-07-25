import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@tauri-apps/api/core";

export async function shellHotkeysSetEnabled(enabled: boolean): Promise<void> {
  if (!isTauri()) return;
  await invoke("shell_hotkeys_set_enabled", { enabled });
}

export async function focusWatchdogSetEnabled(enabled: boolean): Promise<void> {
  if (!isTauri()) return;
  await invoke("focus_watchdog_set_enabled", { enabled });
}

export async function focusWatchdogSyncTrackedPids(pids: number[]): Promise<void> {
  if (!isTauri()) return;
  await invoke("focus_watchdog_sync_tracked_pids", { pids });
}

export async function isProcessRunning(pid: number): Promise<boolean> {
  if (!isTauri() || pid <= 0) return false;
  return invoke<boolean>("is_process_running", { pid });
}

export async function focusPortalMainWindow(): Promise<void> {
  if (!isTauri()) return;
  await invoke("focus_portal_main_window");
}
