import { useNavigationStore } from "@/stores/navigationStore";
import { useAppShellStore } from "@/stores/appShellStore";
import { useShellOverlayStore } from "@/stores/shellOverlayStore";
import { useBrowserStore } from "@/stores/browserStore";
import { detectControllerLayout, hintGlyph, type ControllerLayoutKind } from "@/navigation/controllerProfile";
import { cn } from "@/lib/utils";

function useActiveGamepad(): Gamepad | null {
  const pads = navigator.getGamepads();
  return pads[0] ?? null;
}

export default function ControllerHintBar() {
  const inputMethod = useNavigationStore((s) => s.inputMethod);
  const focusArea = useNavigationStore((s) => s.focusArea);
  const currentView = useAppShellStore((s) => s.currentView);
  const formShellSurface = currentView === "settings" || currentView === "docs";
  const quickAccessOpen = useShellOverlayStore((s) => s.quickAccessOpen);
  const appSwitcherOpen = useShellOverlayStore((s) => s.appSwitcherOpen);
  const gameContextOpen = useShellOverlayStore((s) => s.gameContextMenuOpen);
  const browserBlocking = useBrowserStore((s) => s.isOpen && !s.isMinimized);

  const gp = useActiveGamepad();
  const layout: ControllerLayoutKind =
    inputMethod === "gamepad" ? detectControllerLayout(gp) : "generic";

  if (browserBlocking || formShellSurface) {
    return null;
  }

  const rows: { key: string; label: string }[][] = [];

  const winAndQuitHints: { key: string; label: string }[] = [
    { key: "Win", label: "Quick access" },
    { key: "Alt+F4", label: "Quit" },
  ];

  if (quickAccessOpen || appSwitcherOpen) {
    rows.push([
      { key: inputMethod === "keyboard" ? "Enter" : hintGlyph(layout, "select"), label: "Choose" },
      { key: inputMethod === "keyboard" ? "Esc" : hintGlyph(layout, "back"), label: "Close" },
      ...winAndQuitHints,
    ]);
  } else if (gameContextOpen) {
    rows.push([
      { key: inputMethod === "keyboard" ? "↑↓" : "D-pad", label: "Navigate" },
      { key: inputMethod === "keyboard" ? "Enter" : hintGlyph(layout, "select"), label: "Select" },
      { key: inputMethod === "keyboard" ? "Esc" : hintGlyph(layout, "back"), label: "Close" },
      ...winAndQuitHints,
    ]);
  } else if (currentView === "details") {
    rows.push([
      { key: inputMethod === "keyboard" ? "Enter" : hintGlyph(layout, "select"), label: "Activate" },
      { key: inputMethod === "keyboard" ? "Esc" : hintGlyph(layout, "back"), label: "Back" },
      ...winAndQuitHints,
    ]);
  } else {
    // Library grid / categories / shell
    const shellHints: { key: string; label: string }[] = [
      { key: inputMethod === "keyboard" ? "Enter" : hintGlyph(layout, "select"), label: "Open" },
      { key: inputMethod === "keyboard" ? "Esc" : hintGlyph(layout, "back"), label: "Back" },
    ];
    if (focusArea === "games") {
      shellHints.push({
        key: inputMethod === "keyboard" ? "▤" : hintGlyph(layout, "menu"),
        label: "Options",
      });
      shellHints.push({
        key: inputMethod === "keyboard" ? "□" : hintGlyph(layout, "view"),
        label: "Quick",
      });
    }
    shellHints.push({
      key: inputMethod === "keyboard" ? "/" : hintGlyph(layout, "search"),
      label: "Search",
    });
    if (inputMethod === "gamepad" && (focusArea === "games" || focusArea === "category")) {
      shellHints.push({ key: hintGlyph(layout, "lb"), label: "" }, { key: hintGlyph(layout, "rb"), label: "Tab" });
    }
    shellHints.push(...winAndQuitHints);
    rows.push(shellHints);
  }

  return (
    <div
      className={cn(
        "shrink-0 z-30 flex items-center justify-between gap-4 px-6 py-3",
        "bg-black/85 border-t border-white/10 text-white/95 backdrop-blur-md",
        "safe-area-pb"
      )}
      aria-hidden
    >
      <div className="flex items-center gap-6 flex-wrap text-sm font-medium">
        {rows[0]?.map((h) => (
          <span key={`${h.key}-${h.label}`} className="inline-flex items-center gap-2">
            <kbd className="rounded-md bg-white/15 px-2 py-1 text-xs font-semibold tracking-tight min-w-[1.75rem] text-center">
              {h.key}
            </kbd>
            {h.label ? <span className="text-white/80">{h.label}</span> : null}
          </span>
        ))}
      </div>
      <div className="text-xs text-white/50 hidden sm:block">Portal</div>
    </div>
  );
}
