/**
 * Shared model for poster / library tiles tuned for remote-first (gamepad, D-pad)
 * navigation. Pointer hover can share the same visual language at lower intensity.
 */
export interface ContentTileRemoteFocus {
  /** True when the grid selection is on this tile and remote-style affordance should show. */
  showRemoteFocus: boolean;
  /** True when selected via click while not showing remote chrome (mouse / touch). */
  mouseSelected: boolean;
}
