import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookmarkManager } from "@/components/BookmarkManager";
import { LibraryManualAddSection } from "@/components/LibraryManualAddSection";
import { useGameStore } from "@/stores/gameStore";
import { useSyncStore, Platform } from "@/stores/syncStore";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Cloud,
  LogIn,
  LogOut,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const platformConfig: Record<
  Platform,
  { iconUrl: string; color: string; bgColor: string; borderColor: string; name: string }
> = {
  Steam: {
    iconUrl: "https://www.google.com/s2/favicons?domain=store.steampowered.com&sz=128",
    color: "#1b2838",
    bgColor: "bg-[#1b2838]/30",
    borderColor: "border-[#66c0f4]/30",
    name: "Steam",
  },
  "Epic Games": {
    iconUrl: "https://www.google.com/s2/favicons?domain=epicgames.com&sz=128",
    color: "#313131",
    bgColor: "bg-[#313131]/30",
    borderColor: "border-[#ffffff]/30",
    name: "Epic Games",
  },
  GOG: {
    iconUrl: "https://www.google.com/s2/favicons?domain=gog.com&sz=128",
    color: "#86328c",
    bgColor: "bg-[#86328c]/30",
    borderColor: "border-[#cd7f32]/30",
    name: "GOG",
  },
  Ubisoft: {
    iconUrl: "https://www.google.com/s2/favicons?domain=ubisoft.com&sz=128",
    color: "#0078f2",
    bgColor: "bg-[#0078f2]/30",
    borderColor: "border-[#00d4ff]/30",
    name: "Ubisoft Connect",
  },
  Xbox: {
    iconUrl: "https://www.google.com/s2/favicons?domain=xbox.com&sz=128",
    color: "#107c10",
    bgColor: "bg-[#107c10]/30",
    borderColor: "border-[#52b043]/30",
    name: "Xbox",
  },
};

function PlatformIcon({ platform }: { platform: Platform }) {
  const config = platformConfig[platform];

  const borderColorMap: Record<Platform, string> = {
    Steam: "#66c0f440",
    "Epic Games": "#ffffff40",
    GOG: "#cd7f3240",
    Ubisoft: "#00d4ff40",
    Xbox: "#52b04340",
  };

  return (
    <div
      className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all overflow-hidden",
        config.bgColor
      )}
      style={{ borderColor: borderColorMap[platform] }}
    >
      <img
        src={config.iconUrl}
        alt={platform}
        className="w-8 h-8 object-contain"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.style.display = "none";
          const parent = target.parentElement;
          if (parent) {
            parent.innerHTML = `<div class="w-8 h-8 rounded-full" style="background-color: ${config.color}"></div>`;
          }
        }}
      />
    </div>
  );
}

function PlatformSyncCard({ platform }: { platform: Platform }) {
  const { platforms, connectPlatform, disconnectPlatform, syncPlatform } = useSyncStore();
  const status = platforms[platform];

  return (
    <div className="glass rounded-xl p-4 sm:p-5 space-y-3 border border-white/5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <PlatformIcon platform={platform} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-base font-semibold text-white truncate">{platformConfig[platform].name}</h4>
              {status.isConnected ? (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-white/40" />
              )}
            </div>
          </div>
        </div>
        {status.isConnected && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void disconnectPlatform(platform)}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Disconnect
          </Button>
        )}
      </div>

      {status.isConnected ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/60">Games synced:</span>
            <span className="text-white font-medium">{status.gameCount}</span>
          </div>
          {status.lastSync && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Last sync:</span>
              <span className="text-white/80">{new Date(status.lastSync).toLocaleString()}</span>
            </div>
          )}
          {status.error && (
            <div className="flex items-start gap-2 text-sm text-yellow-400 bg-yellow-400/10 rounded-lg p-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span className="flex-1">{status.error}</span>
            </div>
          )}
          <Button
            onClick={() => void syncPlatform(platform)}
            disabled={status.isSyncing}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Cloud className={cn("mr-2 w-4 h-4", status.isSyncing && "animate-spin")} />
            {status.isSyncing ? "Syncing..." : "Sync Now"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-white/50 text-xs">
            Local install detection only — no cloud library sync yet.
          </p>
          {status.error && (
            <div className="flex items-center gap-2 text-sm text-yellow-400 bg-yellow-400/10 rounded-lg p-2">
              <AlertCircle className="w-4 h-4" />
              <span>{status.error}</span>
            </div>
          )}
          <Button
            onClick={() => void connectPlatform(platform)}
            disabled={status.isSyncing}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <LogIn className={cn("mr-2 w-4 h-4", status.isSyncing && "animate-spin")} />
            {status.isSyncing ? "Detecting..." : "Detect Installation"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ArchivedLibraryCard() {
  const archivedGames = useGameStore((s) => s.archivedGames);
  const unarchiveGame = useGameStore((s) => s.unarchiveGame);

  return (
    <div className="glass rounded-xl p-4 sm:p-5 space-y-3 border border-white/5">
      <div>
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <Archive className="w-4 h-4 text-white/80 shrink-0" aria-hidden />
          Archived
        </h3>
        <p className="text-white/50 text-xs mt-0.5">
          Hidden from the library until restored. Per-tab hide lives in item details.
        </p>
      </div>
      {archivedGames.length === 0 ? (
        <p className="text-white/50 text-sm">No archived items.</p>
      ) : (
        <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {archivedGames.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-white/5 border border-white/10 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{g.name}</p>
                <p className="text-xs text-white/50 truncate">
                  {g.platform} · {g.category}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="shrink-0 text-foreground"
                onClick={() => unarchiveGame(g.id)}
              >
                Restore
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SettingsGamePage() {
  const { scanGames, isLoading } = useGameStore();
  const { syncAllPlatforms, platforms } = useSyncStore();
  const connectedPlatforms = Object.values(platforms).filter((p) => p.isConnected);
  const hasConnectedPlatforms = connectedPlatforms.length > 0;

  return (
    <>
      <Card className="glass-dark border-white/10">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-2xl font-semibold tracking-tight text-white">Library &amp; platforms</CardTitle>
          <CardDescription className="text-white/55 text-sm">
            Scan disk, manage platforms, restore archived titles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-0">
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-white/90 uppercase tracking-wide">Library</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void scanGames()}
                disabled={isLoading}
                className="h-10 px-5 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <RefreshCw className={isLoading ? "animate-spin mr-2 w-4 h-4" : "mr-2 w-4 h-4"} />
                {isLoading ? "Scanning…" : "Scan for games"}
              </Button>
              {hasConnectedPlatforms && (
                <Button
                  onClick={() => void syncAllPlatforms()}
                  variant="outline"
                  className="h-10 px-5 text-sm font-medium border-white/20 text-white hover:bg-white/10"
                >
                  <Cloud className="mr-2 w-4 h-4" />
                  Sync all platforms
                </Button>
              )}
            </div>
          </div>

          <ArchivedLibraryCard />

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-white/90 uppercase tracking-wide">Platforms</h3>
              {hasConnectedPlatforms && (
                <span className="text-xs text-white/50 tabular-nums">
                  {connectedPlatforms.length} connected
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PlatformSyncCard platform="Steam" />
              <PlatformSyncCard platform="Epic Games" />
              <PlatformSyncCard platform="GOG" />
              <PlatformSyncCard platform="Ubisoft" />
              <PlatformSyncCard platform="Xbox" />
            </div>
          </div>
        </CardContent>
      </Card>
      <LibraryManualAddSection />
      <BookmarkManager />
    </>
  );
}
