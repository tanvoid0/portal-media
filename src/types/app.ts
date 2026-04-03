export type AppView = "games" | "settings";

export const ACTIVATE_SIDEBAR_EVENT = "activateSidebar" as const;

/** Open compact search (top bar); SearchBar listens and focuses the field. */
export const OPEN_SHELL_SEARCH_EVENT = "openShellSearch" as const;

/** Collapse search popup when returning to library, etc. */
export const CLOSE_SHELL_SEARCH_EVENT = "closeShellSearch" as const;

export function isActivateSidebarEvent(e: Event): e is CustomEvent<number> {
  return (
    e.type === ACTIVATE_SIDEBAR_EVENT &&
    typeof (e as CustomEvent<number>).detail === "number"
  );
}
