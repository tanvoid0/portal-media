import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useShellOverlayStore } from "@/stores/shellOverlayStore";
import { useSessionStore, type AppSession } from "@/stores/sessionStore";
import { appNavigate } from "@/nav/appNavigate";
import { useBrowserStore } from "@/stores/browserStore";
import { cn } from "@/lib/utils";
import { useNavBindingsStore } from "@/stores/navBindingsStore";
import { isProcessRunning } from "@/utils/shellIntegrationApi";
import { snapshotGamepadButtons, anyGamepadButtonJustPressed } from "@/utils/navBindingMatch";
import { feedbackSelect, feedbackTick } from "@/utils/uiFeedback";

/** Standard gamepad: LB / RB cycle switcher tiles. */
const GP_PREV = 4;
const GP_NEXT = 5;

export default function AppSwitcherOverlay() {
  const keyboardNavigationEnabled = useNavBindingsStore((s) => s.keyboardNavigationEnabled);
  const gamepadNavigationEnabled = useNavBindingsStore((s) => s.gamepadNavigationEnabled);
  const appSwitcherOpen = useShellOverlayStore((s) => s.appSwitcherOpen);
  const setAppSwitcherOpen = useShellOverlayStore((s) => s.setAppSwitcherOpen);
  const sessions = useSessionStore((s) => s.sessions);
  const removeSession = useSessionStore((s) => s.removeSession);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const restoreBrowser = useBrowserStore((s) => s.restoreBrowser);
  const browserOpen = useBrowserStore((s) => s.isOpen);
  const browserMin = useBrowserStore((s) => s.isMinimized);

  const [focusIndex, setFocusIndex] = useState(0);
  const [aliveByPid, setAliveByPid] = useState<Record<number, boolean>>({});
  const idxRef = useRef(0);
  const prevGpRef = useRef<boolean[]>(Array.from({ length: 32 }, () => false));
  const currGpRef = useRef<boolean[]>(Array.from({ length: 32 }, () => false));
  const ordered = useMemo(
    () => [...sessions].sort((a, b) => b.startedAt - a.startedAt),
    [sessions]
  );

  const close = useCallback(() => setAppSwitcherOpen(false), [setAppSwitcherOpen]);

  const refreshAlive = useCallback(async () => {
    if (!isTauri()) return;
    const external = sessions.filter((s) => s.kind === "externalGame" && s.pid);
    const next: Record<number, boolean> = {};
    await Promise.all(
      external.map(async (s) => {
        const pid = s.pid!;
        next[pid] = await isProcessRunning(pid);
      })
    );
    setAliveByPid(next);
    for (const s of external) {
      if (s.pid && next[s.pid] === false) {
        removeSession(s.id);
      }
    }
  }, [sessions, removeSession]);

  useEffect(() => {
    if (!appSwitcherOpen) return;
    void refreshAlive();
    const id = window.setInterval(() => void refreshAlive(), 2000);
    return () => window.clearInterval(id);
  }, [appSwitcherOpen, refreshAlive]);

  const sessionAlive = useCallback(
    (s: AppSession): boolean | null => {
      if (s.kind !== "externalGame" || !s.pid) return null;
      return aliveByPid[s.pid] ?? null;
    },
    [aliveByPid]
  );

  const activate = useCallback(
    async (s: AppSession) => {
      feedbackSelect();
      setActiveSession(s.id);
      if (s.kind === "library") {
        appNavigate("/library/all");
        await getCurrentWindow().setFocus();
        close();
        return;
      }
      if (s.kind === "browser") {
        if (browserOpen && browserMin) restoreBrowser();
        await getCurrentWindow().setFocus();
        close();
        return;
      }
      if (s.kind === "externalGame" && s.pid) {
        const alive = await isProcessRunning(s.pid);
        if (!alive) {
          removeSession(s.id);
          appNavigate("/library/all");
          await getCurrentWindow().setFocus();
          close();
          return;
        }
        try {
          await invoke("focus_window_by_pid", { pid: s.pid });
        } catch {
          /* best-effort */
        }
        close();
      }
    },
    [browserMin, browserOpen, close, removeSession, restoreBrowser, setActiveSession]
  );

  useEffect(() => {
    if (!appSwitcherOpen) return;
    const i = Math.max(
      0,
      ordered.findIndex((s) => s.id === activeSessionId)
    );
    setFocusIndex(i);
    idxRef.current = i;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (!useNavBindingsStore.getState().keyboardNavigationEnabled) {
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIndex((fi) => {
          const n = Math.min(ordered.length - 1, fi + 1);
          if (n !== fi) feedbackTick();
          idxRef.current = n;
          return n;
        });
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIndex((fi) => {
          const n = Math.max(0, fi - 1);
          if (n !== fi) feedbackTick();
          idxRef.current = n;
          return n;
        });
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const s = ordered[idxRef.current];
        if (s) void activate(s);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [appSwitcherOpen, activeSessionId, activate, close, ordered, keyboardNavigationEnabled]);

  useEffect(() => {
    if (!appSwitcherOpen || !gamepadNavigationEnabled) return;
    const tick = () => {
      const pads = navigator.getGamepads?.() ?? [];
      const gamepad = pads.find((p) => p?.connected) ?? null;
      if (!gamepad) return;
      const prev = prevGpRef.current;
      const curr = currGpRef.current;
      snapshotGamepadButtons(gamepad, curr, 31);

      if (anyGamepadButtonJustPressed([GP_PREV], prev, curr)) {
        setFocusIndex((fi) => {
          const n = Math.max(0, fi - 1);
          if (n !== fi) feedbackTick();
          idxRef.current = n;
          return n;
        });
      }
      if (anyGamepadButtonJustPressed([GP_NEXT], prev, curr)) {
        setFocusIndex((fi) => {
          const n = Math.min(ordered.length - 1, fi + 1);
          if (n !== fi) feedbackTick();
          idxRef.current = n;
          return n;
        });
      }
      const primary = getNavBindingPrimaryButton();
      if (primary >= 0 && anyGamepadButtonJustPressed([primary], prev, curr)) {
        const s = ordered[idxRef.current];
        if (s) void activate(s);
      }
      prevGpRef.current = [...curr];
    };
    const id = window.setInterval(tick, 50);
    return () => window.clearInterval(id);
  }, [appSwitcherOpen, activate, gamepadNavigationEnabled, ordered]);

  if (!appSwitcherOpen) return null;

  return (
    <div className="fixed inset-0 z-[245]" data-shell-modal>
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-md border-0 w-full cursor-default"
        aria-label="Close app switcher"
        onClick={close}
      />
      <div
        className={cn(
          "absolute bottom-28 left-1/2 -translate-x-1/2 w-[min(92vw,40rem)]",
          "rounded-2xl border border-white/10 bg-card/95 backdrop-blur-xl p-4 shadow-2xl"
        )}
      >
        <div className="flex items-baseline justify-between gap-2 mb-3 px-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Running &amp; recent
          </p>
          <p className="text-[10px] text-muted-foreground/80 font-mono hidden sm:block">
            Ctrl+Shift+Tab
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {ordered.map((s, i) => {
            const alive = sessionAlive(s);
            return (
              <button
                key={s.id}
                type="button"
                className={cn(
                  "shrink-0 min-w-[7rem] max-w-[10rem] rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors",
                  focusIndex === i || activeSessionId === s.id
                    ? "border-primary/60 bg-primary/15 ring-2 ring-primary/40"
                    : "border-border/60 hover:bg-muted/60",
                  alive === false && "opacity-50"
                )}
                onClick={() => {
                  idxRef.current = i;
                  setFocusIndex(i);
                  void activate(s);
                }}
              >
                <span className="line-clamp-2">{s.title}</span>
                <span className="mt-1 flex flex-wrap gap-1 items-center">
                  <span className="text-[10px] uppercase text-muted-foreground">{s.kind}</span>
                  {alive === true ? (
                    <span className="text-[9px] uppercase font-semibold text-emerald-400/90">
                      running
                    </span>
                  ) : null}
                  {alive === false ? (
                    <span className="text-[9px] uppercase font-semibold text-amber-400/90">
                      ended
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground/70 px-1 leading-relaxed">
          Use LB / RB on a controller or arrow keys to move. Select a tile to switch. Ended games
          are removed automatically.
        </p>
      </div>
    </div>
  );
}

function getNavBindingPrimaryButton(): number {
  const b = useNavBindingsStore.getState().actions.primary;
  return b.enabled && b.gamepadButtons.length > 0 ? b.gamepadButtons[0] : 0;
}
