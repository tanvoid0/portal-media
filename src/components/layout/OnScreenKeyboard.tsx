import { useCallback, useEffect, useRef, useState } from "react";
import { useShellOverlayStore } from "@/stores/shellOverlayStore";
import { useNavigationStore } from "@/stores/navigationStore";
import { getNavBinding, useNavBindingsStore } from "@/stores/navBindingsStore";
import { snapshotGamepadButtons, anyGamepadButtonJustPressed } from "@/utils/navBindingMatch";
import { getActiveGamepad } from "@/utils/getActiveGamepad";
import { cn } from "@/lib/utils";
import { ArrowBigUp, Check, Delete, Space } from "lucide-react";
import { feedbackTick } from "@/utils/uiFeedback";

/**
 * On-screen keyboard for controller text entry (Steam Big Picture style).
 *
 * Always mounted; opens automatically when a text field gains focus while the
 * input method is "gamepad". The target field keeps real DOM focus the whole
 * time (OSK buttons preventDefault on mousedown), so a physical keyboard keeps
 * working too. Shell nav yields while open (isSpatialNavigationBlocked).
 *
 * Controls: d-pad move · A press key · B backspace · X space · Y shift · Start done.
 */

type Layer = "lower" | "upper" | "sym";

const CHAR_ROWS: Record<Layer, string[]> = {
  lower: ["1234567890", "qwertyuiop", "asdfghjkl-", "zxcvbnm,._"],
  upper: ["1234567890", "QWERTYUIOP", "ASDFGHJKL-", "ZXCVBNM,._"],
  sym: ["!@#$%^&*()", "-_=+[]{}\\|", ";:'\",.<>/?", "~`"],
};

type ActionId = "shift" | "sym" | "space" | "backspace" | "done";
/** Bottom row is the same across layers. */
const ACTION_ROW: ActionId[] = ["shift", "sym", "space", "backspace", "done"];

// Raw standard-gamepad indices for OSK-local chords (documented in hint row).
const GP_SPACE = 2; // X / □
const GP_SHIFT = 3; // Y / △

const REPEAT_INITIAL_MS = 350;
const REPEAT_INTERVAL_MS = 90;

type TextTarget = HTMLInputElement | HTMLTextAreaElement;

function isTextEntry(el: unknown): el is TextTarget {
  if (el instanceof HTMLTextAreaElement) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  return ["text", "search", "url", "email", "password", "number", "tel"].includes(el.type);
}

