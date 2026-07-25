import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@tauri-apps/api/core";
import type {
  AudioDeviceInfo,
  AutomationConfig,
  DisplayInfo,
} from "@/utils/automationTypes";

export async function automationIsSupported(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    return await invoke<boolean>("automation_is_supported");
  } catch {
    return false;
  }
}

export async function automationListDisplays(): Promise<DisplayInfo[]> {
  if (!isTauri()) return [];
  return invoke<DisplayInfo[]>("automation_list_displays");
}

export async function automationListAudioDevices(): Promise<AudioDeviceInfo[]> {
  if (!isTauri()) return [];
  return invoke<AudioDeviceInfo[]>("automation_list_audio_devices");
}

export async function automationGetConfig(): Promise<AutomationConfig | null> {
  if (!isTauri()) return null;
  return invoke<AutomationConfig>("automation_get_config");
}

export async function automationSaveConfig(config: AutomationConfig): Promise<void> {
  if (!isTauri()) return;
  await invoke("automation_save_config", { config });
}

export async function automationApplyLaunch(gameId: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("automation_apply_launch", { gameId });
}

export async function automationRegisterGamePid(pid: number, gameId: string): Promise<void> {
  if (!isTauri() || pid <= 0) return;
  await invoke("automation_register_game_pid", { pid, gameId });
}

export async function automationApplyExit(gameId?: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("automation_apply_exit", { gameId: gameId ?? undefined });
}
