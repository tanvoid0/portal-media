import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useShellOverlayStore } from "@/stores/shellOverlayStore";
import { useSessionStore, type AppSession } from "@/stores/sessionStore";
import { appNavigate } from "@/nav/appNavigate";
import { useBrowserStore } from "@/stores/browserStore";
import { cn } from "@/lib/utils";

export default function AppSwitcherOverlay() {
  const appSwitcherOpen = useShellOverlayStore((s) => s.appSwitcherOpen);
  const setAppSwitcherOpen = useShellOverlayStore((s) => s.setAppSwitcherOpen);
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const restoreBrowser = useBrowserStore((s) => s.restoreBrowser);
  const browserOpen = useBrowserStore((s) => s.isOpen);
  const browserMin = useBrowserStore((s) => s.isMinimized);

  const [focusIndex, setFocusIndex] = useState(0);
  const idxRef = useRef(0);
  const ordered = useMemo(
    () => [...sessions].sort((a, b) => b.startedAt - a.startedAt),
    [sessions]
  );

  const close = useCallback(() => setAppSwitcherOpen(false), [setAppSwitcherOpen]);

  const activate = useCallback(
    async (s: AppSession) => {
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
        try {
          await invoke("focus_window_by_pid", { pid: s.pid });
        } catch {
          /* best-effort */
        }
        close();
      }
    },
    [browserMin, browserOpen, close, restoreBrowser, setActiveSession]
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
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIndex((fi) => {
          const n = Math.min(ordered.length - 1, fi + 1);
          idxRef.current = n;
          return n;
        });
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIndex((fi) => {
          const n = Math.max(0, fi - 1);
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
  }, [appSwitcherOpen, activeSessionId, activate, close, ordered]);

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
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3 px-1">
          Running &amp; recent
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {ordered.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={cn(
                "shrink-0 min-w-[7rem] max-w-[10rem] rounded-xl border px-3 py-3 text-left text-sm font-medium transition-colors",
                focusIndex === i || activeSessionId === s.id
                  ? "border-primary/60 bg-primary/15 ring-2 ring-primary/40"
                  : "border-border/60 hover:bg-muted/60"
              )}
              onClick={() => {
                idxRef.current = i;
                setFocusIndex(i);
                void activate(s);
              }}
            >
              <span className="line-clamp-2">{s.title}</span>
              <span className="mt-1 block text-[10px] uppercase text-muted-foreground">{s.kind}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
