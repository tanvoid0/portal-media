import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useSpotifyStore } from "@/stores/spotifyStore";
import { Music2, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SPOTIFY_DEV_URL = "https://developer.spotify.com/dashboard";

export function SpotifyConnect() {
  const { checkAuth, authLoading } = useSpotifyStore();
  const [clientId, setClientId] = useState("");
  const [savedClientId, setSavedClientId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [waitingCallback, setWaitingCallback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void invoke<string | null>("spotify_get_client_id").then(setSavedClientId).catch(() => {});
  }, []);

  // Poll for auth completion when waiting
  useEffect(() => {
    if (!waitingCallback) return;
    const interval = setInterval(async () => {
      try {
        const configured = await invoke<boolean>("spotify_is_configured");
        if (configured) {
          setWaitingCallback(false);
          await checkAuth();
        }
      } catch {
        //
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [waitingCallback, checkAuth]);

  const connect = useCallback(async () => {
    const id = clientId.trim() || savedClientId?.trim();
    if (!id) {
      setError("Enter your Spotify Client ID first.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const authUrl = await invoke<string>("spotify_start_auth", { clientId: id });
      await openUrl(authUrl);
      setWaitingCallback(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setConnecting(false);
    }
  }, [clientId, savedClientId]);

  return (
    <div className="flex-1 flex items-center justify-center bg-[#0a0a0a]">
      <div className="max-w-md w-full px-6 py-10 text-center">
        {/* Logo */}
        <div className="w-20 h-20 rounded-2xl bg-[#1db954] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#1db954]/20">
          <Music2 className="w-10 h-10 text-black" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Connect Spotify</h1>
        <p className="text-white/45 text-sm mb-8 leading-relaxed">
          Use your existing Spotify account — browse your library, control playback, and more.
          Requires a free Spotify Developer app for the Client ID.
        </p>

        {/* Steps */}
        <div className="text-left bg-white/4 rounded-xl p-5 mb-6 space-y-3">
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Setup</p>
          <div className="flex gap-3 text-sm text-white/65">
            <span className="w-5 h-5 rounded-full bg-[#1db954]/20 text-[#1db954] text-xs flex items-center justify-center shrink-0 mt-0.5">1</span>
            <span>
              Go to{" "}
              <button
                onClick={() => void openUrl(SPOTIFY_DEV_URL)}
                className="text-[#1db954] hover:underline inline-flex items-center gap-0.5"
              >
                Spotify Developer Dashboard <ExternalLink className="w-3 h-3" />
              </button>{" "}
              and create an app
            </span>
          </div>
          <div className="flex gap-3 text-sm text-white/65">
            <span className="w-5 h-5 rounded-full bg-[#1db954]/20 text-[#1db954] text-xs flex items-center justify-center shrink-0 mt-0.5">2</span>
            <span>Add <code className="bg-white/10 px-1 rounded text-xs text-white/80">http://127.0.0.1</code> as a Redirect URI (any port)</span>
          </div>
          <div className="flex gap-3 text-sm text-white/65">
            <span className="w-5 h-5 rounded-full bg-[#1db954]/20 text-[#1db954] text-xs flex items-center justify-center shrink-0 mt-0.5">3</span>
            <span>Copy your Client ID below and click Connect</span>
          </div>
        </div>

        {savedClientId && !clientId && (
          <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 mb-4 text-sm text-white/60">
            <CheckCircle2 className="w-4 h-4 text-[#1db954] shrink-0" />
            Client ID saved: <span className="font-mono text-xs">{savedClientId.slice(0, 8)}…</span>
          </div>
        )}

        <input
          type="text"
          placeholder={savedClientId ? "Spotify Client ID (saved — paste to update)" : "Spotify Client ID"}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void connect()}
          className={cn(
            "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm",
            "placeholder:text-white/25 focus:outline-none focus:border-[#1db954]/50 transition-colors mb-4"
          )}
        />

        {error && (
          <p className="text-rose-400 text-sm mb-4 bg-rose-500/10 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          onClick={() => void connect()}
          disabled={connecting || waitingCallback || authLoading || (!clientId.trim() && !savedClientId)}
          className={cn(
            "w-full py-3 rounded-xl font-semibold text-sm transition-all",
            "bg-[#1db954] hover:bg-[#1ed760] text-black",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "flex items-center justify-center gap-2"
          )}
        >
          {connecting || authLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : null}
          {waitingCallback
            ? "Waiting for authorization…"
            : connecting
            ? "Opening browser…"
            : authLoading
            ? "Checking…"
            : "Connect Spotify"}
        </button>

        {waitingCallback && (
          <p className="text-white/35 text-xs mt-4">
            Authorize in the browser, then return here. This window will update automatically.
          </p>
        )}
      </div>
    </div>
  );
}
