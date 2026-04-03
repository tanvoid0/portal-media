import type { KeyboardChord, NavActionId } from "@/types/navBindings";

export function chordMatches(chord: KeyboardChord, e: KeyboardEvent): boolean {
  if (chord.code) {
    if (e.code !== chord.code) return false;
  } else if (chord.key !== undefined && chord.key !== "") {
    if (e.key !== chord.key) return false;
  } else {
    return false;
  }
  const alt = chord.altKey ?? false;
  const ctrl = chord.ctrlKey ?? false;
  const shift = chord.shiftKey ?? false;
  const meta = chord.metaKey ?? false;
  return e.altKey === alt && e.ctrlKey === ctrl && e.shiftKey === shift && e.metaKey === meta;
}

export function anyChordMatches(chords: KeyboardChord[], e: KeyboardEvent): boolean {
  return chords.some((c) => chordMatches(c, e));
}

export function actionKeyboardMatches(
  enabled: boolean,
  chords: KeyboardChord[],
  e: KeyboardEvent
): boolean {
  return enabled && chords.length > 0 && anyChordMatches(chords, e);
}

/** Gamepad button considered pressed (digital or analog threshold). */
export function gamepadButtonDown(gamepad: Gamepad, index: number): boolean {
  const b = gamepad.buttons[index];
  if (!b) return false;
  return Boolean(b.pressed || b.value > 0.5);
}

export function snapshotGamepadButtons(gamepad: Gamepad, out: boolean[], maxIndex = 20): void {
  for (let i = 0; i <= maxIndex; i++) {
    out[i] = gamepadButtonDown(gamepad, i);
  }
}

/** True if any `indices` transitioned from released to pressed this frame. */
export function anyGamepadButtonJustPressed(
  indices: number[],
  prevDown: boolean[],
  currDown: boolean[]
): boolean {
  for (const idx of indices) {
    const now = currDown[idx] ?? false;
    const was = prevDown[idx] ?? false;
    if (now && !was) return true;
  }
  return false;
}

export type SpatialDirection = "up" | "down" | "left" | "right";

const SPATIAL_IDS: Record<SpatialDirection, NavActionId> = {
  up: "spatialUp",
  down: "spatialDown",
  left: "spatialLeft",
  right: "spatialRight",
};

export function spatialDirectionFromKeyboard(
  getAction: (id: NavActionId) => { enabled: boolean; keyboard: KeyboardChord[] },
  e: KeyboardEvent
): SpatialDirection | null {
  const order: SpatialDirection[] = ["up", "down", "left", "right"];
  for (const dir of order) {
    const id = SPATIAL_IDS[dir];
    const { enabled, keyboard } = getAction(id);
    if (actionKeyboardMatches(enabled, keyboard, e)) return dir;
  }
  return null;
}
