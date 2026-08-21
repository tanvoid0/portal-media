import { useCallback, useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "@/components/ui/button";
import { Input, nativeSelectClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { SettingToggle } from "@/components/ui/setting-row";
import { useSaveSyncStore, conflictPolicyLabel } from "@/stores/saveSyncStore";
import type { ConflictPolicy } from "@/types/saveSync";
import { toast } from "sonner";
import { toastInvokeCatch } from "@/utils/invokeError";
import { appNavigate } from "@/nav/appNavigate";
import { Cloud, HardDrive, Loader2, LogIn, LogOut, RefreshCw, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const GOOGLE_CLOUD_CONSOLE = "https://console.cloud.google.com/apis/credentials";

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
    <Panel>
      <PanelHeader>
        <div className="flex items-center gap-2 text-foreground">
          <Cloud className="h-5 w-5" aria-hidden />
          <PanelTitle>Save cloud sync</PanelTitle>
        </div>
        <PanelDescription>
          Back up save data to your Google Drive with PS5-style smart sync — newer wins by default,
          or ask when both local and cloud changed since the last sync.
        </PanelDescription>
      </PanelHeader>
      <PanelBody className="space-y-4">
        {!hydrated ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading…
          </p>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="google-client-id">Google OAuth Client ID</Label>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Create a <strong className="text-foreground">Desktop</strong> OAuth client in Google Cloud.
            Add redirect URI{" "}
            <code className="rounded-none bg-muted px-1 py-0.5 text-xs">
              http://127.0.0.1:38476/oauth/callback
            </code>
            . Enable the Google Drive API for the project.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="google-client-id"
              type="text"
              value={clientIdDraft}
              onChange={(e) => setClientIdDraft(e.target.value)}
              placeholder="xxxx.apps.googleusercontent.com"
              className="flex-1"
              autoComplete="off"
              spellCheck={false}
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0 rounded-none"
              disabled={busy}
              onClick={() => void saveClientId()}
            >
              Save ID
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-none"
              title="Open Google Cloud Console"
              onClick={() =>
                void openUrl(GOOGLE_CLOUD_CONSOLE).catch(() => toast.error("Could not open browser"))
              }
            >
              <Shield className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>

        {connected && status?.account ? (
          <p className="rounded-none border border-border px-4 py-3 text-sm text-foreground">
            Signed in as{" "}
            <span className="font-medium">
              {status.account.displayName ?? status.account.email}
            </span>
            {status.account.displayName ? (
              <span className="text-muted-foreground"> ({status.account.email})</span>
            ) : null}
          </p>
        ) : null}

        {status?.lastError ? (
          <p className="rounded-none border border-destructive/40 px-4 py-3 text-sm text-destructive">
            {status.lastError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-none"
            onClick={() => appNavigate("/settings/saves")}
          >
            <HardDrive className="mr-2 h-4 w-4" aria-hidden />
            Save data explorer
          </Button>
          {connected ? (
            <Button
              type="button"
              variant="ghost"
              className="rounded-none"
              disabled={busy}
              onClick={() => void signOut().catch((e) => toastInvokeCatch("Sign out failed", e))}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="rounded-none"
              disabled={busy}
              onClick={() => void handleSignIn()}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
              Sign in with Google
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="rounded-none"
            disabled={busy || !connected || !enabled}
            onClick={() => void handleSync()}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", busy && "animate-spin")} />
            Sync saves now
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-none"
            disabled={busy || !connected || !enabled}
            onClick={() => void previewPlan().catch((e) => toastInvokeCatch("Preview failed", e))}
          >
            <HardDrive className="mr-2 h-4 w-4" />
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
          <Label htmlFor="conflict-policy">Conflict handling</Label>
          <select
            id="conflict-policy"
            value={cfg?.conflictPolicy ?? "autoNewer"}
            disabled={busy}
            onChange={(e) => void setConfig({ conflictPolicy: e.target.value as ConflictPolicy })}
            className={nativeSelectClassName}
          >
            <option value="autoNewer">{conflictPolicyLabel("autoNewer")}</option>
            <option value="ask">{conflictPolicyLabel("ask")}</option>
          </select>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Smart sync compares checksums and last-sync baseline: only the side that changed uploads
            or downloads. If both changed, newer file wins (auto) or you choose (ask).
          </p>
        </div>

        {status?.lastSyncUtc ? (
          <p className="text-xs text-muted-foreground">
            Last sync: {new Date(status.lastSyncUtc * 1000).toLocaleString()} ·{" "}
            {status.localBundleCount} save location(s) detected locally
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {status?.localBundleCount ?? 0} save location(s) detected (scan library first for best coverage)
          </p>
        )}

        {plan.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Sync plan</h4>
            <ul className="max-h-48 space-y-0 overflow-y-auto pr-1 text-xs">
              {plan.map((p) => (
                <li key={p.bundleId} className="border-b border-border py-2 last:border-b-0">
                  <span className="font-medium text-foreground">{p.gameName}</span>
                  <span className="text-muted-foreground"> — {p.label}</span>
                  <span className="mt-0.5 block capitalize text-foreground">{p.action}</span>
                  <span className="block text-muted-foreground">{p.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {conflicts.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Resolve conflicts</h4>
            <ul className="space-y-2">
              {conflicts.map((c) => (
                <li key={c.bundleId} className="space-y-2 border border-border p-3">
                  <p className="text-sm font-medium text-foreground">
                    {c.gameName} — {c.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Suggested: {c.recommendation === "useCloud" ? "cloud" : "local"} (newer)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="rounded-none"
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
                      className="rounded-none"
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
      </PanelBody>
    </Panel>
  );
}
