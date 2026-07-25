import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@tauri-apps/api/core";

export interface WinlogonShellStatus {
  supported: boolean;
  configured: boolean;
  sessionStartedAsShell: boolean;
  pendingSignOut: boolean;
  shellValue: string | null;
  portalExePath: string | null;
  isElevated: boolean;
  companionExplorerRunning: boolean;
  revertOnNextLaunch: boolean;
  revertedThisSession: boolean;
}

export async function winlogonShellIsSupported(): Promise<boolean> {
  if (!isTauri()) return false;
  return invoke<boolean>("winlogon_shell_is_supported");
}

export async function winlogonShellGetStatus(): Promise<WinlogonShellStatus | null> {
  if (!isTauri()) return null;
  return invoke<WinlogonShellStatus>("winlogon_shell_get_status");
}

export async function winlogonShellSetEnabled(enabled: boolean): Promise<void> {
  if (!isTauri()) return;
  await invoke("winlogon_shell_set_enabled", { enabled });
}

export async function winlogonShellSetRevertOnNextLaunch(enabled: boolean): Promise<void> {
  if (!isTauri()) return;
  await invoke("winlogon_shell_set_revert_on_next_launch", { enabled });
}
