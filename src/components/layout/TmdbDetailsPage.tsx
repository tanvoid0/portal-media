import { useLayoutEffect, useMemo } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useNavigationStore } from "@/stores/navigationStore";
import { TmdbDetailsContent } from "@/components/layout/TmdbDetailsContent";
import { DETAILS_FOCUS_MAX_INDEX } from "@/types/navigation";

export function TmdbDetailsPage() {
  const { mediaType, id } = useParams();
  const valid = mediaType === "movie" || mediaType === "tv";
  const numericId = useMemo(() => (id ? Number(id) : NaN), [id]);

  useLayoutEffect(() => {
    useNavigationStore.getState().setFocusArea("details");
    return () => {
      useNavigationStore.getState().setDetailsMaxIndex(DETAILS_FOCUS_MAX_INDEX);
      useNavigationStore.getState().setFocusArea("games");
    };
  }, []);

  if (!valid || !id || !Number.isFinite(numericId) || numericId <= 0) {
    return <Navigate to="/library/discover" replace />;
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <TmdbDetailsContent mediaType={mediaType} tmdbId={numericId} />
    </div>
  );
}