/** Set value through the native setter so controlled React inputs see the change. */
function setNativeValue(el: TextTarget, value: string) {
  const proto = el instanceof HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function selectionOf(el: TextTarget): { start: number; end: number } {
  // number inputs throw on selectionStart — fall back to end-of-value.
  try {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    return { start, end };
  } catch {
    return { start: el.value.length, end: el.value.length };
  }
}

function insertText(el: TextTarget, text: string) {
  const { start, end } = selectionOf(el);
  setNativeValue(el, el.value.slice(0, start) + text + el.value.slice(end));
  try {
    el.setSelectionRange(start + text.length, start + text.length);
  } catch {
    /* number inputs */
  }
}

function backspace(el: TextTarget) {
  const { start, end } = selectionOf(el);
  if (start === end && start === 0) return;
  const from = start === end ? start - 1 : start;
  setNativeValue(el, el.value.slice(0, from) + el.value.slice(end));
  try {
    el.setSelectionRange(from, from);
  } catch {
    /* number inputs */
  }
}

type RepeatState = { start: number; lastFire: number };

export default function OnScreenKeyboard() {
  const oskOpen = useShellOverlayStore((s) => s.oskOpen);
  const setOskOpen = useShellOverlayStore((s) => s.setOskOpen);
  const gamepadNavigationEnabled = useNavBindingsStore((s) => s.gamepadNavigationEnabled);

  const targetRef = useRef<TextTarget | null>(null);
  const [layer, setLayer] = useState<Layer>("lower");
  const [row, setRow] = useState(1);
  const [col, setCol] = useState(0);
  const posRef = useRef<{ row: number; col: number }>({ row: 1, col: 0 });
  const prevGpRef = useRef<boolean[]>(Array.from({ length: 32 }, () => false));
  const currGpRef = useRef<boolean[]>(Array.from({ length: 32 }, () => false));
  const repeatRef = useRef<Record<string, RepeatState | null>>({});

  const rows: (string | ActionId[])[] = [...CHAR_ROWS[layer], ACTION_ROW];
  const rowLen = useCallback(
    (r: number) => {
      const rowsNow = [...CHAR_ROWS[layer], ACTION_ROW];
      const entry = rowsNow[r];
      return typeof entry === "string" ? entry.length : entry.length;
    },
    [layer]
  );

  const setPos = useCallback((r: number, c: number) => {
    if (posRef.current.row !== r || posRef.current.col !== c) feedbackTick();
    posRef.current = { row: r, col: c };
    setRow(r);
    setCol(c);
  }, []);

  const close = useCallback(() => {
    setOskOpen(false);
    targetRef.current?.blur();
    targetRef.current = null;
  }, [setOskOpen]);

  const pressAt = useCallback(
    (r: number, c: number) => {
      const el = targetRef.current;
      if (!el) return;
      feedbackTick();
      const rowsNow = [...CHAR_ROWS[layer], ACTION_ROW];
      const entry = rowsNow[r];
      if (typeof entry === "string") {
        insertText(el, entry[c] ?? "");
        return;
      }
      const action = entry[c];
      if (action === "shift") setLayer((l) => (l === "upper" ? "lower" : "upper"));
      if (action === "sym") setLayer((l) => (l === "sym" ? "lower" : "sym"));
      if (action === "space") insertText(el, " ");
      if (action === "backspace") backspace(el);
      if (action === "done") close();
    },
    [layer, close]
  );

  // ---- auto-open on text-field focus while in gamepad mode (always active) ----
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      if (useNavigationStore.getState().inputMethod !== "gamepad") return;
      if (!isTextEntry(e.target)) return;
      targetRef.current = e.target;
      setOskOpen(true);
      // Keep the field visible above the keyboard sheet.
      window.setTimeout(() => {
        targetRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 50);
    };
    window.addEventListener("focusin", onFocusIn);
    return () => window.removeEventListener("focusin", onFocusIn);
  }, [setOskOpen]);

  // ---- while open: close when the target loses focus; Escape closes ----
  useEffect(() => {
    if (!oskOpen) return;
    setLayer("lower");
    setPos(1, 0);

    const onFocusOut = () => {
      // Defer: focus may be transiting to the same element (mousedown preventDefault keeps it).
      window.setTimeout(() => {
        if (document.activeElement !== targetRef.current) setOskOpen(false);
      }, 0);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener("focusout", onFocusOut);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [oskOpen, close, setOskOpen, setPos]);

  // ---- gamepad poll while open (shell nav yields to us) ----
  useEffect(() => {
    if (!oskOpen || !gamepadNavigationEnabled) return;
    const seed = getActiveGamepad();
    if (seed) snapshotGamepadButtons(seed, prevGpRef.current, 31);
    repeatRef.current = {};

    const move = (dr: number, dc: number) => {
      const { row: r, col: c } = posRef.current;
      const rowsCount = CHAR_ROWS[layer].length + 1;
      const nr = Math.min(rowsCount - 1, Math.max(0, r + dr));
      const len = rowLen(nr);
      const nc = Math.min(len - 1, Math.max(0, (dr !== 0 ? c : c + dc)));
      setPos(nr, nc);
    };

    const tick = () => {
      const gamepad = getActiveGamepad();
      if (!gamepad) return;
      const prev = prevGpRef.current;
      const curr = currGpRef.current;
      snapshotGamepadButtons(gamepad, curr, 31);

      const bindingButtons = (id: Parameters<typeof getNavBinding>[0]) => {
        const b = getNavBinding(id);
        return b.enabled ? b.gamepadButtons : [];
      };
      const heldAny = (buttons: number[]) => buttons.some((i) => curr[i]);
      const justAny = (buttons: number[]) => anyGamepadButtonJustPressed(buttons, prev, curr);

      // Held-with-repeat for directions and backspace.
      const now = performance.now();
      const repeat = (id: string, held: boolean, action: () => void) => {
        const st = repeatRef.current[id] ?? null;
        if (!held) {
          if (st) repeatRef.current[id] = null;
          return;
        }
        if (!st) {
          repeatRef.current[id] = { start: now, lastFire: now };
          action();
          return;
        }
        if (now - st.start >= REPEAT_INITIAL_MS && now - st.lastFire >= REPEAT_INTERVAL_MS) {
          st.lastFire = now;
          action();
        }
      };

      const stickX = gamepad.axes[0] ?? 0;
      const stickY = gamepad.axes[1] ?? 0;
      repeat("up",    heldAny(bindingButtons("spatialUp"))    || stickY < -0.5, () => move(-1, 0));
      repeat("down",  heldAny(bindingButtons("spatialDown"))  || stickY >  0.5, () => move(1, 0));
      repeat("left",  heldAny(bindingButtons("spatialLeft"))  || stickX < -0.5, () => move(0, -1));
      repeat("right", heldAny(bindingButtons("spatialRight")) || stickX >  0.5, () => move(0, 1));

      if (justAny(bindingButtons("primary"))) {
        const { row: r, col: c } = posRef.current;
        pressAt(r, c);
      }
      repeat("bksp", heldAny(bindingButtons("back")), () => {
        if (targetRef.current) backspace(targetRef.current);
      });
      if (justAny([GP_SPACE]) && targetRef.current) insertText(targetRef.current, " ");
      if (justAny([GP_SHIFT])) setLayer((l) => (l === "upper" ? "lower" : "upper"));
      if (justAny(bindingButtons("gamepadSettingsMenu"))) close();

      prevGpRef.current = [...curr];
    };
    const id = window.setInterval(tick, 40);
    return () => window.clearInterval(id);
  }, [oskOpen, gamepadNavigationEnabled, layer, pressAt, close, rowLen, setPos]);

  if (!oskOpen) return null;

  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

  const actionLabel = (a: ActionId) => {
    if (a === "shift") return <ArrowBigUp className="w-4 h-4" />;
    if (a === "sym") return layer === "sym" ? "ABC" : "?#!";
    if (a === "space") return <Space className="w-4 h-4" />;
    if (a === "backspace") return <Delete className="w-4 h-4" />;
    return <Check className="w-4 h-4" />;
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[250] flex justify-center pointer-events-none"
      aria-hidden
    >
      <div
        className={cn(
          "pointer-events-auto mb-3 w-[min(96vw,44rem)] rounded-2xl border border-white/10",
          "bg-card/95 backdrop-blur-xl p-3 shadow-2xl select-none"
        )}
        onMouseDown={keepFocus}
      >
        <div className="flex flex-col gap-1.5">
          {rows.map((entry, r) => (
            <div key={r} className="flex justify-center gap-1.5">
              {(typeof entry === "string" ? entry.split("") : entry).map((key, c) => {
                const focused = row === r && col === c;
                const isAction = typeof entry !== "string";
                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    tabIndex={-1}
                    onMouseDown={keepFocus}
                    onClick={() => pressAt(r, c)}
                    className={cn(
                      "h-10 rounded-lg text-sm font-medium flex items-center justify-center",
                      "bg-white/[0.06] text-white/85 transition-colors hover:bg-white/15",
                      isAction ? (key === "space" ? "flex-[3]" : "flex-[1.4]") : "flex-1",
                      focused && "ring-2 ring-primary bg-primary/25 text-white"
                    )}
                  >
                    {isAction ? actionLabel(key as ActionId) : (key as string)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-[10px] text-muted-foreground/70">
          A select · B backspace · X space · Y shift · Start done
        </p>
      </div>
    </div>
  );
}
