import { create } from "zustand";
import {
  automationGetConfig,
  automationIsSupported,
  automationListAudioDevices,
  automationListDisplays,
  automationSaveConfig,
} from "@/utils/automationApi";
import {
  DEFAULT_AUTOMATION_CONFIG,
  type AudioDeviceInfo,
  type AutomationConfig,
  type AutomationProfile,
  type DisplayInfo,
} from "@/utils/automationTypes";

interface AutomationStore {
  osSupported: boolean;
  hydrated: boolean;
  saving: boolean;
  config: AutomationConfig;
  displays: DisplayInfo[];
  audioDevices: AudioDeviceInfo[];
  load: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  setConfig: (partial: Partial<AutomationConfig>) => void;
  updateProfile: (profile: AutomationProfile) => void;
  save: () => Promise<void>;
}

export const useAutomationStore = create<AutomationStore>((set, get) => ({
  osSupported: false,
  hydrated: false,
  saving: false,
  config: { ...DEFAULT_AUTOMATION_CONFIG },
  displays: [],
  audioDevices: [],
  load: async () => {
    const supported = await automationIsSupported();
    if (!supported) {
      set({ osSupported: false, hydrated: true });
      return;
    }
    try {
      const remote = await automationGetConfig();
      const config = remote ?? { ...DEFAULT_AUTOMATION_CONFIG };
      set({ osSupported: true, config, hydrated: true });
      await get().refreshDevices();
    } catch (e) {
      console.error(e);
      set({ osSupported: true, hydrated: true });
    }
  },
  refreshDevices: async () => {
    if (!get().osSupported) return;
    try {
      const [displays, audioDevices] = await Promise.all([
        automationListDisplays(),
        automationListAudioDevices(),
      ]);
      set({ displays, audioDevices });
    } catch (e) {
      console.error(e);
    }
  },
  setConfig: (partial) => {
    set({ config: { ...get().config, ...partial } });
  },
  updateProfile: (profile) => {
    const profiles = get().config.profiles.map((p) =>
      p.id === profile.id ? profile : p
    );
    set({ config: { ...get().config, profiles } });
  },
  save: async () => {
    set({ saving: true });
    try {
      await automationSaveConfig(get().config);
    } finally {
      set({ saving: false });
    }
  },
}));
