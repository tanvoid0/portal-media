export type AutomationAction =
  | { type: "disableDisplays"; indexes: number[] }
  | { type: "restoreDisplays" }
  | { type: "setDefaultAudioDevice"; deviceId: string }
  | { type: "restoreAudioDevice" }
  | { type: "launchProcess"; path: string; args?: string[] };

export interface AutomationProfile {
  id: string;
  name: string;
  onLaunch: AutomationAction[];
  onExit: AutomationAction[];
}

export interface AutomationConfig {
  enabled: boolean;
  defaultProfileId: string | null;
  gameAssignments: Record<string, string>;
  profiles: AutomationProfile[];
}

export interface DisplayInfo {
  index: number;
  name: string;
  primary: boolean;
  active: boolean;
}

export interface AudioDeviceInfo {
  id: string;
  name: string;
  defaultMultimedia: boolean;
  defaultCommunications: boolean;
}

export const DEFAULT_AUTOMATION_PROFILE: AutomationProfile = {
  id: "default",
  name: "Gaming",
  onLaunch: [],
  onExit: [{ type: "restoreDisplays" }, { type: "restoreAudioDevice" }],
};

export const DEFAULT_AUTOMATION_CONFIG: AutomationConfig = {
  enabled: false,
  defaultProfileId: "default",
  gameAssignments: {},
  profiles: [DEFAULT_AUTOMATION_PROFILE],
};
