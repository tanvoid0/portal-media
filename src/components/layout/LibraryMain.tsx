import { GameGrid } from "@/components/GameGrid";
import { GameDetailsSidebar } from "@/components/GameDetailsSidebar";

export function LibraryMain() {
  return (
    <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-w-0 overflow-hidden relative">
          <GameGrid />
        </div>
        <GameDetailsSidebar />
      </div>
    </div>
  );
}
