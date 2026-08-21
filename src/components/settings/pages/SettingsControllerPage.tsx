import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FrameKey } from "@/components/ui/frame-key";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { SettingToggle } from "@/components/ui/setting-row";
import { Switch } from "@/components/ui/switch";
import { useNavBindingsStore } from "@/stores/navBindingsStore";
import {
  NAV_ACTION_GROUPS,
  NAV_ACTION_LABELS,
  type KeyboardChord,
  type NavActionId,
} from "@/types/navBindings";
import { formatKeyboardChord, chordEqual } from "@/utils/formatNavBinding";
import {
  hapticsEnabled,
  playUiSound,
  playHaptic,
  setHapticsEnabled,
  setUiSoundsEnabled,
  uiSoundsEnabled,
} from "@/utils/uiSounds";
import {
  focusChordEnabled,
  setNativeGamepadPrefs,
  virtualCursorEnabled,
} from "@/hooks/useNativeGamepad";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  Gamepad2,
  Info,
  Keyboard,
  Plus,
  RotateCcw,
  Search,
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
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nav-capture-title"
    >
      <Panel className="w-full max-w-md border-[3px] border-primary text-center">
        <PanelHeader>
          <PanelTitle id="nav-capture-title">
            {mode.type === "keyboard" ? "Press a key" : "Press a controller button"}
          </PanelTitle>
          <PanelDescription>
            {mode.type === "keyboard" ? "Esc to cancel." : "First gamepad. Esc to cancel."}
          </PanelDescription>
        </PanelHeader>
        <PanelBody>
          <Button type="button" variant="secondary" className="rounded-none" onClick={onCancel}>
            Cancel
          </Button>
        </PanelBody>
      </Panel>
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
      className="group inline-flex items-center gap-1.5 border-2 border-border bg-transparent py-1 pl-2.5 pr-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary"
      onClick={onRemove}
    >
      <span>{children}</span>
      <span className="px-0.5 text-xs leading-none text-muted-foreground group-hover:text-foreground" aria-hidden>
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
        "space-y-3 border-b border-border py-4 last:border-b-0",
        inactive && "opacity-55",
        !binding.enabled && "opacity-70"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 gap-y-2">
      <div className="flex min-w-0 items-center gap-3">
          <Switch
            checked={binding.enabled}
            onChange={(e) => setActionEnabled(id, e.target.checked)}
            aria-label={`Enable ${label}`}
          />
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 rounded-none"
          onClick={() => resetAction(id)}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          <span className="sr-only ml-1 text-xs sm:not-sr-only sm:inline">Reset</span>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground">
            <Gamepad2 className="h-3.5 w-3.5" aria-hidden />
            Pad
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {binding.gamepadButtons.length === 0 ? (
              <span className="py-1 text-xs text-muted-foreground">None</span>
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
              className="h-7 rounded-none text-xs"
              onClick={() => setCapture({ type: "gamepad", actionId: id })}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add
            </Button>
          </div>
        </div>

        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground">
            <Keyboard className="h-3.5 w-3.5" aria-hidden />
            Keys
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {binding.keyboard.length === 0 ? (
              <span className="py-1 text-xs text-muted-foreground">None</span>
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
              className="h-7 rounded-none text-xs"
              onClick={() => setCapture({ type: "keyboard", actionId: id })}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add
            </Button>
          </div>
        </div>
      </div>

      {warn ? (
        <p className="flex items-start gap-2 rounded-none border border-border px-2.5 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {warn}
        </p>
      ) : null}

      {capture && capture.actionId === id ? (
        <CaptureLayer
          mode={capture}
          onKeyboard={onKeyboardCaptured}
          onGamepadIndex={onGamepadCaptured}
          onCancel={() => setCapture(null)}
        />
      ) : null}
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
      className="group overflow-hidden rounded-none border border-border bg-card"
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 hover:bg-muted",
          "[&::-webkit-details-marker]:hidden"
        )}
      >
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
        <Icon className="h-4 w-4 shrink-0 text-foreground" aria-hidden />
        <span className="flex-1 text-left text-sm font-medium text-foreground">{title}</span>
        {badge ? (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{badge}</span>
        ) : null}
      </summary>
      <div className="border-t border-border px-4 pb-4 pt-0">{children}</div>
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

  const [soundsOn, setSoundsOn] = useState(uiSoundsEnabled);
  const [hapticsOn, setHapticsOn] = useState(hapticsEnabled);
  const [cursorOn, setCursorOn] = useState(virtualCursorEnabled);
  const [chordOn, setChordOn] = useState(focusChordEnabled);

  const [bindingQuery, setBindingQuery] = useState("");
  const defaultsRef = useRef<HTMLDivElement>(null);
  const navInputsRef = useRef<HTMLDivElement>(null);
  const customRef = useRef<HTMLDivElement>(null);

  const filteredGroups = useMemo(() => filterGroupsByQuery(bindingQuery), [bindingQuery]);
  const totalFiltered = useMemo(
    () => filteredGroups.reduce((n, g) => n + g.ids.length, 0),
    [filteredGroups]
  );

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
    <div className="space-y-6">
      <Panel>
        <PanelHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <PanelTitle>Controller</PanelTitle>
              <PanelDescription>
                Fine-tune keyboard, controller, and optional custom shortcuts.
              </PanelDescription>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 border-2 px-3 py-1 text-xs font-medium",
                  keyboardNavigationEnabled
                    ? "border-primary text-foreground"
                    : "border-border text-muted-foreground"
                )}
              >
                <Keyboard className="h-3.5 w-3.5" aria-hidden />
                {keyboardNavigationEnabled ? "Keys on" : "Keys off"}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 border-2 px-3 py-1 text-xs font-medium",
                  gamepadNavigationEnabled
                    ? "border-primary text-foreground"
                    : "border-border text-muted-foreground"
                )}
              >
                <Gamepad2 className="h-3.5 w-3.5" aria-hidden />
                {gamepadNavigationEnabled ? "Pad on" : "Pad off"}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 border-2 px-3 py-1 text-xs font-medium",
                  remoteBindingsEnabled
                    ? "border-primary text-foreground"
                    : "border-border text-muted-foreground"
                )}
              >
                {remoteBindingsEnabled ? "Custom on" : "Built-in"}
              </span>
            </div>
          </div>
          <nav className="flex flex-wrap gap-1.5 pt-2" aria-label="On-page sections">
            <FrameKey
              size="sm"
              onClick={() => defaultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              Shortcuts
            </FrameKey>
            <FrameKey
              size="sm"
              onClick={() => navInputsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              Inputs
            </FrameKey>
            <FrameKey
              size="sm"
              onClick={() => customRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              Custom
            </FrameKey>
          </nav>
        </PanelHeader>
        <PanelBody className="space-y-6">
          <div ref={defaultsRef} className="scroll-mt-4 space-y-3">
            <DetailsSection
              open={sectionOpen.defaults ?? true}
              onOpenChange={(o) => setSection("defaults", o)}
              title="Default shortcuts"
              icon={Keyboard}
              badge="ref"
            >
              <p className="mb-3 text-xs text-muted-foreground">
                On-screen hints only when custom bindings are enabled. Guide/Home may not focus the app.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                  <div key={k} className="rounded-none border border-border px-2.5 py-2">
                    <p className="text-xs font-medium text-foreground">{k}</p>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{v}</p>
                  </div>
                ))}
              </div>
            </DetailsSection>
          </div>
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <div ref={navInputsRef} className="scroll-mt-4 flex items-center gap-2">
            <Gamepad2 className="h-4 w-4" aria-hidden />
            <PanelTitle>Navigation inputs</PanelTitle>
          </div>
          <PanelDescription>
            Disable keyboard or controller independently—for example mouse-only use, or to avoid accidental focus moves.
          </PanelDescription>
        </PanelHeader>
        <PanelBody>
          <SettingToggle
            id="nav-keyboard"
            label="Keyboard"
            description="Shell shortcuts, spatial moves, embedded browser keys. Tab, typing in fields, and Esc to close overlays stay normal."
            checked={keyboardNavigationEnabled}
            onChange={setKeyboardNavigationEnabled}
          />
          <SettingToggle
            id="nav-gamepad"
            label="Controller"
            description="Gamepad moves focus and runs shell / embedded-browser controller shortcuts."
            checked={gamepadNavigationEnabled}
            onChange={setGamepadNavigationEnabled}
          />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader>
          <div ref={customRef} className="scroll-mt-4 flex items-center gap-2">
            <Gamepad2 className="h-4 w-4" aria-hidden />
            <PanelTitle>Custom bindings</PanelTitle>
          </div>
          <PanelDescription>
            Optional remaps for keys and buttons. Off uses built-in shortcuts and hides the bottom hint bar.
          </PanelDescription>
        </PanelHeader>
        <PanelBody className="space-y-4">
          <SettingToggle
            id="nav-custom-bindings"
            label="Enable custom bindings"
            description="Edits apply after you enable custom bindings."
            checked={remoteBindingsEnabled}
            onChange={setRemoteBindingsEnabled}
          />

          <Button type="button" variant="secondary" size="sm" onClick={onResetAll} className="rounded-none">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Reset all
          </Button>

          <div className={cn(!remoteBindingsEnabled && "opacity-60")}>
            <h3 className="mb-1 text-sm font-semibold text-foreground">Global</h3>
            <SettingToggle
              id="nav-left-stick"
              label="Left stick for move"
              checked={useLeftStickForSpatial}
              disabled={!remoteBindingsEnabled}
              onChange={setUseLeftStickForSpatial}
            />
            <SettingToggle
              id="nav-meta-tap"
              label="Win/Meta tap → Quick access"
              checked={quickAccessMetaTapEnabled}
              disabled={!remoteBindingsEnabled}
              onChange={setQuickAccessMetaTapEnabled}
            />
            <SettingToggle
              id="nav-ui-sounds"
              label="UI sounds"
              checked={soundsOn}
              onChange={(v) => {
                setUiSoundsEnabled(v);
                setSoundsOn(v);
                if (v) playUiSound("select");
              }}
            />
            <SettingToggle
              id="nav-haptics"
              label="Controller vibration"
              checked={hapticsOn}
              onChange={(v) => {
                setHapticsEnabled(v);
                setHapticsOn(v);
                if (v) playHaptic(60, 0.4, 0.2);
              }}
            />
            <SettingToggle
              id="nav-cursor"
              label="Right-stick cursor in browser"
              checked={cursorOn}
              onChange={(v) => {
                setCursorOn(v);
                setNativeGamepadPrefs(v, chordOn);
              }}
            />
            <SettingToggle
              id="nav-chord"
              label="Back+Start focuses Portal"
              checked={chordOn}
              onChange={(v) => {
                setChordOn(v);
                setNativeGamepadPrefs(cursorOn, v);
              }}
            />
          </div>

          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              placeholder="Filter actions…"
              value={bindingQuery}
              onChange={(e) => setBindingQuery(e.target.value)}
              className="pl-9"
              aria-label="Filter binding actions"
            />
          </div>

          {bindingQuery.trim() && totalFiltered === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No actions match “{bindingQuery.trim()}”.
            </p>
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
                  <div className="grid gap-0 pt-2">
                    {group.ids.map((actionId) => (
                      <BindingRow key={actionId} id={actionId} inactive={!remoteBindingsEnabled} />
                    ))}
                  </div>
                </DetailsSection>
              ))}
            </div>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
