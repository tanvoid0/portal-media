import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGameStore } from "@/stores/gameStore";
import { useSyncStore, Platform } from "@/stores/syncStore";
import { useTheme } from "@/hooks/useTheme";
import { THEME_IDS, type ThemeId } from "@/types/theme";
import { RefreshCw, LogIn, LogOut, Cloud, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const THEME_LABELS: Record<ThemeId, string> = {
  her: "Her",
  ocean: "Ocean",
  playstation: "PlayStation",
  xbox: "Xbox",
  steam: "Steam",
  netflix: "Netflix",
};

// Platform-specific icons, colors, and branding
const platformConfig: Record<Platform, { 
  iconUrl: string;
  color: string; 
  bgColor: string;
  borderColor: string;
  name: string;
}> = {
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
  
  // Extract color from borderColor class for inline style
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
          // Fallback to a simple colored circle if icon fails to load
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
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

  const handleConnect = async () => {
    await connectPlatform(platform);
  };

  const handleDisconnect = async () => {
    await disconnectPlatform(platform);
  };

  const handleSync = async () => {
    await syncPlatform(platform);
  };

  return (
    <div className="glass rounded-xl p-6 space-y-4 border border-white/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PlatformIcon platform={platform} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-lg font-semibold text-white">{platformConfig[platform].name}</h4>
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
            onClick={handleDisconnect}
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
              <span className="text-white/80">
                {new Date(status.lastSync).toLocaleString()}
              </span>
            </div>
          )}
          {status.error && (
            <div className="flex items-start gap-2 text-sm text-yellow-400 bg-yellow-400/10 rounded-lg p-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span className="flex-1">{status.error}</span>
            </div>
          )}
          <Button
            onClick={handleSync}
            disabled={status.isSyncing}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Cloud className={cn("mr-2 w-4 h-4", status.isSyncing && "animate-spin")} />
            {status.isSyncing ? "Syncing..." : "Sync Now"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-white/60 text-sm">
            Detect {platform} installation and scan for locally installed games. Full library sync with API authentication is not yet implemented.
          </p>
          {status.error && (
            <div className="flex items-center gap-2 text-sm text-yellow-400 bg-yellow-400/10 rounded-lg p-2">
              <AlertCircle className="w-4 h-4" />
              <span>{status.error}</span>
            </div>
          )}
          <Button
            onClick={handleConnect}
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

export function Settings() {
  const { scanGames, isLoading } = useGameStore();
  const { themeId, setThemeId } = useTheme();
  const { syncAllPlatforms, platforms } = useSyncStore();
  const connectedPlatforms = Object.values(platforms).filter((p) => p.isConnected);
  const hasConnectedPlatforms = connectedPlatforms.length > 0;

  const handleSyncAll = async () => {
    await syncAllPlatforms();
  };

  return (
    <Card className="glass-dark border-white/10">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-white">Settings</CardTitle>
        <CardDescription className="text-white/60">Manage your game library and preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-white">Game Library</h3>
          <div className="space-y-3">
            <Button
              onClick={scanGames}
              disabled={isLoading}
              className="h-12 px-8 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <RefreshCw className={isLoading ? "animate-spin mr-2 w-5 h-5" : "mr-2 w-5 h-5"} />
              {isLoading ? "Scanning..." : "Scan for Installed Games"}
            </Button>
            {hasConnectedPlatforms && (
              <Button
                onClick={handleSyncAll}
                variant="outline"
                className="h-12 px-8 text-base font-semibold border-white/20 text-white hover:bg-white/10"
              >
                <Cloud className="mr-2 w-5 h-5" />
                Sync All Platforms
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-white">Appearance</h3>
          <p className="text-white/60 text-sm">
            UI theme (colors, typography, corners, shadows on cards, buttons, and inputs). Light/dark mode is toggled from the top bar.
          </p>
          <div className="flex flex-wrap gap-2">
            {THEME_IDS.map((id) => (
              <Button
                key={id}
                type="button"
                variant={themeId === id ? "default" : "outline"}
                size="sm"
                onClick={() => setThemeId(id)}
                className={cn(
                  themeId !== id &&
                    "border-white/20 text-white hover:bg-white/10 bg-transparent"
                )}
              >
                {THEME_LABELS[id]}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">Platform Sync</h3>
            {hasConnectedPlatforms && (
              <span className="text-sm text-white/60">
                {connectedPlatforms.length} platform{connectedPlatforms.length !== 1 ? "s" : ""} connected
              </span>
            )}
          </div>
          <p className="text-white/60 text-sm">
            Detect installed gaming platforms and scan for locally installed games. Note: Full library sync with API authentication is not yet implemented - this only detects locally installed games.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PlatformSyncCard platform="Steam" />
            <PlatformSyncCard platform="Epic Games" />
            <PlatformSyncCard platform="GOG" />
            <PlatformSyncCard platform="Ubisoft" />
            <PlatformSyncCard platform="Xbox" />
          </div>
        </div>
        
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-white">Controller</h3>
          <div className="glass rounded-xl p-6 space-y-3">
            <p className="text-white/80">
              On the library screen, use D-pad or left stick to move, A to launch, B to go back. On this
              settings screen, use Tab to move between controls; Escape or B returns to the library, Menu
              (Start) jumps home, and the Home key always opens the library.
            </p>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <p className="text-white/60 text-sm font-medium">Navigation</p>
                <p className="text-white/40 text-xs">D-pad or Left Stick</p>
              </div>
              <div className="space-y-2">
                <p className="text-white/60 text-sm font-medium">Launch</p>
                <p className="text-white/40 text-xs">A/X Button</p>
              </div>
              <div className="space-y-2">
                <p className="text-white/60 text-sm font-medium">Back</p>
                <p className="text-white/40 text-xs">B/Circle or Escape</p>
              </div>
              <div className="space-y-2">
                <p className="text-white/60 text-sm font-medium">Menu / Home</p>
                <p className="text-white/40 text-xs">Start — sidebar; from Settings, library</p>
              </div>
              <div className="space-y-2">
                <p className="text-white/60 text-sm font-medium">Search (library)</p>
                <p className="text-white/40 text-xs">/ key or Y / Triangle</p>
              </div>
              <div className="space-y-2">
                <p className="text-white/60 text-sm font-medium">Shell focus (library)</p>
                <p className="text-white/40 text-xs">Tab — rail, categories, grid</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

