import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { useGameStore } from "@/stores/gameStore";
import { useIntegrationsStore } from "@/stores/integrationsStore";
import { useMetadataDisplayStore } from "@/stores/metadataDisplayStore";
import { useTmdbDiscoverStore } from "@/stores/tmdbDiscoverStore";
import type { EnrichSummary, MetadataTestResult } from "@/types/metadata";
import { KeyRound, Loader2, Trash2 } from "lucide-react";
import { ExternalLinkGlyph } from "@/components/content/ExternalLinkGlyph";
import { toast } from "sonner";
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
      void useTmdbDiscoverStore.getState().load({ force: true });
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
      const useForm = igdbClientId.trim().length > 0 && igdbSecret.trim().length > 0;
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
      void useTmdbDiscoverStore.getState().load({ force: true });
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
    <div id="settings-integrations" className="scroll-mt-4 space-y-6">
      <Panel>
        <PanelHeader>
          <div className="flex items-center gap-2 text-foreground">
            <KeyRound className="h-5 w-5" aria-hidden />
            <PanelTitle>IGDB (Twitch)</PanelTitle>
          </div>
          <PanelDescription>
            Optional IGDB keys for richer game details. Stored in the OS credential store when possible.
            Status:{" "}
            <span className={status.igdbConfigured ? "font-medium text-foreground" : undefined}>
              {status.igdbConfigured ? "credentials saved" : "not configured"}
            </span>
          </PanelDescription>
        </PanelHeader>
        <PanelBody className="space-y-3">
          <div className="flex flex-wrap gap-1">
            <Button type="button" variant="ghost" size="sm" className="rounded-none" onClick={() => openExternal(TWITCH_APPS)}>
              <ExternalLinkGlyph url={TWITCH_APPS} labelHint="Twitch" size="sm" className="mr-1" />
              Register app
            </Button>
            <Button type="button" variant="ghost" size="sm" className="rounded-none" onClick={() => openExternal(IGDB_DOCS)}>
              <ExternalLinkGlyph url={IGDB_DOCS} labelHint="IGDB docs" size="sm" className="mr-1" />
              Docs
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Twitch app Client ID + Secret. Fields clear after save; check status above. Paste new values to replace.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="igdb-client-id">Twitch Client ID</Label>
            <Input
              id="igdb-client-id"
              type="text"
              autoComplete="off"
              placeholder="Twitch Client ID"
              value={igdbClientId}
              onChange={(e) => setIgdbClientId(e.target.value)}
              onInput={(e) => setIgdbClientId((e.target as HTMLInputElement).value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="igdb-secret">Twitch Client Secret</Label>
            <Input
              id="igdb-secret"
              type="password"
              autoComplete="off"
              placeholder="Twitch Client Secret"
              value={igdbSecret}
              onChange={(e) => setIgdbSecret(e.target.value)}
              onInput={(e) => setIgdbSecret((e.target as HTMLInputElement).value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="rounded-none" onClick={() => void saveIgdb()} disabled={igdbBusy}>
              {igdbBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
            <Button type="button" variant="outline" className="rounded-none" onClick={() => void testIgdb()} disabled={igdbBusy}>
              Test connection
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="rounded-none text-destructive hover:text-destructive"
              onClick={() => void clearIgdb()}
              disabled={igdbBusy || !status.igdbConfigured}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Clear
            </Button>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <div className="flex items-center gap-2 text-foreground">
            <KeyRound className="h-5 w-5" aria-hidden />
            <PanelTitle>TMDB</PanelTitle>
          </div>
          <PanelDescription>
            v3 key for movies/TV in details. Empty field after save is normal. Test uses the field if filled, else the saved key.
            Status:{" "}
            <span className={status.tmdbConfigured ? "font-medium text-foreground" : undefined}>
              {status.tmdbConfigured ? "API key saved" : "not configured"}
            </span>
          </PanelDescription>
        </PanelHeader>
        <PanelBody className="space-y-3">
          <div className="flex flex-wrap gap-1">
            <Button type="button" variant="ghost" size="sm" className="rounded-none" onClick={() => openExternal(TMDB_API_SETTINGS)}>
              <ExternalLinkGlyph url={TMDB_API_SETTINGS} labelHint="TMDB" size="sm" className="mr-1" />
              Get API key
            </Button>
            <Button type="button" variant="ghost" size="sm" className="rounded-none" onClick={() => openExternal(TMDB_DOCS)}>
              <ExternalLinkGlyph url={TMDB_DOCS} labelHint="TMDB docs" size="sm" className="mr-1" />
              Docs
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tmdb-key">TMDB API key</Label>
            <Input
              id="tmdb-key"
              type="password"
              autoComplete="off"
              placeholder="TMDB API key (v3 auth)"
              value={tmdbKey}
              onChange={(e) => setTmdbKey(e.target.value)}
              onInput={(e) => setTmdbKey((e.target as HTMLInputElement).value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="rounded-none" onClick={() => void saveTmdb()} disabled={tmdbBusy}>
              {tmdbBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
            <Button type="button" variant="outline" className="rounded-none" onClick={() => void testTmdb()} disabled={tmdbBusy}>
              Test connection
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="rounded-none text-destructive hover:text-destructive"
              onClick={() => void clearTmdb()}
              disabled={tmdbBusy || !status.tmdbConfigured}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Clear
            </Button>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Cache &amp; enrich</PanelTitle>
          <PanelDescription>
            Cache ~30 days. Clear drops stored metadata. Enrich all refetches IGDB for every game (needs IGDB saved).
          </PanelDescription>
        </PanelHeader>
        <PanelBody className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-none" onClick={() => void clearCache()} disabled={cacheBusy}>
            {cacheBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Clear metadata cache
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="rounded-none"
            onClick={() => void enrichAll()}
            disabled={enrichBusy || !status.igdbConfigured}
            title={!status.igdbConfigured ? "Save IGDB credentials first" : undefined}
          >
            {enrichBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Enrich all games (IGDB)
          </Button>
        </PanelBody>
      </Panel>
    </div>
  );
}
