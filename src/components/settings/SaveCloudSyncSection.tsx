import { useCallback, useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSaveSyncStore, conflictPolicyLabel } from "@/stores/saveSyncStore";
import type { ConflictPolicy } from "@/types/saveSync";
import { toast } from "sonner";
import { toastInvokeCatch } from "@/utils/invokeError";
import { appNavigate } from "@/nav/appNavigate";
import { Cloud, HardDrive, Loader2, LogIn, LogOut, RefreshCw, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const GOOGLE_CLOUD_CONSOLE =
  "https://console.cloud.google.com/apis/credentials";

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

export function SaveCloudSyncSection() {
  const hydrated = useSaveSyncStore((s) => s.hydrated);
  const status = useSaveSyncStore((s) => s.status);
  const plan = useSaveSyncStore((s) => s.plan);
  const conflicts = useSaveSyncStore((s) => s.conflicts);
  const busy = useSaveSyncStore((s) => s.busy);
  const refresh = useSaveSyncStore((s) => s.refresh);
  const setConfig = useSaveSyncStore((s) => s.setConfig);
  const signIn = useSaveSyncStore((s) => s.signIn);
  const signOut = useSaveSyncStore((s) => s.signOut);
  const previewPlan = useSaveSyncStore((s) => s.previewPlan);
  const runSync = useSaveSyncStore((s) => s.runSync);
  const resolveConflict = useSaveSyncStore((s) => s.resolveConflict);

  const [clientIdDraft, setClientIdDraft] = useState("");

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (status?.config.googleClientId) {
      setClientIdDraft(status.config.googleClientId);
    }
  }, [status?.config.googleClientId]);

  const cfg = status?.config;
  const connected = status?.connected ?? false;
  const enabled = cfg?.enabled ?? false;

  // Plain function (not useCallback): React Compiler could not preserve the manual
  // memoization here because of the optional-chained dep; it memoizes this itself.
  const handleSignIn = async () => {
    if (!clientIdDraft.trim()) {
      toast.error("Enter your Google OAuth Client ID first.");
      return;
    }
    try {
      if (clientIdDraft.trim() !== cfg?.googleClientId) {
        await setConfig({ googleClientId: clientIdDraft.trim() });
      }
      await signIn();
      toast.success("Signed in to Google Drive");
      await previewPlan();
    } catch (e) {
      toastInvokeCatch("Google sign-in failed", e);
    }
  };

  const handleSync = useCallback(async () => {
    try {
      const result = await runSync();
      if (!result) return;
      if (result.success) {
        toast.success(
          `Synced — uploaded ${result.uploaded}, downloaded ${result.downloaded}, skipped ${result.skipped}`
        );
      } else if (result.conflicts.length > 0) {
        toast.message("Conflicts need your choice", {
          description: result.error ?? "Pick local or cloud for each save below.",
        });
      } else {
        toast.message("Sync did not complete", { description: result.error ?? undefined });
      }
    } catch (e) {
      toastInvokeCatch("Save sync failed", e);
    }
  }, [runSync]);

  const saveClientId = useCallback(async () => {
    try {
      await setConfig({ googleClientId: clientIdDraft.trim() });
      toast.success("Client ID saved");
    } catch (e) {
      toastInvokeCatch("Could not save Client ID", e);
    }
  }, [clientIdDraft, setConfig]);

  return (
    <Card className="glass-dark border-white/10">
      <CardHeader className="space-y-1 pb-4">
        <div className="flex items-center gap-2 text-primary/90">
          <Cloud className="w-5 h-5" aria-hidden />
          <CardTitle className="text-xl font-semibold tracking-tight text-white">
            Save cloud sync
          </CardTitle>
        </div>
        <CardDescription className="text-white/55 text-sm">
          Back up save data to your Google Drive with PS5-style smart sync — newer wins by default,
          or ask when both local and cloud changed since the last sync.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {!hydrated ? (
          <p className="text-sm text-white/50 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            Loading…
          </p>
        ) : null}

        <div className="space-y-2">
          <label htmlFor="google-client-id" className="text-sm font-medium text-white/90">
            Google OAuth Client ID
          </label>
          <p className="text-xs text-white/50 leading-relaxed">
            Create a <strong className="text-white/70">Desktop</strong> OAuth client in Google Cloud.
            Add redirect URI{" "}
            <code className="rounded bg-white/10 px-1 py-0.5 text-[11px]">
              http://127.0.0.1:38476/oauth/callback
            </code>
            . Enable the Google Drive API for the project.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="google-client-id"
              type="text"
              value={clientIdDraft}
              onChange={(e) => setClientIdDraft(e.target.value)}
              placeholder="xxxx.apps.googleusercontent.com"
              className="flex-1 h-10 rounded-xl border border-white/15 bg-black/40 px-3 text-sm text-white placeholder:text-white/35"
              autoComplete="off"
              spellCheck={false}
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0 border-white/15 text-white hover:bg-white/10"
              disabled={busy}
              onClick={() => void saveClientId()}
            >
              Save ID
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-white/60"
              title="Open Google Cloud Console"
              onClick={() => void openUrl(GOOGLE_CLOUD_CONSOLE).catch(() => toast.error("Could not open browser"))}
            >
              <Shield className="w-4 h-4" aria-hidden />
            </Button>
          </div>
        </div>

        {connected && status?.account ? (
          <p className="text-sm text-white/70 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
            Signed in as{" "}
            <span className="text-white font-medium">
              {status.account.displayName ?? status.account.email}
            </span>
            {status.account.displayName ? (
              <span className="text-white/50"> ({status.account.email})</span>
            ) : null}
          </p>
        ) : null}

        {status?.lastError ? (
          <p className="text-sm text-amber-200/90 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3">
            {status.lastError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-white/15 text-white hover:bg-white/10"
            onClick={() => appNavigate("/settings/saves")}
          >
            <HardDrive className="w-4 h-4 mr-2" aria-hidden />
            Save data explorer
          </Button>
          {connected ? (
            <Button
              type="button"
              variant="ghost"
              className="text-white/70 hover:text-white hover:bg-white/10"
              disabled={busy}
              onClick={() => void signOut().catch((e) => toastInvokeCatch("Sign out failed", e))}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          ) : (
            <Button
              type="button"
              className="bg-white text-black hover:bg-white/90"
              disabled={busy}
              onClick={() => void handleSignIn()}
            >
              {busy ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4 mr-2" />
              )}
              Sign in with Google
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="border-white/15 text-white hover:bg-white/10"
            disabled={busy || !connected || !enabled}
            onClick={() => void handleSync()}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", busy && "animate-spin")} />
            Sync saves now
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-white/15 text-white hover:bg-white/10"
            disabled={busy || !connected || !enabled}
            onClick={() => void previewPlan().catch((e) => toastInvokeCatch("Preview failed", e))}
          >
            <HardDrive className="w-4 h-4 mr-2" />
            Preview plan
          </Button>
        </div>

        <SettingToggle
          id="save-sync-enabled"
          label="Enable save cloud sync"
          description="When on, Portal can upload and download saves to your Google Drive app folder."
          checked={enabled}
          disabled={!connected || busy}
          onChange={(v) => void setConfig({ enabled: v })}
        />

        <SettingToggle
          id="save-sync-auto-exit"
          label="Sync when a game exits"
          description="After a tracked game closes, run smart sync in the background (console mode focus watchdog)."
          checked={cfg?.autoSyncOnExit ?? true}
          disabled={!enabled || !connected || busy}
          onChange={(v) => void setConfig({ autoSyncOnExit: v })}
        />

        <div className="space-y-2">
          <label htmlFor="conflict-policy" className="text-sm font-medium text-white/90">
            Conflict handling
          </label>
          <select
            id="conflict-policy"
            value={cfg?.conflictPolicy ?? "autoNewer"}
            disabled={busy}
            onChange={(e) =>
              void setConfig({ conflictPolicy: e.target.value as ConflictPolicy })
            }
            className="w-full h-10 rounded-xl border border-white/15 bg-black/40 px-3 text-sm text-white"
          >
            <option value="autoNewer">{conflictPolicyLabel("autoNewer")}</option>
            <option value="ask">{conflictPolicyLabel("ask")}</option>
          </select>
          <p className="text-xs text-white/45 leading-relaxed">
            Smart sync compares checksums and last-sync baseline: only the side that changed uploads
            or downloads. If both changed, newer file wins (auto) or you choose (ask).
          </p>
        </div>

        {status?.lastSyncUtc ? (
          <p className="text-xs text-white/50">
            Last sync: {new Date(status.lastSyncUtc * 1000).toLocaleString()} ·{" "}
            {status.localBundleCount} save location(s) detected locally
          </p>
        ) : (
          <p className="text-xs text-white/50">
            {status?.localBundleCount ?? 0} save location(s) detected (scan library first for best coverage)
          </p>
        )}

        {plan.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-white/80">Sync plan</h4>
            <ul className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-xs">
              {plan.map((p) => (
                <li
                  key={p.bundleId}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
                >
                  <span className="text-white font-medium">{p.gameName}</span>
                  <span className="text-white/50"> — {p.label}</span>
                  <span className="block text-primary/90 capitalize mt-0.5">{p.action}</span>
                  <span className="block text-white/45">{p.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {conflicts.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-amber-200/90">Resolve conflicts</h4>
            <ul className="space-y-2">
              {conflicts.map((c) => (
                <li
                  key={c.bundleId}
                  className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 space-y-2"
                >
                  <p className="text-sm text-white font-medium">
                    {c.gameName} — {c.label}
                  </p>
                  <p className="text-xs text-white/55">
                    Suggested: {c.recommendation === "useCloud" ? "cloud" : "local"} (newer)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        void resolveConflict(c.bundleId, true).catch((e) =>
                          toastInvokeCatch("Could not apply", e)
                        )
                      }
                    >
                      Keep this PC
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/20 text-white"
                      disabled={busy}
                      onClick={() =>
                        void resolveConflict(c.bundleId, false).catch((e) =>
                          toastInvokeCatch("Could not apply", e)
                        )
                      }
                    >
                      Use Google Drive
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
