import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "@/components/ui/button";
import { useGameStore } from "@/stores/gameStore";
import { useIntegrationsStore } from "@/stores/integrationsStore";
import { useMetadataDisplayStore } from "@/stores/metadataDisplayStore";
import type { EnrichSummary, MetadataTestResult } from "@/types/metadata";
import {
  BookOpen,
  ExternalLink,
  KeyRound,
  Loader2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { toastInvokeCatch } from "@/utils/invokeError";

const TWITCH_APPS = "https://dev.twitch.tv/console/apps";
const IGDB_DOCS = "https://api-docs.igdb.com/#account-creation";
const TMDB_API_SETTINGS = "https://www.themoviedb.org/settings/api";
const TMDB_DOCS = "https://developer.themoviedb.org/docs/getting-started";

function openExternal(url: string) {
  void openUrl(url).catch(() => toast.error("Could not open browser"));
}

export function MetadataIntegrationsSection() {
  const { status, refreshStatus } = useIntegrationsStore();
  const games = useGameStore((s) => s.games);

  const [igdbClientId, setIgdbClientId] = useState("");
  const [igdbSecret, setIgdbSecret] = useState("");
  const [tmdbKey, setTmdbKey] = useState("");
  const [igdbBusy, setIgdbBusy] = useState(false);
  const [tmdbBusy, setTmdbBusy] = useState(false);
  const [cacheBusy, setCacheBusy] = useState(false);
  const [enrichBusy, setEnrichBusy] = useState(false);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const saveIgdb = useCallback(async () => {
    if (!igdbClientId.trim() || !igdbSecret.trim()) {
      toast.error("Enter both Twitch Client ID and Client Secret.");
      return;
    }
    setIgdbBusy(true);
    try {
      await invoke("metadata_save_igdb_credentials", {
        clientId: igdbClientId.trim(),
        clientSecret: igdbSecret.trim(),
      });
      setIgdbClientId("");
      setIgdbSecret("");
      await refreshStatus();
      if (!useIntegrationsStore.getState().status.igdbConfigured) {
        toastInvokeCatch(
          "IGDB credentials may not have persisted",
          new Error("Status still shows not configured after save.")
        );
        return;
      }
      toast.success("IGDB credentials saved securely");
    } catch (e) {
      toastInvokeCatch("Could not save IGDB credentials", e);
    } finally {
      setIgdbBusy(false);
    }
  }, [igdbClientId, igdbSecret, refreshStatus]);

  const clearIgdb = useCallback(async () => {
    setIgdbBusy(true);
    try {
      await invoke("metadata_clear_igdb_credentials");
      await refreshStatus();
      toast.success("IGDB credentials removed");
    } catch (e) {
      toastInvokeCatch("Could not clear IGDB", e);
    } finally {
      setIgdbBusy(false);
    }
  }, [refreshStatus]);

  const testIgdb = useCallback(async () => {
    setIgdbBusy(true);
    try {
      const useForm =
        igdbClientId.trim().length > 0 && igdbSecret.trim().length > 0;
      const r = useForm
        ? await invoke<MetadataTestResult>("metadata_test_igdb_credentials", {
            clientId: igdbClientId.trim(),
            clientSecret: igdbSecret.trim(),
          })
        : await invoke<MetadataTestResult>("metadata_test_igdb");
      if (r.ok) {
        toast.success(r.message);
        if (!useForm) {
          await refreshStatus();
        }
      } else {
        toast.message("IGDB test", { description: r.message });
      }
    } catch (e) {
      toastInvokeCatch("IGDB test failed", e);
    } finally {
      setIgdbBusy(false);
    }
  }, [igdbClientId, igdbSecret, refreshStatus]);

  const saveTmdb = useCallback(async () => {
    if (!tmdbKey.trim()) {
      toast.error("Enter a TMDB API key.");
      return;
    }
    setTmdbBusy(true);
    try {
      await invoke("metadata_save_tmdb_api_key", { apiKey: tmdbKey.trim() });
      setTmdbKey("");
      await refreshStatus();
      if (!useIntegrationsStore.getState().status.tmdbConfigured) {
        toastInvokeCatch(
          "TMDB key may not have persisted",
          new Error("Status still shows not configured after save. Check the details toast or try again.")
        );
        return;
      }
      toast.success("TMDB API key saved securely");
    } catch (e) {
      toastInvokeCatch("Could not save TMDB key", e);
    } finally {
      setTmdbBusy(false);
    }
  }, [tmdbKey, refreshStatus]);

  const clearTmdb = useCallback(async () => {
    setTmdbBusy(true);
    try {
      await invoke("metadata_clear_tmdb_api_key");
      await refreshStatus();
      toast.success("TMDB key removed");
    } catch (e) {
      toastInvokeCatch("Could not clear TMDB", e);
    } finally {
      setTmdbBusy(false);
    }
  }, [refreshStatus]);

  const testTmdb = useCallback(async () => {
    setTmdbBusy(true);
    try {
      const pending = tmdbKey.trim();
      const r = pending
        ? await invoke<MetadataTestResult>("metadata_test_tmdb_key", {
            apiKey: pending,
          })
        : await invoke<MetadataTestResult>("metadata_test_tmdb");
      if (r.ok) {
        toast.success(r.message);
        if (!pending) {
          await refreshStatus();
        }
      } else {
        toast.message("TMDB test", { description: r.message });
      }
    } catch (e) {
      toastInvokeCatch("TMDB test failed", e);
    } finally {
      setTmdbBusy(false);
    }
  }, [tmdbKey, refreshStatus]);

  const clearCache = useCallback(async () => {
    setCacheBusy(true);
    try {
      await invoke("metadata_clear_cache");
      useMetadataDisplayStore.getState().clearIgdbArtCache();
      toast.success("Local metadata cache cleared");
    } catch (e) {
      toastInvokeCatch("Could not clear cache", e);
    } finally {
      setCacheBusy(false);
    }
  }, []);

  const enrichAll = useCallback(async () => {
    if (!status.igdbConfigured) {
      toast.message("IGDB not configured", {
        description: "Save Twitch credentials above to enrich your library.",
      });
      return;
    }
    setEnrichBusy(true);
    try {
      const summary = await invoke<EnrichSummary>("metadata_enrich_all_games", { games });
      toast.success(
        `Enrichment done: ${summary.refreshed} updated, ${summary.skipped} skipped, ${summary.errors} errors`
      );
    } catch (e) {
      toastInvokeCatch("Enrichment failed", e);
    } finally {
      setEnrichBusy(false);
    }
  }, [games, status.igdbConfigured]);

  return (
    <div id="settings-integrations" className="space-y-4 scroll-mt-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-6 h-6 text-emerald-400" aria-hidden />
        <h3 className="text-xl font-semibold text-white">Metadata &amp; APIs</h3>
      </div>
      <p className="text-white/60 text-sm max-w-3xl">
        Optional: add your own API credentials to unlock richer game details (IGDB via Twitch) and
        movie/TV info (TMDB). Nothing here is required for scanning or launching games. Keys are
        stored with your OS credential manager, not in the browser.
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-6 space-y-4 border border-white/5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-purple-400" aria-hidden />
                IGDB (Twitch)
              </h4>
              <p className="text-white/50 text-xs mt-1">
                Status:{" "}
                <span className={status.igdbConfigured ? "text-emerald-400" : "text-white/40"}>
                  {status.igdbConfigured ? "credentials saved" : "not configured"}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-1 justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-white/70 h-8 px-2"
                onClick={() => openExternal(TWITCH_APPS)}
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Register app
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-white/70 h-8 px-2"
                onClick={() => openExternal(IGDB_DOCS)}
              >
                <BookOpen className="w-4 h-4 mr-1" />
                Docs
              </Button>
            </div>
          </div>

          <p className="text-white/55 text-sm">
            Create a Twitch developer application, then paste its Client ID and Client Secret
            here. Portal uses the official client-credentials flow to read IGDB.
          </p>
          <p className="text-white/40 text-xs leading-relaxed">
            After a successful save, these fields clear on purpose: secrets are not loaded back into
            the UI (reduces exposure in the app and on screen captures). Use the status line above —
            credentials saved — to confirm storage. Paste new values anytime to replace what is
            stored.
          </p>

          <input
            type="text"
            autoComplete="off"
            placeholder="Twitch Client ID"
            value={igdbClientId}
            onChange={(e) => setIgdbClientId(e.target.value)}
            onInput={(e) => setIgdbClientId((e.target as HTMLInputElement).value)}
            className={cn(
              "w-full rounded-lg bg-black/30 border border-white/15 px-3 py-2.5 text-sm text-white",
              "placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-primary/40"
            )}
          />
          <input
            type="password"
            autoComplete="off"
            placeholder="Twitch Client Secret"
            value={igdbSecret}
            onChange={(e) => setIgdbSecret(e.target.value)}
            onInput={(e) => setIgdbSecret((e.target as HTMLInputElement).value)}
            className={cn(
              "w-full rounded-lg bg-black/30 border border-white/15 px-3 py-2.5 text-sm text-white",
              "placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-primary/40"
            )}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void saveIgdb()}
              disabled={igdbBusy}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {igdbBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-white/50 bg-white/5 text-white hover:bg-white/15"
              onClick={() => void testIgdb()}
              disabled={igdbBusy}
            >
              Test connection
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-rose-300 hover:text-rose-200 hover:bg-rose-500/10"
              onClick={() => void clearIgdb()}
              disabled={igdbBusy || !status.igdbConfigured}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>

        <div className="glass rounded-xl p-6 space-y-4 border border-white/5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-sky-400" aria-hidden />
                TMDB
              </h4>
              <p className="text-white/50 text-xs mt-1">
                Status:{" "}
                <span className={status.tmdbConfigured ? "text-emerald-400" : "text-white/40"}>
                  {status.tmdbConfigured ? "API key saved" : "not configured"}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-1 justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-white/70 h-8 px-2"
                onClick={() => openExternal(TMDB_API_SETTINGS)}
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Get API key
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-white/70 h-8 px-2"
                onClick={() => openExternal(TMDB_DOCS)}
              >
                <BookOpen className="w-4 h-4 mr-1" />
                Docs
              </Button>
            </div>
          </div>

          <p className="text-white/55 text-sm">
            Used for movies and TV in the details panel (media bookmarks). Request your own v3 API
            key from TMDB — it is free for personal use. Keys are stored in the OS credential vault
            when possible; if that is blocked (policy, AV, or permissions), Portal falls back to an
            app data JSON file.{" "}
            <span className="text-white/45">
              Test uses whatever you have in the field; if the field is empty, it uses the last saved
              key.
            </span>
          </p>
          <p className="text-white/40 text-xs leading-relaxed">
            The input stays empty after save on purpose — the key is only kept in secure storage, not
            re-displayed here. Status: API key saved means Portal will use it for TMDB. To change
            it, paste a new key and Save again.
          </p>

          <input
            type="password"
            autoComplete="off"
            placeholder="TMDB API key (v3 auth)"
            value={tmdbKey}
            onChange={(e) => setTmdbKey(e.target.value)}
            onInput={(e) => setTmdbKey((e.target as HTMLInputElement).value)}
            className={cn(
              "w-full rounded-lg bg-black/30 border border-white/15 px-3 py-2.5 text-sm text-white",
              "placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-primary/40"
            )}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void saveTmdb()}
              disabled={tmdbBusy}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {tmdbBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-white/50 bg-white/5 text-white hover:bg-white/15"
              onClick={() => void testTmdb()}
              disabled={tmdbBusy}
            >
              Test connection
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-rose-300 hover:text-rose-200 hover:bg-rose-500/10"
              onClick={() => void clearTmdb()}
              disabled={tmdbBusy || !status.tmdbConfigured}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      </div>

      <div className="glass rounded-xl p-6 space-y-3 border border-white/5">
        <h4 className="text-base font-semibold text-white">Cache &amp; batch</h4>
        <p className="text-white/55 text-sm">
          Metadata is cached for 30 days (sidebar details use the cache). Clear the cache to drop
          cached payloads. Enrich all games re-fetches IGDB for every title and ignores the cache
          TTL so you can fix a bad match without waiting (games only).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
            onClick={() => void clearCache()}
            disabled={cacheBusy}
          >
            {cacheBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Clear metadata cache
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="bg-white/10 text-white hover:bg-white/15"
            onClick={() => void enrichAll()}
            disabled={enrichBusy || !status.igdbConfigured}
            title={!status.igdbConfigured ? "Save IGDB credentials first" : undefined}
          >
            {enrichBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Enrich all games (IGDB)
          </Button>
        </div>
      </div>
    </div>
  );
}
