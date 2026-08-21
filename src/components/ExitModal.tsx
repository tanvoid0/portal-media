import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from "./ui/panel";
import { cn } from "@/lib/utils";
import { DoorOpen, Moon, Power, RotateCcw } from "lucide-react";
import { getNavBinding, useNavBindingsStore } from "@/stores/navBindingsStore";
import { snapshotGamepadButtons, anyGamepadButtonJustPressed } from "@/utils/navBindingMatch";
import { getActiveGamepad } from "@/utils/getActiveGamepad";
import { toastInvokeCatch } from "@/utils/invokeError";
import { playUiSound, playHaptic } from "@/utils/uiSounds";

interface ExitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

type PowerId = "exit" | "sleep" | "restart" | "shutdown";

const OPTIONS: { id: PowerId; label: string; description: string; icon: typeof Power }[] = [
  { id: "exit", label: "Exit Portal", description: "Return to the Windows desktop", icon: DoorOpen },
  { id: "sleep", label: "Sleep", description: "Put the PC to sleep — Portal resumes on wake", icon: Moon },
  { id: "restart", label: "Restart PC", description: "Restart the computer", icon: RotateCcw },
  { id: "shutdown", label: "Shut down PC", description: "Turn the computer off", icon: Power },
];

/**
 * Console-style power menu (PS5 / SteamOS): Exit / Sleep / Restart / Shutdown.
 * Self-polls the gamepad — `useUnifiedNavigation` yields while exitConfirmOpen.
 */
export function ExitModal({ isOpen, onClose, onConfirm }: ExitModalProps) {
  const gamepadNavigationEnabled = useNavBindingsStore((s) => s.gamepadNavigationEnabled);
  const [focusIndex, setFocusIndex] = useState(0);
  const [busyId, setBusyId] = useState<PowerId | null>(null);
  const idxRef = useRef(0);
  const busyRef = useRef<PowerId | null>(null);
  const prevGpRef = useRef<boolean[]>(Array.from({ length: 32 }, () => false));
  const currGpRef = useRef<boolean[]>(Array.from({ length: 32 }, () => false));

  const powerAvailable = isTauri();

  const setBusy = (id: PowerId | null) => {
    busyRef.current = id;
    setBusyId(id);
  };

  const runAction = useCallback(
    (id: PowerId) => {
      if (busyRef.current) return;
      playUiSound("select");
      playHaptic(40, 0.3, 0);
      if (id === "exit") {
        setBusy("exit");
        void Promise.resolve(onConfirm()).catch((e) => {
          console.error("Exit confirm failed:", e);
          setBusy(null);
        });
        return;
      }
      if (!powerAvailable) return;
      setBusy(id);
      void invoke("power_action", { action: id })
        .then(() => {
          // Sleep resumes back into Portal — dismiss the menu.
          if (id === "sleep") {
            setBusy(null);
            onClose();
          }
        })
        .catch((e) => {
          toastInvokeCatch(`Power action "${id}" failed`, e);
          setBusy(null);
        });
    },
    [onConfirm, onClose, powerAvailable]
  );

  const moveFocus = useCallback((delta: number) => {
    setFocusIndex((i) => {
      const n = Math.min(OPTIONS.length - 1, Math.max(0, i + delta));
      if (n !== i) playUiSound("move");
      idxRef.current = n;
      return n;
    });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setBusy(null);
      return;
    }
    setFocusIndex(0);
    idxRef.current = 0;
  }, [isOpen]);

  // Keyboard (window-level: no reliance on focus being inside the modal)
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (!busyRef.current) onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        moveFocus(1);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        moveFocus(-1);
      }
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        runAction(OPTIONS[idxRef.current].id);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isOpen, onClose, moveFocus, runAction]);

  // Gamepad self-poll (useUnifiedNavigation returns early while exitConfirmOpen)
  useEffect(() => {
    if (!isOpen || !gamepadNavigationEnabled) return;
    const seed = getActiveGamepad();
    if (seed) snapshotGamepadButtons(seed, prevGpRef.current, 31);

    const tick = () => {
      const gamepad = getActiveGamepad();
      if (!gamepad) return;
      const prev = prevGpRef.current;
      const curr = currGpRef.current;
      snapshotGamepadButtons(gamepad, curr, 31);

      const just = (id: "spatialUp" | "spatialDown" | "primary" | "back") => {
        const b = getNavBinding(id);
        return (
          b.enabled &&
          b.gamepadButtons.length > 0 &&
          anyGamepadButtonJustPressed(b.gamepadButtons, prev, curr)
        );
      };

      if (just("spatialDown")) moveFocus(1);
      if (just("spatialUp")) moveFocus(-1);
      if (just("primary")) runAction(OPTIONS[idxRef.current].id);
      if (just("back") && !busyRef.current) onClose();

      prevGpRef.current = [...curr];
    };
    const id = window.setInterval(tick, 50);
    return () => window.clearInterval(id);
  }, [isOpen, gamepadNavigationEnabled, moveFocus, runAction, onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-shell-modal
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80"
      onClick={busyId ? undefined : onClose}
      role="presentation"
    >
      <Panel className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <PanelHeader>
          <PanelTitle className="text-2xl">Power</PanelTitle>
          <PanelDescription>
            {powerAvailable ? "What do you want to do?" : "System power actions need the desktop app."}
          </PanelDescription>
        </PanelHeader>
        <PanelBody className="flex flex-col gap-1 pt-0">
          {OPTIONS.map((o, i) => {
            const Icon = o.icon;
            const disabled = (o.id !== "exit" && !powerAvailable) || Boolean(busyId);
            const active = busyId === o.id;
            return (
              <button
                key={o.id}
                type="button"
                disabled={disabled && !active}
                className={cn(
                  "flex items-center gap-3 rounded-none border-2 px-3 py-3 text-left transition-[border-width,color] duration-150",
                  disabled && !active ? "opacity-40" : "hover:border-border hover:text-foreground",
                  focusIndex === i
                    ? "border-primary border-[3px] text-foreground"
                    : "border-transparent text-foreground"
                )}
                onClick={() => {
                  idxRef.current = i;
                  setFocusIndex(i);
                  runAction(o.id);
                }}
              >
                <Icon className="h-5 w-5 shrink-0 text-foreground" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {active ? `${o.label}…` : o.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">{o.description}</span>
                </span>
              </button>
            );
          })}
        </PanelBody>
      </Panel>
    </div>
  );
}
