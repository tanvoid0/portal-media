import type { KeyboardChord } from "@/types/navBindings";

const CODE_LABELS: Record<string, string> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Space: "Space",
  Enter: "Enter",
  Escape: "Esc",
  Tab: "Tab",
  Slash: "/",
  Backquote: "`",
  ContextMenu: "Menu",
  BrowserBack: "Back",
  NumpadEnter: "Num Enter",
  Numpad8: "Num 8",
  Numpad2: "Num 2",
  Numpad4: "Num 4",
  Numpad6: "Num 6",
};

export function formatKeyboardChord(c: KeyboardChord): string {
  const parts: string[] = [];
  if (c.metaKey) parts.push("Win");
  if (c.ctrlKey) parts.push("Ctrl");
  if (c.altKey) parts.push("Alt");
  if (c.shiftKey) parts.push("Shift");
  const label =
    (c.code && CODE_LABELS[c.code]) ||
    (c.code?.startsWith("Key") ? c.code.slice(3) : c.code) ||
    c.key ||
    "?";
  parts.push(label);
  return parts.join("+");
}

export function chordEqual(a: KeyboardChord, b: KeyboardChord): boolean {
  return (
    (a.code || "") === (b.code || "") &&
    (a.key || "") === (b.key || "") &&
    (a.altKey ?? false) === (b.altKey ?? false) &&
    (a.ctrlKey ?? false) === (b.ctrlKey ?? false) &&
    (a.shiftKey ?? false) === (b.shiftKey ?? false) &&
    (a.metaKey ?? false) === (b.metaKey ?? false)
  );
}
