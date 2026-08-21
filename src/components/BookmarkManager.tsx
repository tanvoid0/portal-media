import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FrameKey } from "@/components/ui/frame-key";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { useGameStore } from "@/stores/gameStore";
import { Film, Link2, Plus } from "lucide-react";

export function BookmarkManager() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState<"Media" | "Bookmark">("Media");
  const { addBookmark, clearError, error } = useGameStore();

  const handleAddBookmark = async () => {
    if (name.trim() && url.trim()) {
      clearError();
      await addBookmark(name, url, category);
      if (!useGameStore.getState().error) {
        setName("");
        setUrl("");
        setShowAddForm(false);
      }
    }
  };

  useEffect(() => {
    if (!showAddForm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setShowAddForm(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [showAddForm]);

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Bookmarks</PanelTitle>
        <PanelDescription>Web links in your library; favicons when available.</PanelDescription>
      </PanelHeader>
      <PanelBody className="space-y-4">
        {error && showAddForm ? (
          <p className="rounded-none border border-destructive/40 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {!showAddForm ? (
          <Button
            className="h-10 rounded-none px-5"
            onClick={() => {
              clearError();
              setShowAddForm(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add link
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bookmark-name">Name</Label>
              <Input
                id="bookmark-name"
                type="text"
                placeholder="Name (e.g. League of Legends — web client)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Type</span>
              <div className="flex flex-wrap gap-2">
                <FrameKey active={category === "Media"} onClick={() => setCategory("Media")}>
                  <Film className="h-4 w-4" />
                  Streaming / media
                </FrameKey>
                <FrameKey active={category === "Bookmark"} onClick={() => setCategory("Bookmark")}>
                  <Link2 className="h-4 w-4" />
                  Bookmark
                </FrameKey>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bookmark-url">URL</Label>
              <Input
                id="bookmark-url"
                type="url"
                placeholder="https://…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button className="h-12 rounded-none px-8" onClick={() => void handleAddBookmark()}>
                Add
              </Button>
              <Button
                variant="outline"
                className="h-12 rounded-none px-8"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}
