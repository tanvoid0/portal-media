import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useIntegrationsStore } from "@/stores/integrationsStore";
import { useMetadataDisplayStore } from "@/stores/metadataDisplayStore";
import type { Game } from "@/types/game";
import type {
  IgdbFetchResult,
  IgdbGamePayload,
  TmdbDetailPayload,
  TmdbDetailResult,
  TmdbSearchResult,
} from "@/types/metadata";

export type GameMetadataPanel =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "igdb"; payload: IgdbGamePayload }
  | {
      kind: "igdb_gate";
      message: string;
    }
  | {
      kind: "igdb_note";
      message: string;
    }
  | { kind: "tmdb"; payload: TmdbDetailPayload }
  | {
      kind: "tmdb_gate";
      message: string;
    }
  | {
      kind: "tmdb_note";
      message: string;
    }
  | { kind: "not_applicable" };

export function useGameMetadata(game: Game | null): GameMetadataPanel {
  const status = useIntegrationsStore((s) => s.status);
  const refreshStatus = useIntegrationsStore((s) => s.refreshStatus);
  const [panel, setPanel] = useState<GameMetadataPanel>({ kind: "idle" });

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    let cancelled = false;

    if (!game) {
      setPanel({ kind: "idle" });
      return;
    }

    if (game.category === "Game") {
      if (!status.igdbConfigured) {
        setPanel({
          kind: "igdb_gate",
          message:
            "Richer summaries, genres, and cover art from IGDB — add your Twitch app credentials under Settings → Metadata & APIs.",
        });
        return;
      }

      setPanel({ kind: "loading" });
      void invoke<IgdbFetchResult>("metadata_fetch_igdb_for_game", { game }).then((r) => {
        if (cancelled) return;
        if (r.kind === "cached" || r.kind === "fresh") {
          useMetadataDisplayStore.getState().setIgdbCoverForGame(game.id, r.payload.coverUrl);
          setPanel({ kind: "igdb", payload: r.payload });
          return;
        }
        if (r.kind === "notFound" || r.kind === "error") {
          useMetadataDisplayStore.getState().setIgdbCoverForGame(game.id, null);
        }
        if (r.kind === "notConfigured") {
          setPanel({
            kind: "igdb_gate",
            message:
              "IGDB is not configured. Open Settings → Metadata & APIs to add your Twitch Client ID and Secret.",
          });
          return;
        }
        if (r.kind === "skipped") {
          setPanel({ kind: "igdb_note", message: r.reason });
          return;
        }
        if (r.kind === "notFound") {
          setPanel({
            kind: "igdb_note",
            message: "No IGDB match was found for this title. Try renaming the game or clear the metadata cache.",
          });
          return;
        }
        if (r.kind === "error") {
          setPanel({ kind: "igdb_note", message: r.message });
          return;
        }
        setPanel({ kind: "idle" });
      });
      return () => {
        cancelled = true;
      };
    }

    if (game.category === "Media" || game.category === "Bookmark") {
      if (!status.tmdbConfigured) {
        setPanel({
          kind: "tmdb_gate",
          message:
            "Optional: link this bookmark to TMDB movie/TV data — add your TMDB API key under Settings → Metadata & APIs.",
        });
        return;
      }

      const q = game.name.trim();
      if (!q) {
        setPanel({ kind: "tmdb_note", message: "No title to search on TMDB." });
        return;
      }

      setPanel({ kind: "loading" });
      void (async () => {
        try {
          const search = await invoke<TmdbSearchResult>("metadata_tmdb_search", { query: q });
          if (cancelled) return;
          if (search.kind === "notConfigured") {
            setPanel({
              kind: "tmdb_gate",
              message: "TMDB is not configured. Add an API key in Settings.",
            });
            return;
          }
          if (search.kind === "error") {
            setPanel({ kind: "tmdb_note", message: search.message });
            return;
          }
          const hit = search.hits[0];
          if (!hit) {
            setPanel({
              kind: "tmdb_note",
              message: "No TMDB results for this name. Try a different bookmark title in your library.",
            });
            return;
          }
          const detail = await invoke<TmdbDetailResult>("metadata_tmdb_fetch_detail", {
            mediaType: hit.mediaType,
            id: hit.id,
          });
          if (cancelled) return;
          if (detail.kind === "ok") {
            setPanel({ kind: "tmdb", payload: detail.payload });
            return;
          }
          if (detail.kind === "notConfigured") {
            setPanel({ kind: "tmdb_gate", message: "TMDB key missing." });
            return;
          }
          setPanel({ kind: "tmdb_note", message: detail.message });
        } catch (e) {
          if (!cancelled) {
            setPanel({
              kind: "tmdb_note",
              message: e instanceof Error ? e.message : "TMDB request failed",
            });
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }

    setPanel({ kind: "not_applicable" });
    return () => {
      cancelled = true;
    };
  }, [game, status.igdbConfigured, status.tmdbConfigured]);

  return panel;
}
