/**
 * Heuristic controller layout for hint glyphs (Gamepad API id string varies by browser/OS).
 */
export type ControllerLayoutKind = "xbox" | "playstation" | "generic";

export function detectControllerLayout(gamepad: Gamepad | null): ControllerLayoutKind {
  if (!gamepad) return "generic";
  const id = (gamepad.id || "").toLowerCase();
  if (id.includes("xbox") || id.includes("microsoft")) return "xbox";
  if (
    id.includes("playstation") ||
    id.includes("dualsense") ||
    id.includes("dualshock") ||
    id.includes("sony") ||
    id.includes("054c") // Sony USB vendor
  ) {
    return "playstation";
  }
  return "generic";
}

export type HintAction =
  | "select"
  | "back"
  | "menu"
  | "search"
  | "view"
  | "tab"
  | "lb"
  | "rb";

const LABELS: Record<ControllerLayoutKind, Record<HintAction, string>> = {
  xbox: {
    select: "A",
    back: "B",
    menu: "☰",
    search: "Y",
    view: "☷",
    tab: "View / Menu",
    lb: "LB",
    rb: "RB",
  },
  playstation: {
    select: "✕",
    back: "○",
    menu: "Options",
    search: "△",
    view: "□",
    tab: "Create / Options",
    lb: "L1",
    rb: "R1",
  },
  generic: {
    select: "0",
    back: "1",
    menu: "9",
    search: "3",
    view: "8",
    tab: "8 / 9",
    lb: "4",
    rb: "5",
  },
};

export function hintGlyph(kind: ControllerLayoutKind, action: HintAction): string {
  return LABELS[kind][action];
}
