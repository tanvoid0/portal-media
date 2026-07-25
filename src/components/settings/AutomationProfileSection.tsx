import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutomationStore } from "@/stores/automationStore";
import type { AutomationAction, AutomationProfile } from "@/utils/automationTypes";
import { cn } from "@/lib/utils";
import { SlidersHorizontal } from "lucide-react";

function SettingToggle({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 cursor-pointer transition-opacity",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 rounded-md border-white/35 bg-black/50 shrink-0 accent-primary"
      />
      <span className="min-w-0 space-y-1">
        <span className="block text-white font-medium text-sm">{label}</span>
        <span className="block text-white/50 text-xs leading-relaxed">{description}</span>
      </span>
    </label>
  );
}

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
  const disableIndexes =
    disableAction?.type === "disableDisplays" ? disableAction.indexes : [];
  const audioAction = profile?.onLaunch.find((a) => a.type === "setDefaultAudioDevice");
  const audioDeviceId =
    audioAction?.type === "setDefaultAudioDevice" ? audioAction.deviceId : "";
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

  const setExitRestore = (displays: boolean, audio: boolean) => {
    if (!profile) return;
    const onExit: AutomationAction[] = [];
    if (displays) onExit.push({ type: "restoreDisplays" });
    if (audio) onExit.push({ type: "restoreAudioDevice" });
    patchProfile({ onExit });
  };

  const windowsOnly = hydrated && !osSupported;

  return (
    <Card className="glass-dark border-white/10">
      <CardHeader className="space-y-1 pb-4">
        <div className="flex items-center gap-2 text-primary/90">
          <SlidersHorizontal className="w-5 h-5" aria-hidden />
          <CardTitle className="text-xl font-semibold tracking-tight text-white">
            Launch / exit automation (Phase 3)
          </CardTitle>
        </div>
        <CardDescription className="text-white/55 text-sm">
          Profiles run when you launch a game from the library and restore when the tracked process
          exits. Display and audio changes are snapshotted automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {windowsOnly ? (
          <p className="text-sm text-amber-200/90 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3">
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
          <div className="space-y-4 rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">Profile: {profile.name}</p>
              <p className="text-xs text-white/45">{profileSummary(profile)}</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-white/70 uppercase tracking-wide">On launch</p>
              <div className="space-y-2">
                <label className="block text-xs text-white/55" htmlFor="automation-displays">
                  Disable displays (indexes)
                </label>
                <div className="flex flex-wrap gap-2">
                  {displays.map((d) => {
                    const checked = disableIndexes.includes(d.index);
                    return (
                      <button
                        key={d.index}
                        type="button"
                        disabled={d.primary}
                        title={d.primary ? "Cannot disable primary display" : d.name}
                        onClick={() => {
                          const next = checked
                            ? disableIndexes.filter((i) => i !== d.index)
                            : [...disableIndexes, d.index];
                          setDisableIndexes(next);
                        }}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs transition-colors",
                          d.primary && "opacity-40 cursor-not-allowed",
                          checked
                            ? "border-primary/60 bg-primary/20 text-white"
                            : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                        )}
                      >
                        {d.index}: {d.primary ? "Primary" : d.name || "Display"}
                      </button>
                    );
                  })}
                </div>
                {displays.length === 0 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => void refreshDevices()}
                  >
                    Refresh displays
                  </Button>
                ) : null}
              </div>

              <div className="space-y-1">
                <label className="block text-xs text-white/55" htmlFor="automation-audio">
                  Default playback device
                </label>
                <select
                  id="automation-audio"
                  value={audioDeviceId}
                  onChange={(e) => setAudioDevice(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-black/40 text-sm text-white px-3 py-2"
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

              <div className="space-y-1">
                <label className="block text-xs text-white/55" htmlFor="automation-companion">
                  Launch companion tool (optional)
                </label>
                <input
                  id="automation-companion"
                  type="text"
                  value={companionPath}
                  onChange={(e) => setCompanionPath(e.target.value)}
                  placeholder="C:\\Tools\\RTSS.exe"
                  className="w-full rounded-lg border border-white/15 bg-black/40 text-sm text-white px-3 py-2 font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-white/70 uppercase tracking-wide">On exit</p>
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
          className="rounded-xl"
          disabled={saving || windowsOnly}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save automation settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
