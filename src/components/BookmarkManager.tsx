import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    <Card className="glass-dark border-white/10">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-white">Streaming &amp; bookmarks</CardTitle>
        <CardDescription className="text-white/60">
          Add streaming sites or generic web links. They appear in the same library as scanned titles; icons use the
          site favicon when possible.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && showAddForm && (
          <p className="text-sm text-red-400 bg-red-950/40 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>
        )}
        {!showAddForm ? (
          <Button 
            onClick={() => {
              clearError();
              setShowAddForm(true);
            }}
            className="h-12 px-8 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="mr-2 w-5 h-5" />
            Add link
          </Button>
        ) : (
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Name (e.g. League of Legends — web client)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 glass-dark border-white/20 text-white placeholder:text-white/40 focus:border-primary/50"
            />
            <div className="flex flex-col gap-2">
              <span className="text-xs text-white/50 uppercase tracking-wide">Type</span>
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant={category === "Media" ? "default" : "outline"}
                  size="sm"
                  className={
                    category === "Media"
                      ? ""
                      : "border-white/20 text-white/80 hover:bg-white/10 bg-transparent"
                  }
                  onClick={() => setCategory("Media")}
                >
                  <Film className="w-4 h-4 mr-1.5" />
                  Streaming / media
                </Button>
                <Button
                  type="button"
                  variant={category === "Bookmark" ? "default" : "outline"}
                  size="sm"
                  className={
                    category === "Bookmark"
                      ? ""
                      : "border-white/20 text-white/80 hover:bg-white/10 bg-transparent"
                  }
                  onClick={() => setCategory("Bookmark")}
                >
                  <Link2 className="w-4 h-4 mr-1.5" />
                  Bookmark
                </Button>
              </div>
            </div>
            <Input
              type="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-12 glass-dark border-white/20 text-white placeholder:text-white/40 focus:border-primary/50"
            />
            <div className="flex gap-3">
              <Button 
                onClick={() => void handleAddBookmark()}
                className="h-12 px-8 font-semibold bg-primary hover:bg-primary/90"
              >
                Add
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowAddForm(false)}
                className="h-12 px-8 border-white/20 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

