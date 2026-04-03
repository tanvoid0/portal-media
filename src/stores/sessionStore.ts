import { create } from "zustand";

export type SessionKind = "library" | "browser" | "externalGame";

export interface AppSession {
  id: string;
  kind: SessionKind;
  title: string;
  gameId?: string;
  pid?: number;
  startedAt: number;
}

interface SessionStore {
  sessions: AppSession[];
  activeSessionId: string | null;
  upsertLibrarySession: () => void;
  upsertBrowserSession: (title?: string) => void;
  pushExternalGameSession: (gameId: string, title: string, pid?: number) => void;
  setActiveSession: (id: string) => void;
  removeSession: (id: string) => void;
}

const LIBRARY_ID = "session_library";

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [{ id: LIBRARY_ID, kind: "library", title: "Library", startedAt: Date.now() }],
  activeSessionId: LIBRARY_ID,

  upsertLibrarySession: () => {
    const { sessions } = get();
    const has = sessions.some((s) => s.id === LIBRARY_ID);
    set({
      sessions: has
        ? sessions
        : [...sessions, { id: LIBRARY_ID, kind: "library", title: "Library", startedAt: Date.now() }],
      activeSessionId: LIBRARY_ID,
    });
  },

  upsertBrowserSession: (title = "Browser") => {
    const browserId = "session_browser";
    const { sessions } = get();
    const next: AppSession = {
      id: browserId,
      kind: "browser",
      title,
      startedAt: Date.now(),
    };
    const rest = sessions.filter((s) => s.id !== browserId);
    set({ sessions: [...rest, next], activeSessionId: browserId });
  },

  pushExternalGameSession: (gameId, title, pid) => {
    const id = `session_game_${gameId}`;
    const { sessions } = get();
    const next: AppSession = {
      id,
      kind: "externalGame",
      title,
      gameId,
      pid,
      startedAt: Date.now(),
    };
    const rest = sessions.filter((s) => s.id !== id);
    set({ sessions: [...rest, next], activeSessionId: id });
  },

  setActiveSession: (id) => set({ activeSessionId: id }),

  removeSession: (id) => {
    if (id === LIBRARY_ID) return;
    const { sessions, activeSessionId } = get();
    const next = sessions.filter((s) => s.id !== id);
    set({
      sessions: next.length ? next : [{ id: LIBRARY_ID, kind: "library", title: "Library", startedAt: Date.now() }],
      activeSessionId: activeSessionId === id ? LIBRARY_ID : activeSessionId,
    });
  },
}));
