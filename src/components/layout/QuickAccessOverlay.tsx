import { useCallback, useEffect, useRef, useState } from "react";
import { useShellOverlayStore } from "@/stores/shellOverlayStore";
import { appNavigate } from "@/nav/appNavigate";
import { useBrowserStore } from "@/stores/browserStore";
import { cn } from "@/lib/utils";
import { BookOpen, Library, Settings, Rows2, MonitorPlay } from "lucide-react";
import { useSessionStore } from "@/stores/sessionStore";
import { getNavBinding, useNavBindingsStore } from "@/stores/navBindingsStore";
import { snapshotGamepadButtons, anyGamepadButtonJustPressed } from "@/utils/navBindingMatch";
import { getActiveGamepad } from "@/utils/getActiveGamepad";
import { playUiSound } from "@/utils/uiSounds";
import type { NavActionId } from "@/types/navBindings";

const actions = [
  { id: "library", label: "Library", icon: Library },
  { id: "docs", label: "Documentation", icon: BookOpen },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "switcher", label: "App switcher", icon: Rows2 },
  { id: "browser", label: "Resume browser", icon: MonitorPlay },
] as const;

export default function QuickAccessOverlay() {
  const keyboardNavigationEnabled = useNavBindingsStore((s) => s.keyboardNavigationEnabled);
  const gamepadNavigationEnabled = useNavBindingsStore((s) => s.gamepadNavigationEnabled);
  const quickAccessOpen = useShellOverlayStore((s) => s.quickAccessOpen);
  const setQuickAccessOpen = useShellOverlayStore((s) => s.setQuickAccessOpen);
  const toggleAppSwitcher = useShellOverlayStore((s) => s.toggleAppSwitcher);
  const restoreBrowser = useBrowserStore((s) => s.restoreBrowser);
  const isOpen = useBrowserStore((s) => s.isOpen);
  const isMinimized = useBrowserStore((s) => s.isMinimized);
  const upsertLibrarySession = useSessionStore((s) => s.upsertLibrarySession);

  const [focusIndex, setFocusIndex] = useState(0);
  const idxRef = useRef(0);
  const prevGpRef = useRef<boolean[]>(Array.from({ length: 32 }, () => false));
  const currGpRef = useRef<boolean[]>(Array.from({ length: 32 }, () => false));

  const close = useCallback(() => setQuickAccessOpen(false), [setQuickAccessOpen]);

  const runAction = useCallback(
    (id: (typeof actions)[number]["id"]) => {
      if (id === "library") {
        upsertLibrarySession();
        appNavigate("/library/all");
        close();
      }
      if (id === "docs") {
        appNavigate("/docs");
        close();
      }
      if (id === "settings") {
        appNavigate("/settings/game");
        close();
      }
      if (id === "switcher") {
        close();
        toggleAppSwitcher();
      }
      if (id === "browser" && isOpen && isMinimized) {
        restoreBrowser();
        close();
      }
    },
    [close, isOpen, isMinimized, restoreBrowser, toggleAppSwitcher, upsertLibrarySession]
  );

  useEffect(() => {
    if (!quickAccessOpen) return;
    setFocusIndex(0);
    idxRef.current = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (!useNavBindingsStore.getState().keyboardNavigationEnabled) {
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIndex((i) => {
          const n = Math.min(actions.length - 1, i + 1);
          if (n !== i) playUiSound("move");
          idxRef.current = n;
          return n;
        });
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIndex((i) => {
          const n = Math.max(0, i - 1);
          if (n !== i) playUiSound("move");
          idxRef.current = n;
          return n;
        });
      }
      if (e.key === "Enter") {
        e.preventDefault();
        runAction(actions[idxRef.current].id);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [quickAccessOpen, close, runAction, keyboardNavigationEnabled]);

  // Gamepad: `useUnifiedNavigation` yields while this overlay is open
  // (isSpatialNavigationBlocked), so poll here — same pattern as AppSwitcherOverlay.
  useEffect(() => {
    if (!quickAccessOpen || !gamepadNavigationEnabled) return;
    // Seed prev with the current state so the press that opened the overlay
    // is not immediately re-read as "just pressed" (e.g. toggle button closing it).
    const seed = getActiveGamepad();
    if (seed) snapshotGamepadButtons(seed, prevGpRef.current, 31);

    const tick = () => {
      const gamepad = getActiveGamepad();
      if (!gamepad) return;
      const prev = prevGpRef.current;
      const curr = currGpRef.current;
      snapshotGamepadButtons(gamepad, curr, 31);

      const just = (id: NavActionId): boolean => {
        const b = getNavBinding(id);
        return (
          b.enabled &&
          b.gamepadButtons.length > 0 &&
          anyGamepadButtonJustPressed(b.gamepadButtons, prev, curr)
        );
      };

      if (just("spatialDown")) {
        setFocusIndex((i) => {
          const n = Math.min(actions.length - 1, i + 1);
          if (n !== i) playUiSound("move");
          idxRef.current = n;
          return n;
        });
      }
      if (just("spatialUp")) {
        setFocusIndex((i) => {
          const n = Math.max(0, i - 1);
          if (n !== i) playUiSound("move");
          idxRef.current = n;
          return n;
        });
      }
      if (just("primary")) {
        runAction(actions[idxRef.current].id);
      }
      if (just("back") || just("gamepadQuickAccessOverlay")) {
        close();
      }
      prevGpRef.current = [...curr];
    };
    const id = window.setInterval(tick, 50);
    return () => window.clearInterval(id);
  }, [quickAccessOpen, gamepadNavigationEnabled, runAction, close]);

  if (!quickAccessOpen) return null;

  return (
    <div className="fixed inset-0 z-[240]" data-shell-modal>
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm border-0 w-full cursor-default"
        aria-label="Close quick access"
        onClick={close}
      />
      <div
        className={cn(
          "absolute bottom-24 left-1/2 -translate-x-1/2 w-[min(90vw,28rem)]",
          "rounded-2xl border border-white/10 bg-card/95 backdrop-blur-xl p-4 shadow-2xl"
        )}
      >
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3 px-1">
          Quick access
        </p>
        <div className="flex flex-col gap-1">
          {actions.map((a, i) => {
            const Icon = a.icon;
            const disabled = a.id === "browser" && !(isOpen && isMinimized);
            return (
              <button
                key={a.id}
                type="button"
                disabled={disabled}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition-colors",
                  disabled ? "opacity-40 pointer-events-none" : "hover:bg-muted/80",
                  focusIndex === i && "ring-2 ring-primary/60 bg-muted/30"
                )}
                onClick={() => {
                  idxRef.current = i;
                  setFocusIndex(i);
                  runAction(a.id);
                }}
              >
                <Icon className="w-5 h-5 shrink-0 opacity-80" />
                {a.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
