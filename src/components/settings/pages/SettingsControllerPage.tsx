import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavBindingsStore } from "@/stores/navBindingsStore";
import {
  NAV_ACTION_GROUPS,
  NAV_ACTION_LABELS,
  type KeyboardChord,
  type NavActionId,
} from "@/types/navBindings";
import { formatKeyboardChord, chordEqual } from "@/utils/formatNavBinding";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  Gamepad2,
  Info,
  Keyboard,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";

type CaptureMode = { type: "keyboard"; actionId: NavActionId } | { type: "gamepad"; actionId: NavActionId };

function findChordConflicts(chord: KeyboardChord, exceptId: NavActionId): NavActionId[] {
  const actions = useNavBindingsStore.getState().actions;
  const out: NavActionId[] = [];
  (Object.keys(actions) as NavActionId[]).forEach((id) => {
    if (id === exceptId) return;
    if (actions[id].keyboard.some((k) => chordEqual(k, chord))) out.push(id);
  });
  return out;
}

function findButtonConflicts(index: number, exceptId: NavActionId): NavActionId[] {
  const actions = useNavBindingsStore.getState().actions;
  const out: NavActionId[] = [];
  (Object.keys(actions) as NavActionId[]).forEach((id) => {
    if (id === exceptId) return;
    if (actions[id].gamepadButtons.includes(index)) out.push(id);
  });
  return out;
}

function filterGroupsByQuery(query: string): { title: string; ids: NavActionId[] }[] {
  const q = query.trim().toLowerCase();
  if (!q) return NAV_ACTION_GROUPS.map((g) => ({ title: g.title, ids: [...g.ids] }));
  return NAV_ACTION_GROUPS.map((g) => ({
    title: g.title,
    ids: g.ids.filter((id) => NAV_ACTION_LABELS[id].toLowerCase().includes(q)),
  })).filter((g) => g.ids.length > 0);
}

