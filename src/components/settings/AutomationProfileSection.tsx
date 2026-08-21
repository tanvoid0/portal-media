import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FrameKey } from "@/components/ui/frame-key";
import { Input, nativeSelectClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { SettingToggle } from "@/components/ui/setting-row";
import { useAutomationStore } from "@/stores/automationStore";
import type { AutomationAction, AutomationProfile } from "@/utils/automationTypes";
import { SlidersHorizontal } from "lucide-react";

function profileSummary(profile: AutomationProfile): string {
  const parts: string[] = [];
  for (const a of profile.onLaunch) {
    if (a.type === "disableDisplays" && a.indexes.length) {
      parts.push(`disable display ${a.indexes.join(", ")}`);
    } else if (a.type === "setDefaultAudioDevice") {
      parts.push("set audio");
    } else if (a.type === "launchProcess") {
      parts.push(`launch ${a.path.split(/[/\\]/).pop() ?? a.path}`);
    }
  }
  for (const a of profile.onExit) {
    if (a.type === "restoreDisplays") parts.push("restore displays");
    if (a.type === "restoreAudioDevice") parts.push("restore audio");
  }
  return parts.length ? parts.join(" · ") : "No actions configured";
}

function upsertAction(
  actions: AutomationAction[],
  next: AutomationAction,
  replaceType: AutomationAction["type"]
): AutomationAction[] {
  const filtered = actions.filter((a) => a.type !== replaceType);
  return [...filtered, next];
}

export function AutomationProfileSection() {
  const osSupported = useAutomationStore((s) => s.osSupported);
  const hydrated = useAutomationStore((s) => s.hydrated);
  const saving = useAutomationStore((s) => s.saving);
  const config = useAutomationStore((s) => s.config);
  const displays = useAutomationStore((s) => s.displays);
  const audioDevices = useAutomationStore((s) => s.audioDevices);
  const load = useAutomationStore((s) => s.load);
  const refreshDevices = useAutomationStore((s) => s.refreshDevices);
  const setConfig = useAutomationStore((s) => s.setConfig);
  const updateProfile = useAutomationStore((s) => s.updateProfile);
  const save = useAutomationStore((s) => s.save);

  useEffect(() => {
    void load();
  }, [load]);

  const profile =
    config.profiles.find((p) => p.id === (config.defaultProfileId ?? "default")) ??
    config.profiles[0];

  const disableAction = profile?.onLaunch.find((a) => a.type === "disableDisplays");
  const disableIndexes = disableAction?.type === "disableDisplays" ? disableAction.indexes : [];
  const audioAction = profile?.onLaunch.find((a) => a.type === "setDefaultAudioDevice");
  const audioDeviceId = audioAction?.type === "setDefaultAudioDevice" ? audioAction.deviceId : "";
  const launchAction = profile?.onLaunch.find((a) => a.type === "launchProcess");
  const companionPath = launchAction?.type === "launchProcess" ? launchAction.path : "";
  const restoreDisplays = profile?.onExit.some((a) => a.type === "restoreDisplays") ?? true;
  const restoreAudio = profile?.onExit.some((a) => a.type === "restoreAudioDevice") ?? true;

  const patchProfile = (patch: Partial<AutomationProfile>) => {
    if (!profile) return;
    updateProfile({ ...profile, ...patch });
  };

  const setDisableIndexes = (indexes: number[]) => {
    if (!profile) return;
    const onLaunch =
      indexes.length === 0
        ? profile.onLaunch.filter((a) => a.type !== "disableDisplays")
        : upsertAction(profile.onLaunch, { type: "disableDisplays", indexes }, "disableDisplays");
    patchProfile({ onLaunch });
  };

  const setAudioDevice = (deviceId: string) => {
    if (!profile) return;
    const onLaunch = deviceId
      ? upsertAction(
          profile.onLaunch,
          { type: "setDefaultAudioDevice", deviceId },
          "setDefaultAudioDevice"
        )
      : profile.onLaunch.filter((a) => a.type !== "setDefaultAudioDevice");
    patchProfile({ onLaunch });
  };

  const setCompanionPath = (path: string) => {
    if (!profile) return;
    const trimmed = path.trim();
    const onLaunch = trimmed
      ? upsertAction(profile.onLaunch, { type: "launchProcess", path: trimmed, args: [] }, "launchProcess")
      : profile.onLaunch.filter((a) => a.type !== "launchProcess");
    patchProfile({ onLaunch });
  };

  const setExitRestore = (nextDisplays: boolean, audio: boolean) => {
    if (!profile) return;
    const onExit: AutomationAction[] = [];
    if (nextDisplays) onExit.push({ type: "restoreDisplays" });
    if (audio) onExit.push({ type: "restoreAudioDevice" });
    patchProfile({ onExit });
  };

  const windowsOnly = hydrated && !osSupported;

  return (
    <Panel>
      <PanelHeader>
        <div className="flex items-center gap-2 text-foreground">
          <SlidersHorizontal className="h-5 w-5" aria-hidden />
          <PanelTitle>Launch / exit automation (Phase 3)</PanelTitle>
        </div>
        <PanelDescription>
          Profiles run when you launch a game from the library and restore when the tracked process
          exits. Display and audio changes are snapshotted automatically.
        </PanelDescription>
      </PanelHeader>
      <PanelBody className="space-y-4">
        {windowsOnly ? (
          <p className="rounded-none border border-border px-4 py-3 text-sm text-muted-foreground">
            Automation requires Windows. Profiles are saved but actions will not run on this OS.
          </p>
        ) : null}

        <SettingToggle
          id="automation-enabled"
          label="Enable automation profiles"
          description="Apply the default profile on game launch and exit (pairs with Focus watchdog)."
          checked={config.enabled}
          disabled={windowsOnly}
          onChange={(v) => setConfig({ enabled: v })}
        />

        {config.enabled && profile ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Profile: {profile.name}</p>
              <p className="text-xs text-muted-foreground">{profileSummary(profile)}</p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">On launch</p>
              <div className="space-y-2">
                <Label htmlFor="automation-displays">Disable displays (indexes)</Label>
                <div className="flex flex-wrap gap-2">
                  {displays.map((d) => {
                    const checked = disableIndexes.includes(d.index);
                    return (
                      <FrameKey
                        key={d.index}
                        size="sm"
                        disabled={d.primary}
                        title={d.primary ? "Cannot disable primary display" : d.name}
                        active={checked}
                        onClick={() => {
                          const next = checked
                            ? disableIndexes.filter((i) => i !== d.index)
                            : [...disableIndexes, d.index];
                          setDisableIndexes(next);
                        }}
                      >
                        {d.index}: {d.primary ? "Primary" : d.name || "Display"}
                      </FrameKey>
                    );
                  })}
                </div>
                {displays.length === 0 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="rounded-none"
                    onClick={() => void refreshDevices()}
                  >
                    Refresh displays
                  </Button>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="automation-audio">Default playback device</Label>
                <select
                  id="automation-audio"
                  value={audioDeviceId}
                  onChange={(e) => setAudioDevice(e.target.value)}
                  className={nativeSelectClassName}
                >
                  <option value="">— No change —</option>
                  {audioDevices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                      {d.defaultMultimedia ? " (current default)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="automation-companion">Launch companion tool (optional)</Label>
                <Input
                  id="automation-companion"
                  type="text"
                  value={companionPath}
                  onChange={(e) => setCompanionPath(e.target.value)}
                  placeholder="C:\\Tools\\RTSS.exe"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">On exit</p>
              <SettingToggle
                id="automation-restore-displays"
                label="Restore displays"
                description="Reapply the display topology saved before launch."
                checked={restoreDisplays}
                onChange={(v) => setExitRestore(v, restoreAudio)}
              />
              <SettingToggle
                id="automation-restore-audio"
                label="Restore default audio device"
                description="Restore multimedia and communications defaults from before launch."
                checked={restoreAudio}
                onChange={(v) => setExitRestore(restoreDisplays, v)}
              />
            </div>
          </div>
        ) : null}

        <Button
          type="button"
          className="rounded-none"
          disabled={saving || windowsOnly}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save automation settings"}
        </Button>
      </PanelBody>
    </Panel>
  );
}
