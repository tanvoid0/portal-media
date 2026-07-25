/**
 * Renders a single input button badge — Xbox colored circle, PlayStation symbol,
 * shoulder pill, or keyboard keycap — depending on the active input method.
 *
 * Gamepad button indices follow the W3C Standard Gamepad mapping:
 *   0=A/✕  1=B/○  2=X/□  3=Y/△
 *   4=LB/L1  5=RB/R1  6=LT/L2  7=RT/R2
 *   8=Back/Create  9=Menu/Options  12-15=D-pad ↑↓←→
 */

import type { ControllerLayoutKind } from "@/navigation/controllerProfile";
import type { InputMethod } from "@/types/navigation";

type FaceDef = { label: string; bg: string };

const FACE_XBOX: Record<number, FaceDef> = {
  0: { label: "A", bg: "#3a9e3a" },
  1: { label: "B", bg: "#c03030" },
  2: { label: "X", bg: "#2878c8" },
  3: { label: "Y", bg: "#c8a018" },
};

const FACE_PS: Record<number, FaceDef> = {
  0: { label: "✕", bg: "#2878c8" },
  1: { label: "○", bg: "#c83820" },
  2: { label: "□", bg: "#b83090" },
  3: { label: "△", bg: "#289a48" },
};

const FACE_GENERIC: Record<number, FaceDef> = {
  0: { label: "0", bg: "rgba(255,255,255,0.22)" },
  1: { label: "1", bg: "rgba(255,255,255,0.22)" },
  2: { label: "2", bg: "rgba(255,255,255,0.22)" },
  3: { label: "3", bg: "rgba(255,255,255,0.22)" },
};

const SHOULDER: Record<ControllerLayoutKind, Record<number, string>> = {
  letters: { 4: "LB", 5: "RB", 6: "LT", 7: "RT" },
  shapes:  { 4: "L1", 5: "R1", 6: "L2", 7: "R2" },
  generic: { 4: "L",  5: "R",  6: "L2", 7: "R2" },
};

const SPECIAL: Record<ControllerLayoutKind, Record<number, string>> = {
  letters: { 8: "Back",   9: "☰" },
  shapes:  { 8: "Create", 9: "Options" },
  generic: { 8: "Sel",    9: "Start" },
};

const DPAD: Record<number, string> = { 12: "↑", 13: "↓", 14: "←", 15: "→" };

interface InputGlyphProps {
  inputMethod: InputMethod;
  layout: ControllerLayoutKind;
  gamepadButton?: number;
  keyboard?: string;
}

export function InputGlyph({ inputMethod, layout, gamepadButton, keyboard }: InputGlyphProps) {
  if (inputMethod === "gamepad" && gamepadButton !== undefined) {
    // Face buttons — colored circles
    if (gamepadButton >= 0 && gamepadButton <= 3) {
      const map = layout === "letters" ? FACE_XBOX : layout === "shapes" ? FACE_PS : FACE_GENERIC;
      const def = map[gamepadButton];
      if (!def) return null;
      return (
        <span
          style={{ backgroundColor: def.bg, width: 20, height: 20 }}
          className="inline-flex items-center justify-center rounded-full text-[10px] font-bold text-white flex-shrink-0 leading-none select-none"
        >
          {def.label}
        </span>
      );
    }

    // Shoulder / trigger buttons — pill
    if (gamepadButton >= 4 && gamepadButton <= 7) {
      return (
        <span className="inline-flex items-center px-[7px] py-[2px] rounded bg-white/[0.16] border border-white/[0.24] text-[10px] font-semibold text-white/90 flex-shrink-0 leading-none select-none">
          {SHOULDER[layout][gamepadButton] ?? `B${gamepadButton}`}
        </span>
      );
    }

    // Special buttons (Back/Create, Menu/Options) — small pill
    if (gamepadButton === 8 || gamepadButton === 9) {
      return (
        <span className="inline-flex items-center px-[6px] py-[2px] rounded bg-white/[0.12] border border-white/[0.18] text-[10px] font-medium text-white/75 flex-shrink-0 leading-none select-none">
          {SPECIAL[layout][gamepadButton] ?? `B${gamepadButton}`}
        </span>
      );
    }

    // D-pad
    if (DPAD[gamepadButton]) {
      return (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-white/[0.15] border border-white/[0.22] text-[11px] text-white/90 flex-shrink-0 select-none">
          {DPAD[gamepadButton]}
        </span>
      );
    }

    return null;
  }

  // Keyboard keycap
  if (keyboard) {
    return (
      <kbd className="inline-flex items-center justify-center px-[6px] py-[2px] rounded border border-white/[0.28] border-b-2 bg-white/[0.11] text-[10px] font-semibold text-white/90 flex-shrink-0 leading-none select-none min-w-[20px]"
        style={{ fontFamily: "var(--font-mono, monospace)" }}
      >
        {keyboard}
      </kbd>
    );
  }

  return null;
}
