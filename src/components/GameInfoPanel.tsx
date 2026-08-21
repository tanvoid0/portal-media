import type { Game } from "@/stores/gameStore";

interface GameInfoPanelProps {
  game: Game | null;
}

/** Title lives on the tile caption. A blurred wash is not part of the control-deck chrome. */
export function GameInfoPanel(_props: GameInfoPanelProps) {
  return null;
}
