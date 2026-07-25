import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@tauri-apps/api/core";

export interface ConsoleModeStatus {
  supported: boolean;
  launchAtLogin: boolean;
  taskbarHidden: boolean;
  staleDesktopChrome: boolean;
}

export async function consoleModeIsSupported(): Promise<boolean> {
  if (!isTauri()) return false;
  return invoke<boolean>("console_mode_is_supported");
}

export async function consoleModeGetStatus(): Promise<ConsoleModeStatus | null> {
  if (!isTauri()) return null;
  return invoke<ConsoleModeStatus>("console_mode_get_status");
}

export async function consoleModeSetLaunchAtLogin(enabled: boolean): Promise<void> {
  if (!isTauri()) return;
  await invoke("console_mode_set_launch_at_login", { enabled });
}

export async function enableConsoleMode(): Promise<void> {
  if (!isTauri()) return;
  await invoke("enable_console_mode");
}

export async function disableConsoleMode(): Promise<void> {
  if (!isTauri()) return;
  await invoke("disable_console_mode");
}

/** @deprecated Prefer enableConsoleMode */
export async function consoleModeApplyDesktop(): Promise<void> {
  return enableConsoleMode();
}

/** @deprecated Prefer disableConsoleMode */
export async function consoleModeRestoreDesktop(): Promise<void> {
  return disableConsoleMode();
}
