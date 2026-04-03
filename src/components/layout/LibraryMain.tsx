import { useLayoutEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { GameGrid } from "@/components/GameGrid";
import { TmdbDiscoverGrid } from "@/components/layout/TmdbDiscoverGrid";
import { DISCOVER_CATEGORY_ID } from "@/types/game";
import { useGameStore } from "@/stores/gameStore";
import { useNavigationStore } from "@/stores/navigationStore";
import {
  isValidLibrarySection,
  categoryFromLibrarySection,
  categoryNavIndexForSection,
} from "@/nav/libraryRoutes";

function useSyncLibraryRoute(section: string | undefined) {
  const setSelectedCategory = useGameStore((s) => s.setSelectedCategory);
  const setCategoryIndex = useNavigationStore((s) => s.setCategoryIndex);

  useLayoutEffect(() => {
    if (!section || !isValidLibrarySection(section)) return;
    setSelectedCategory(categoryFromLibrarySection(section));
    setCategoryIndex(categoryNavIndexForSection(section));
  }, [section, setSelectedCategory, setCategoryIndex]);
}

export function LibraryMain() {
  const { section } = useParams<{ section: string }>();
  useSyncLibraryRoute(section);

  if (!isValidLibrarySection(section)) {
    return <Navigate to="/library/all" replace />;
  }

  const showDiscover = categoryFromLibrarySection(section) === DISCOVER_CATEGORY_ID;

  return (
    <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden relative">
        {showDiscover ? <TmdbDiscoverGrid /> : <GameGrid />}
      </div>
    </div>
  );
}
