import { useNavigationStore, type FocusArea, type InputMethod } from "@/stores/navigationStore";

/**
 * Abstraction hook for components to check navigation state
 * without directly accessing the navigation store.
 * 
 * Components should use this instead of useNavigationStore directly
 * to maintain abstraction and allow for future changes.
 */
/** Directional / OK / Back style input (not pointer). */
function isSpatialInputMethod(method: InputMethod): boolean {
  return method === "gamepad" || method === "keyboard";
}

export function useNavigationState() {
  const { inputMethod, focusArea } = useNavigationStore();

  return {
    inputMethod,
    focusArea,
    isGamepadActive: inputMethod === "gamepad",
    isKeyboardActive: inputMethod === "keyboard",
    isMouseActive: inputMethod === "mouse",
    /** Remote, keyboard arrows, or gamepad — use for focus rings / scroll-into-view policy. */
    isSpatialInput: isSpatialInputMethod(inputMethod),
  };
}

/**
 * Hook for components that need to check if they are focused/selected
 * based on the current navigation state.
 * 
 * @param area - The focus area this component belongs to
 * @param index - The index of this item within the focus area
 * @returns Object with focus/selection state
 */
export function useFocusable(area: FocusArea, index: number) {
  const { focusArea, inputMethod } = useNavigationStore();

  const isFocused = focusArea === area;
  const isSelected = isFocused && index !== undefined;
  const showFocusIndicator = isFocused && isSpatialInputMethod(inputMethod);
  
  return {
    isFocused,
    isSelected,
    showFocusIndicator,
    inputMethod,
  };
}

/**
 * Hook for components that need to check if they should show selection state
 * (typically for game cards or selectable items).
 * 
 * @param isSelected - Whether this item is currently selected
 * @returns Object with selection state information
 */
export function useSelectable(isSelected: boolean) {
  const { inputMethod, focusArea } = useNavigationStore();
  
  const mainColumnFocused = focusArea === "games" || focusArea === "details";
  const spatial = isSpatialInputMethod(inputMethod);
  const showSelection = isSelected && mainColumnFocused && spatial;
  const shouldScrollIntoView = isSelected && focusArea === "games" && spatial;

  return {
    showSelection,
    shouldScrollIntoView,
    inputMethod,
    isGamepadActive: inputMethod === "gamepad",
    isSpatialInput: spatial,
  };
}

