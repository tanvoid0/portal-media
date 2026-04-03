# Cloud library sync (future work)

Portal Media today discovers **locally installed** titles by reading launcher data on disk (Steam libraries, Epic manifests, GOG Galaxy DB, etc.). Optional **IGDB** and **TMDB** credentials add metadata only; they do not pull full online libraries.

A Playnite-style **cloud sync** layer would add, per store:

- **Owned-but-not-installed** titles
- **Play time / last played** (where the store exposes it)
- **Wishlists** or subscriptions (store-dependent)

## Likely building blocks

| Store | Direction | Notes |
|-------|-----------|--------|
| Steam | Steam Web API with per-user API key | Documented; rate limits; key from user |
| Epic | OAuth / unofficial patterns | Higher effort; ToS-sensitive |
| GOG | Galaxy / public APIs | Mixed; often needs auth |
| Xbox | Microsoft identity | OAuth-heavy |

## Suggested approach

1. Keep each integration behind **its own Settings card** with user-supplied tokens (same UX pattern as Metadata & APIs).
2. Persist a **local library database** (SQLite) merging install scan + optional cloud rows, with clear “installed” vs “owned” badges in the UI.
3. Ship **one store at a time**, starting with Steam Web API if demand is highest.

This file is a roadmap only; no cloud OAuth is implemented in the current codebase.
