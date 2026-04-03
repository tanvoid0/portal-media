import { useLayoutEffect, useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useNavigationStore } from "@/stores/navigationStore";
import { IgdbDetailsContent } from "@/components/layout/IgdbDetailsContent";
import { DETAILS_FOCUS_MAX_INDEX } from "@/types/navigation";

export function IgdbDetailsPage() {
  const { igdbId } = useParams();
  const numericId = useMemo(() => (igdbId ? Number(igdbId) : NaN), [igdbId]);

  useLayoutEffect(() => {
    useNavigationStore.getState().setFocusArea("details");
    return () => {
      useNavigationStore.getState().setDetailsMaxIndex(DETAILS_FOCUS_MAX_INDEX);
      useNavigationStore.getState().setFocusArea("games");
    };
  }, []);

  if (!igdbId || !Number.isFinite(numericId) || numericId <= 0) {
    return <Navigate to="/library/discover" replace />;
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <IgdbDetailsContent igdbId={numericId} />
    </div>
  );
}
