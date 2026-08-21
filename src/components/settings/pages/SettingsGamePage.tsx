import { BookmarkManager } from "@/components/BookmarkManager";
import { LibraryManualAddSection } from "@/components/LibraryManualAddSection";
import { SaveCloudSyncSection } from "@/components/settings/SaveCloudSyncSection";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { appNavigate } from "@/nav/appNavigate";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/stores/gameStore";
import { useSyncStore, Platform } from "@/stores/syncStore";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Cloud,
  HardDrive,
  LogIn,
  LogOut,
  RefreshCw,
  XCircle,
} from "lucide-react";

const platformConfig: Record<Platform, { iconUrl: string; name: string }> = {
  Steam: {
    iconUrl: "https://www.google.com/s2/favicons?domain=store.steampowered.com&sz=128",
    name: "Steam",
  },
  "Epic Games": {
    iconUrl: "https://www.google.com/s2/favicons?domain=epicgames.com&sz=128",
    name: "Epic Games",
  },
  GOG: {
    iconUrl: "https://www.google.com/s2/favicons?domain=gog.com&sz=128",
    name: "GOG",
  },
  Ubisoft: {
    iconUrl: "https://www.google.com/s2/favicons?domain=ubisoft.com&sz=128",
    name: "Ubisoft Connect",
  },
  Xbox: {
    iconUrl: "https://www.google.com/s2/favicons?domain=xbox.com&sz=128",
    name: "Xbox",
  },
};

function PlatformIcon({ platform }: { platform: Platform }) {
  const config = platformConfig[platform];

  return (
    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-none border-2 border-border bg-muted">
      <img
        src={config.iconUrl}
        alt=""
        className="h-8 w-8 object-contain"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.style.display = "none";
        }}
      />
    </div>
  );
}

