import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGameStore } from "@/stores/gameStore";
import { Plus } from "lucide-react";

export function BookmarkManager() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const { addBookmark } = useGameStore();

  const handleAddBookmark = async () => {
    if (name && url) {
      await addBookmark(name, url);
      setName("");
      setUrl("");
      setShowAddForm(false);
    }
  };

  return (
    <Card className="glass-dark border-white/10">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-white">Bookmarks</CardTitle>
        <CardDescription className="text-white/60">Add bookmarks to launch web links</CardDescription>
      </CardHeader>
      <CardContent>
        {!showAddForm ? (
          <Button 
            onClick={() => setShowAddForm(true)}
            className="h-12 px-8 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="mr-2 w-5 h-5" />
            Add Bookmark
          </Button>
        ) : (
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Bookmark name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 glass-dark border-white/20 text-white placeholder:text-white/40 focus:border-primary/50"
            />
            <Input
              type="url"
              placeholder="URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-12 glass-dark border-white/20 text-white placeholder:text-white/40 focus:border-primary/50"
            />
            <div className="flex gap-3">
              <Button 
                onClick={handleAddBookmark}
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