function CaptureLayer({
  mode,
  onKeyboard,
  onGamepadIndex,
  onCancel,
}: {
  mode: CaptureMode;
  onKeyboard: (c: KeyboardChord) => void;
  onGamepadIndex: (index: number) => void;
  onCancel: () => void;
}) {
  const gpPrev = useRef<boolean[]>(Array.from({ length: 24 }, () => false));

  useEffect(() => {
    if (mode.type !== "keyboard") return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      onKeyboard({
        code: e.code,
        key: e.key,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
      });
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [mode, onKeyboard, onCancel]);

  useEffect(() => {
    if (mode.type !== "gamepad") return;
    let frame = 0;
    const tick = () => {
      const g = navigator.getGamepads()[0];
      const prev = gpPrev.current;
      if (g) {
        for (let i = 0; i <= 20; i++) {
          const b = g.buttons[i];
          const down = Boolean(b?.pressed || (b && b.value > 0.5));
          if (down && !prev[i]) {
            onGamepadIndex(i);
            return;
          }
          prev[i] = down;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      gpPrev.current.fill(false);
    };
  }, [mode, onGamepadIndex]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nav-capture-title"
    >
      <div className="glass-dark border-2 border-primary/40 shadow-lg shadow-primary/10 rounded-2xl p-8 max-w-md w-full text-center space-y-4 ring-2 ring-primary/20">
        <h2 id="nav-capture-title" className="text-xl font-semibold text-white">
          {mode.type === "keyboard" ? "Press a key" : "Press a controller button"}
        </h2>
        <p className="text-white/60 text-sm">{mode.type === "keyboard" ? "Esc to cancel." : "First gamepad. Esc to cancel."}</p>
        <Button type="button" variant="secondary" className="mt-2" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function BindingChip({
  children,
  onRemove,
  title,
}: {
  children: React.ReactNode;
  onRemove: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title ?? "Remove"}
      className="group inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg border border-white/15 bg-white/[0.07] text-white text-xs font-medium hover:bg-white/12 hover:border-white/25 transition-colors"
      onClick={onRemove}
    >
      <span>{children}</span>
      <span className="text-white/40 group-hover:text-white/80 text-[10px] leading-none px-0.5" aria-hidden>
        ×
      </span>
    </button>
  );
}

function BindingRow({ id, inactive }: { id: NavActionId; inactive: boolean }) {
  const binding = useNavBindingsStore((s) => s.actions[id]);
  const setActionEnabled = useNavBindingsStore((s) => s.setActionEnabled);
  const setActionKeyboard = useNavBindingsStore((s) => s.setActionKeyboard);
  const setActionGamepadButtons = useNavBindingsStore((s) => s.setActionGamepadButtons);
  const resetAction = useNavBindingsStore((s) => s.resetAction);
  const [capture, setCapture] = useState<CaptureMode | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  const onKeyboardCaptured = useCallback(
    (c: KeyboardChord) => {
      const conflicts = findChordConflicts(c, id);
      const next = [...binding.keyboard, c];
      setActionKeyboard(id, next);
      setCapture(null);
      if (conflicts.length) {
        setWarn(`Also used for: ${conflicts.map((x) => NAV_ACTION_LABELS[x]).join(", ")}`);
      } else {
        setWarn(null);
      }
    },
    [binding.keyboard, id, setActionKeyboard]
  );

  const onGamepadCaptured = useCallback(
    (index: number) => {
      const conflicts = findButtonConflicts(index, id);
      if (binding.gamepadButtons.includes(index)) {
        setCapture(null);
        return;
      }
      setActionGamepadButtons(id, [...binding.gamepadButtons, index]);
      setCapture(null);
      if (conflicts.length) {
        setWarn(`Btn ${index} also: ${conflicts.map((x) => NAV_ACTION_LABELS[x]).join(", ")}`);
      } else {
        setWarn(null);
      }
    },
    [binding.gamepadButtons, id, setActionGamepadButtons]
  );

  useEffect(() => {
    if (!capture || capture.type !== "gamepad") return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setCapture(null);
      }
    };
    window.addEventListener("keydown", onEsc, true);
    return () => window.removeEventListener("keydown", onEsc, true);
  }, [capture]);

  const label = NAV_ACTION_LABELS[id];

  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-3 transition-opacity",
        inactive && "opacity-55",
        !binding.enabled && "opacity-70"
      )}
    >
      <div className="flex flex-wrap items-start gap-3 justify-between gap-y-2">
        <label className="flex items-center gap-3 min-w-0 cursor-pointer group/label">
          <input
            type="checkbox"
            checked={binding.enabled}
            onChange={(e) => setActionEnabled(id, e.target.checked)}
            className="h-5 w-5 rounded-md border-white/35 bg-black/50 shrink-0 accent-primary"
            aria-label={`Enable ${label}`}
          />
          <span className="text-white font-medium text-sm group-hover/label:text-white">{label}</span>
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-white/50 hover:text-white h-8 -mr-1"
          onClick={() => resetAction(id)}
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden />
          <span className="sr-only sm:not-sr-only sm:inline text-xs ml-1">Reset</span>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2 text-white/45 text-[11px] uppercase tracking-wider font-medium">
            <Gamepad2 className="w-3.5 h-3.5 opacity-80" aria-hidden />
            Pad
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            {binding.gamepadButtons.length === 0 ? (
              <span className="text-white/35 text-xs py-1">None</span>
            ) : (
              binding.gamepadButtons.map((btn) => (
                <BindingChip
                  key={btn}
                  title={`Remove button ${btn}`}
                  onRemove={() =>
                    setActionGamepadButtons(
                      id,
                      binding.gamepadButtons.filter((b) => b !== btn)
                    )
                  }
                >
                  B{btn}
                </BindingChip>
              ))
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs border-white/20 bg-transparent text-white/80 hover:bg-white/10"
              onClick={() => setCapture({ type: "gamepad", actionId: id })}
            >
              <Plus className="w-3.5 h-3.5" aria-hidden />
              Add
            </Button>
          </div>
        </div>

        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2 text-white/45 text-[11px] uppercase tracking-wider font-medium">
            <Keyboard className="w-3.5 h-3.5 opacity-80" aria-hidden />
            Keys
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            {binding.keyboard.length === 0 ? (
              <span className="text-white/35 text-xs py-1">None</span>
            ) : (
              binding.keyboard.map((chord, idx) => (
                <BindingChip
                  key={`${chord.code}-${chord.key}-${idx}`}
                  title="Remove this key"
                  onRemove={() =>
                    setActionKeyboard(
                      id,
                      binding.keyboard.filter((_, i) => i !== idx)
                    )
                  }
                >
                  {formatKeyboardChord(chord)}
                </BindingChip>
              ))
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs border-white/20 bg-transparent text-white/80 hover:bg-white/10"
              onClick={() => setCapture({ type: "keyboard", actionId: id })}
            >
              <Plus className="w-3.5 h-3.5" aria-hidden />
              Add
            </Button>
          </div>
        </div>
      </div>

      {warn && (
        <p className="text-amber-200/90 text-xs flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-400/20 px-2.5 py-2">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-90" aria-hidden />
          {warn}
        </p>
      )}

      {capture && capture.actionId === id && (
        <CaptureLayer
          mode={capture}
          onKeyboard={onKeyboardCaptured}
          onGamepadIndex={onGamepadCaptured}
          onCancel={() => setCapture(null)}
        />
      )}
    </div>
  );
}

function DetailsSection({
  open,
  onOpenChange,
  title,
  icon: Icon,
  badge,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <details
      open={open}
      onToggle={(e) => onOpenChange(e.currentTarget.open)}
      className="group border border-white/10 rounded-xl bg-white/[0.02] overflow-hidden"
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 hover:bg-white/[0.04] transition-colors",
          "[&::-webkit-details-marker]:hidden"
        )}
      >
        <ChevronDown
          className={cn("w-4 h-4 text-white/50 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden
        />
        <Icon className="w-4 h-4 text-primary/90 shrink-0" aria-hidden />
        <span className="font-medium text-white text-sm flex-1 text-left">{title}</span>
        {badge ? (
          <span className="text-[11px] text-white/45 tabular-nums shrink-0">{badge}</span>
        ) : null}
      </summary>
      <div className="px-4 pb-4 pt-0 border-t border-white/5">{children}</div>
    </details>
  );
}

export function SettingsControllerPage() {
  const remoteBindingsEnabled = useNavBindingsStore((s) => s.remoteBindingsEnabled);
  const setRemoteBindingsEnabled = useNavBindingsStore((s) => s.setRemoteBindingsEnabled);
  const keyboardNavigationEnabled = useNavBindingsStore((s) => s.keyboardNavigationEnabled);
  const setKeyboardNavigationEnabled = useNavBindingsStore((s) => s.setKeyboardNavigationEnabled);
  const gamepadNavigationEnabled = useNavBindingsStore((s) => s.gamepadNavigationEnabled);
  const setGamepadNavigationEnabled = useNavBindingsStore((s) => s.setGamepadNavigationEnabled);
  const useLeftStickForSpatial = useNavBindingsStore((s) => s.useLeftStickForSpatial);
  const quickAccessMetaTapEnabled = useNavBindingsStore((s) => s.quickAccessMetaTapEnabled);
  const setUseLeftStickForSpatial = useNavBindingsStore((s) => s.setUseLeftStickForSpatial);
  const setQuickAccessMetaTapEnabled = useNavBindingsStore((s) => s.setQuickAccessMetaTapEnabled);
  const resetAll = useNavBindingsStore((s) => s.resetAll);

  const [bindingQuery, setBindingQuery] = useState("");
  const defaultsRef = useRef<HTMLDivElement>(null);
  const navInputsRef = useRef<HTMLDivElement>(null);
  const customRef = useRef<HTMLDivElement>(null);

  const filteredGroups = useMemo(() => filterGroupsByQuery(bindingQuery), [bindingQuery]);
  const totalFiltered = useMemo(() => filteredGroups.reduce((n, g) => n + g.ids.length, 0), [filteredGroups]);

  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>(() => {
    const first = NAV_ACTION_GROUPS[0]?.title;
    return { defaults: true, ...(first ? { [first]: true } : {}) };
  });
  const setSection = (key: string, open: boolean) => setSectionOpen((s) => ({ ...s, [key]: open }));

  const onResetAll = () => {
    if (
      window.confirm(
        "Reset all navigation settings to defaults? Custom bindings will turn off and keyboard and controller navigation turn back on."
      )
    ) {
      resetAll();
    }
  };

  return (
    <Card className="glass-dark border-white/10 overflow-hidden">
      <CardHeader className="space-y-3 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-semibold tracking-tight text-white">Controller</CardTitle>
            <CardDescription className="text-white/55 text-sm">
              Fine-tune keyboard, controller, and optional custom shortcuts.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border",
                keyboardNavigationEnabled
                  ? "bg-violet-500/12 text-violet-100 border-violet-400/25"
                  : "bg-white/5 text-white/50 border-white/15"
              )}
            >
              <Keyboard className="w-3.5 h-3.5 opacity-90" aria-hidden />
              {keyboardNavigationEnabled ? "Keys on" : "Keys off"}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border",
                gamepadNavigationEnabled
                  ? "bg-sky-500/15 text-sky-100 border-sky-400/25"
                  : "bg-white/5 text-white/50 border-white/15"
              )}
            >
              <Gamepad2 className="w-3.5 h-3.5 opacity-90" aria-hidden />
              {gamepadNavigationEnabled ? "Pad on" : "Pad off"}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border",
                remoteBindingsEnabled
                  ? "bg-emerald-500/15 text-emerald-100 border-emerald-400/30"
                  : "bg-white/5 text-white/55 border-white/15"
              )}
            >
              <Sparkles className="w-3.5 h-3.5 opacity-90" aria-hidden />
              {remoteBindingsEnabled ? "Custom on" : "Built-in"}
            </span>
          </div>
        </div>
        <nav className="flex flex-wrap gap-1.5" aria-label="On-page sections">
          <button
            type="button"
            className="rounded-md px-2.5 py-1 text-[11px] font-medium bg-white/10 text-white/70 hover:bg-white/15 hover:text-white transition-colors"
            onClick={() => defaultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            Shortcuts
          </button>
          <button
            type="button"
            className="rounded-md px-2.5 py-1 text-[11px] font-medium bg-white/10 text-white/70 hover:bg-white/15 hover:text-white transition-colors"
            onClick={() => navInputsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            Inputs
          </button>
          <button
            type="button"
            className="rounded-md px-2.5 py-1 text-[11px] font-medium bg-white/10 text-white/70 hover:bg-white/15 hover:text-white transition-colors"
            onClick={() => customRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            Custom
          </button>
        </nav>
      </CardHeader>
      <CardContent className="space-y-6 pb-8 pt-0">
        <div ref={defaultsRef} className="scroll-mt-4 space-y-3">
          <DetailsSection
            open={sectionOpen.defaults ?? true}
            onOpenChange={(o) => setSection("defaults", o)}
            title="Default shortcuts"
            icon={Keyboard}
            badge="ref"
          >
            <p className="text-white/45 text-xs mb-3">
              On-screen hints only when custom bindings are enabled. Guide/Home may not focus the app.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                ["Move", "D-pad / stick"],
                ["Open", "A · Enter"],
                ["Back", "B · Esc"],
                ["Quick launch", "Square (2)"],
                ["Quick access", "Win · Home · View (8)"],
                ["Quit", "Alt+F4"],
                ["Options", "Menu (9) · F10"],
                ["Search", "/ · Y"],
                ["Focus", "Tab"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
                  <p className="text-white/75 text-xs font-medium">{k}</p>
                  <p className="text-white/40 text-[11px] mt-0.5 leading-snug">{v}</p>
                </div>
              ))}
            </div>
          </DetailsSection>
        </div>

        <div ref={navInputsRef} className="scroll-mt-4 space-y-2.5">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-primary/90" aria-hidden />
            Navigation inputs
          </h2>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 space-y-4 ring-1 ring-inset ring-white/[0.04]">
            <p className="text-white/50 text-xs leading-snug">
              Disable keyboard or controller independently—for example mouse-only use, or to avoid accidental focus moves.
            </p>
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-0.5 min-w-0 pr-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Keyboard className="w-4 h-4 text-violet-300/90 shrink-0" aria-hidden />
                    Keyboard
                  </div>
                  <p className="text-[11px] text-white/45 leading-snug">
                    Shell shortcuts, spatial moves, embedded browser keys. Tab, typing in fields, and Esc to close overlays stay normal.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={keyboardNavigationEnabled}
                  onClick={() => setKeyboardNavigationEnabled(!keyboardNavigationEnabled)}
                  className={cn(
                    "relative h-8 w-14 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    keyboardNavigationEnabled ? "bg-primary" : "bg-white/20"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ease-out",
                      keyboardNavigationEnabled ? "translate-x-6" : "translate-x-0"
                    )}
                    aria-hidden
                  />
                </button>
              </div>
              <div className="h-px bg-white/[0.06]" />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-0.5 min-w-0 pr-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Gamepad2 className="w-4 h-4 text-sky-300/90 shrink-0" aria-hidden />
                    Controller
                  </div>
                  <p className="text-[11px] text-white/45 leading-snug">
                    Gamepad moves focus and runs shell / embedded-browser controller shortcuts.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={gamepadNavigationEnabled}
                  onClick={() => setGamepadNavigationEnabled(!gamepadNavigationEnabled)}
                  className={cn(
                    "relative h-8 w-14 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    gamepadNavigationEnabled ? "bg-primary" : "bg-white/20"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ease-out",
                      gamepadNavigationEnabled ? "translate-x-6" : "translate-x-0"
                    )}
                    aria-hidden
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div ref={customRef} className="scroll-mt-4 space-y-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-primary/90" aria-hidden />
            Custom bindings
          </h2>

          <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-3.5 space-y-3 shadow-sm shadow-black/30 ring-1 ring-inset ring-white/[0.04]">
            <div className="flex flex-wrap items-start gap-2 justify-between">
              <p className="text-[11px] text-white/55 leading-snug max-w-[50ch]">
                Optional remaps for keys and buttons. Off uses built-in shortcuts and hides the bottom hint bar.
              </p>
              <span className="shrink-0 rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/40">
                Beta
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="text-sm font-medium text-white">Enable custom bindings</span>
              <button
                type="button"
                role="switch"
                aria-checked={remoteBindingsEnabled}
                onClick={() => setRemoteBindingsEnabled(!remoteBindingsEnabled)}
                className={cn(
                  "relative h-8 w-14 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  remoteBindingsEnabled ? "bg-primary" : "bg-white/20"
                )}
              >
                <span
                  className={cn(
                    "absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ease-out",
                    remoteBindingsEnabled ? "translate-x-6" : "translate-x-0"
                  )}
                  aria-hidden
                />
              </button>
            </div>
            {!remoteBindingsEnabled && (
              <p className="text-[11px] text-white/45 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0" aria-hidden />
                Edits apply after you enable custom bindings.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 justify-between">
            <Button type="button" variant="secondary" size="sm" onClick={onResetAll} className="gap-2">
              <RotateCcw className="w-3.5 h-3.5" aria-hidden />
              Reset all
            </Button>
          </div>

          <div
            className={cn(
              "rounded-xl border border-white/10 p-4 space-y-3 transition-opacity",
              !remoteBindingsEnabled && "opacity-60"
            )}
          >
            <h3 className="text-sm font-semibold text-white">Global</h3>
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4">
              <label
                className={cn(
                  "flex items-center gap-3 text-sm text-white/90",
                  remoteBindingsEnabled ? "cursor-pointer" : "cursor-not-allowed"
                )}
              >
                <input
                  type="checkbox"
                  checked={useLeftStickForSpatial}
                  disabled={!remoteBindingsEnabled}
                  onChange={(e) => setUseLeftStickForSpatial(e.target.checked)}
                  className="h-5 w-5 rounded-md border-white/35 bg-black/50 accent-primary"
                />
                Left stick for move
              </label>
              <label
                className={cn(
                  "flex items-center gap-3 text-sm text-white/90",
                  remoteBindingsEnabled ? "cursor-pointer" : "cursor-not-allowed"
                )}
              >
                <input
                  type="checkbox"
                  checked={quickAccessMetaTapEnabled}
                  disabled={!remoteBindingsEnabled}
                  onChange={(e) => setQuickAccessMetaTapEnabled(e.target.checked)}
                  className="h-5 w-5 rounded-md border-white/35 bg-black/50 accent-primary"
                />
                Win/Meta tap → Quick access
              </label>
            </div>
          </div>

          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 pointer-events-none"
              aria-hidden
            />
            <Input
              type="search"
              placeholder="Filter actions…"
              value={bindingQuery}
              onChange={(e) => setBindingQuery(e.target.value)}
              className="pl-9 bg-black/30 border-white/15 text-white placeholder:text-white/35"
              aria-label="Filter binding actions"
            />
          </div>

          {bindingQuery.trim() && totalFiltered === 0 ? (
            <p className="text-white/45 text-sm text-center py-8">No actions match “{bindingQuery.trim()}”.</p>
          ) : (
            <div className="space-y-3">
              {filteredGroups.map((group, gi) => (
                <DetailsSection
                  key={group.title}
                  open={sectionOpen[group.title] ?? (gi === 0 && bindingQuery.trim() === "")}
                  onOpenChange={(o) => setSection(group.title, o)}
                  title={group.title}
                  icon={Gamepad2}
                  badge={`${group.ids.length}`}
                >
                  <div className="grid gap-3 pt-2">
                    {group.ids.map((actionId) => (
                      <BindingRow key={actionId} id={actionId} inactive={!remoteBindingsEnabled} />
                    ))}
                  </div>
                </DetailsSection>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
