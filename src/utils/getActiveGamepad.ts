/**
 * Returns the first connected, non-null gamepad slot.
 * Prefer this over `navigator.getGamepads()[0]` — slot 0 can be empty
 * after a controller reconnects into a higher-numbered slot.
 */
export function getActiveGamepad(): Gamepad | null {
  const pads = navigator.getGamepads();
  for (let i = 0; i < pads.length; i++) {
    if (pads[i] !== null) return pads[i];
  }
  return null;
}
