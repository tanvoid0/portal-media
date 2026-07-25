import { useState, useEffect } from "react";
import { useNavigationStore } from "@/stores/navigationStore";
import { useAppShellStore } from "@/stores/appShellStore";
import { useShellOverlayStore } from "@/stores/shellOverlayStore";
import { useBrowserStore } from "@/stores/browserStore";
import { detectControllerLayout } from "@/navigation/controllerProfile";
import type { ControllerLayoutKind } from "@/navigation/controllerProfile";
import { InputGlyph } from "@/components/ui/InputGlyph";
import type { InputMethod } from "@/types/navigation";
import { cn } from "@/lib/utils";

// Standard Gamepad API button indices
const BTN = {
  PRIMARY:   0,  // A  / ✕
  BACK:      1,  // B  / ○
  LAUNCH:    2,  // X  / □  (quickLaunch)
  SEARCH:    3,  // Y  / △
  LB:        4,  // LB / L1
  RB:        5,  // RB / R1
  MENU:      9,  // Menu / Options
} as const;

type ButtonHint = { kind: "button"; gamepadButton?: number; keyboard?: string; label: string };
type SepHint    = { kind: "sep" };
type HintEntry  = ButtonHint | SepHint;

const b = (gamepadButton: number | undefined, keyboard: string | undefined, label: string): ButtonHint =>
  ({ kind: "button", gamepadButton, keyboard, label });
const sep = (): SepHint => ({ kind: "sep" });

function buildHints(
  inputMethod: InputMethod,
  focusArea: string,
  currentView: string,
  quickAccessOpen: boolean,
  appSwitcherOpen: boolean,
  gameContextOpen: boolean,
): HintEntry[] {
  const isGp = inputMethod === "gamepad";

  if (quickAccessOpen || appSwitcherOpen) {
    return [
      b(BTN.PRIMARY, "Enter", "Choose"),
      b(BTN.BACK,    "Esc",   "Close"),
    ];
  }

  if (gameContextOpen) {
    return [
      b(undefined,    "↑↓",   "Navigate"),
      b(BTN.PRIMARY,  "Enter", "Select"),
      b(BTN.BACK,     "Esc",   "Close"),
    ];
  }

  if (currentView === "details") {
    return [
      b(BTN.PRIMARY, "Enter", "Activate"),
      b(BTN.BACK,    "Esc",   "Back"),
    ];
  }

  // Settings / docs: DOM spatial nav (domSpatialNav) — d-pad moves focus, A activates.
  if (currentView === "settings" || currentView === "docs") {
    return [
      b(BTN.PRIMARY, "Enter", "Select"),
      b(BTN.BACK,    "Esc",   "Back"),
    ];
  }

  // Library / games grid
  const hints: HintEntry[] = [
    b(BTN.PRIMARY, "Enter", "Open"),
    b(BTN.LAUNCH,  undefined, "Launch"),   // gamepad-only
    b(BTN.BACK,    "Esc",     "Back"),
    b(BTN.SEARCH,  "/",       "Search"),
  ];

  if (isGp && focusArea === "games") {
    hints.push(b(BTN.MENU, undefined, "Options"));
  }

  if (isGp && (focusArea === "games" || focusArea === "category")) {
    hints.push(sep());
    hints.push(b(BTN.LB, undefined, ""));
    hints.push(b(BTN.RB, undefined, "Tab"));
  }

  if (!isGp) {
    hints.push(b(undefined, "←→", "Browse"));
  }

  return hints;
}

function useActiveGamepad(): Gamepad | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener("gamepadconnected", bump);
    window.addEventListener("gamepaddisconnected", bump);
    return () => {
      window.removeEventListener("gamepadconnected", bump);
      window.removeEventListener("gamepaddisconnected", bump);
    };
  }, []);
  const pads = navigator.getGamepads();
  for (let i = 0; i < pads.length; i++) {
    if (pads[i] !== null) return pads[i];
  }
  return null;
}

export default function ControllerHintBar() {
  const inputMethod   = useNavigationStore((s) => s.inputMethod);
  const focusArea     = useNavigationStore((s) => s.focusArea);
  const currentView   = useAppShellStore((s) => s.currentView);
  const quickAccessOpen  = useShellOverlayStore((s) => s.quickAccessOpen);
  const appSwitcherOpen  = useShellOverlayStore((s) => s.appSwitcherOpen);
  const gameContextOpen  = useShellOverlayStore((s) => s.gameContextMenuOpen);
  const browserBlocking  = useBrowserStore((s) => s.isOpen && !s.isMinimized);

  const gp     = useActiveGamepad();
  const layout: ControllerLayoutKind = inputMethod === "gamepad" ? detectControllerLayout(gp) : "generic";

  // Hide when mouse-only or the browser overlay owns the window.
  if (inputMethod === "mouse" || browserBlocking) return null;

  const allHints = buildHints(inputMethod, focusArea, currentView, quickAccessOpen, appSwitcherOpen, gameContextOpen);

  // Strip entries that have no renderable glyph for the active input method
  const visible = allHints.filter((h): h is HintEntry => {
    if (h.kind === "sep") return true;
    if (inputMethod === "gamepad") return h.gamepadButton !== undefined;
    return h.keyboard !== undefined;
  });

  // Trim trailing sep
  while (visible.length > 0 && visible[visible.length - 1].kind === "sep") visible.pop();

  return (
    <div
      className={cn(
        "shrink-0 z-30 flex items-center justify-between gap-4 px-6 py-2",
        "bg-black/85 border-t border-white/10 backdrop-blur-md",
        "safe-area-pb"
      )}
      aria-hidden
    >
      <div className="flex items-center gap-4 flex-wrap">
        {visible.map((h, i) => {
          if (h.kind === "sep") {
            return <div key={`sep-${i}`} className="w-px h-3.5 bg-white/15" />;
          }
          return (
            <span
              key={`${String(h.gamepadButton ?? h.keyboard)}-${h.label}-${i}`}
              className="inline-flex items-center gap-1.5"
            >
              <InputGlyph
                inputMethod={inputMethod}
                layout={layout}
                gamepadButton={h.gamepadButton}
                keyboard={h.keyboard}
              />
              {h.label ? (
                <span className="text-[13px] text-white/70 font-medium leading-none">{h.label}</span>
              ) : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}