function PlatformSyncRow({ platform }: { platform: Platform }) {
  const { platforms, connectPlatform, authenticatePlatform, disconnectPlatform, syncPlatform } =
    useSyncStore();
  const status = platforms[platform];

  return (
    <div className="space-y-3 border-b border-border py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <PlatformIcon platform={platform} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="truncate text-base font-semibold text-foreground">
                {platformConfig[platform].name}
              </h4>
              {status.isConnected ? (
                <CheckCircle2 className="h-5 w-5 text-foreground" aria-label="Connected" />
              ) : (
                <XCircle className="h-5 w-5 text-muted-foreground" aria-label="Not connected" />
              )}
            </div>
            {status.isConnected && status.userProfile ? (
              <div className="mt-0.5 flex items-center gap-1.5">
                {status.userProfile.avatarUrl ? (
                  <img
                    src={status.userProfile.avatarUrl}
                    alt=""
                    className="h-4 w-4 rounded-none border border-border"
                  />
                ) : (
                  <div className="h-4 w-4 rounded-none border border-border bg-muted" />
                )}
                <span className="truncate text-xs text-muted-foreground">
                  Connected as{" "}
                  <span className="font-medium text-foreground">{status.userProfile.displayName}</span>
                </span>
              </div>
            ) : null}
          </div>
        </div>
        {status.isConnected ? (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-none"
            onClick={() => void disconnectPlatform(platform)}
          >
            <LogOut className="h-4 w-4" />
            Disconnect
          </Button>
        ) : null}
      </div>

      {status.isConnected ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Games synced:</span>
            <span className="font-medium text-foreground">{status.gameCount}</span>
          </div>
          {status.lastSync ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last sync:</span>
              <span className="text-foreground">{new Date(status.lastSync).toLocaleString()}</span>
            </div>
          ) : null}
          {status.error ? (
            <div className="flex items-start gap-2 rounded-none border border-destructive/40 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">{status.error}</span>
            </div>
          ) : null}
          <Button
            variant="outline"
            className="w-full rounded-none"
            onClick={() => void syncPlatform(platform)}
            disabled={status.isSyncing}
          >
            <Cloud className={cn("h-4 w-4", status.isSyncing && "animate-spin")} />
            {status.isSyncing ? "Syncing..." : "Sync Now"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Connect your account to sync your full library and metadata.
          </p>
          {status.error ? (
            <div className="flex items-center gap-2 rounded-none border border-destructive/40 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{status.error}</span>
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-none"
              onClick={() => void authenticatePlatform(platform)}
              disabled={status.isSyncing}
            >
              <LogIn className={cn("h-4 w-4", status.isSyncing && "animate-spin")} />
              {status.isSyncing ? "Connecting..." : "Login"}
            </Button>
            <Button
              variant="outline"
              className="flex-1 rounded-none"
              onClick={() => void connectPlatform(platform)}
              disabled={status.isSyncing}
            >
              <RefreshCw className={cn("h-4 w-4", status.isSyncing && "animate-spin")} />
              {status.isSyncing ? "Detecting..." : "Detect Local"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ArchivedLibraryPanel() {
  const archivedGames = useGameStore((s) => s.archivedGames);
  const unarchiveGame = useGameStore((s) => s.unarchiveGame);

  return (
    <Panel>
      <PanelHeader>
        <div className="flex items-center gap-2 text-foreground">
          <Archive className="h-4 w-4 shrink-0" aria-hidden />
          <PanelTitle>Archived</PanelTitle>
        </div>
        <PanelDescription>
          Hidden from the library until restored. Per-tab hide lives in item details.
        </PanelDescription>
      </PanelHeader>
      <PanelBody>
        {archivedGames.length === 0 ? (
          <p className="text-sm text-muted-foreground">No archived items.</p>
        ) : (
          <ul className="max-h-64 space-y-0 overflow-y-auto pr-1">
            {archivedGames.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{g.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {g.platform} · {g.category}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="shrink-0 rounded-none"
                  onClick={() => unarchiveGame(g.id)}
                >
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        )}
      </PanelBody>
    </Panel>
  );
}

export function SettingsGamePage() {
  const { scanGames, isLoading } = useGameStore();
  const { syncAllPlatforms, platforms } = useSyncStore();
  const connectedPlatforms = Object.values(platforms).filter((p) => p.isConnected);
  const hasConnectedPlatforms = connectedPlatforms.length > 0;

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader>
          <PanelTitle>Library &amp; platforms</PanelTitle>
          <PanelDescription>Scan disk, manage platforms, restore archived titles.</PanelDescription>
        </PanelHeader>
        <PanelBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              className="h-10 rounded-none px-5"
              onClick={() => void scanGames()}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              {isLoading ? "Scanning…" : "Scan for games"}
            </Button>
            {hasConnectedPlatforms ? (
              <Button
                variant="outline"
                className="h-10 rounded-none px-5"
                onClick={() => void syncAllPlatforms()}
              >
                <Cloud className="h-4 w-4" />
                Sync all platforms
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-none px-5"
              onClick={() => appNavigate("/settings/saves")}
            >
              <HardDrive className="h-4 w-4" aria-hidden />
              Save data explorer
            </Button>
          </div>
        </PanelBody>
      </Panel>

      <ArchivedLibraryPanel />

      <Panel>
        <PanelHeader>
          <div className="flex items-center justify-between gap-2">
            <PanelTitle>Platforms</PanelTitle>
            {hasConnectedPlatforms ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {connectedPlatforms.length} connected
              </span>
            ) : null}
          </div>
        </PanelHeader>
        <PanelBody>
          <PlatformSyncRow platform="Steam" />
          <PlatformSyncRow platform="Epic Games" />
          <PlatformSyncRow platform="GOG" />
          <PlatformSyncRow platform="Ubisoft" />
          <PlatformSyncRow platform="Xbox" />
        </PanelBody>
      </Panel>

      <SaveCloudSyncSection />
      <LibraryManualAddSection />
      <BookmarkManager />
    </div>
  );
}
