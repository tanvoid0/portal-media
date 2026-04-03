import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGameStore } from "@/stores/gameStore";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Game } from "@/types/game";
import { FolderOpen, Gamepad2, Monitor, Plus } from "lucide-react";

export function LibraryManualAddSection() {
  const scanGames = useGameStore((s) => s.scanGames);
  const error = useGameStore((s) => s.error);
  const clearError = useGameStore((s) => s.clearError);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"Game" | "App">("Game");
  const [targetPath, setTargetPath] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setShowForm(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [showForm]);

  const pickShortcutOrExe = async () => {
    clearError();
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          { name: "Shortcuts & programs", extensions: ["lnk", "exe", "url"] },
          { name: "Shell shortcuts", extensions: ["lnk"] },
          { name: "Programs", extensions: ["exe"] },
          { name: "Internet shortcuts", extensions: ["url"] },
        ],
        title: "Choose a shortcut or program",
      });
      const path = typeof selected === "string" ? selected : null;
      if (!path) return;
      setTargetPath(path);
      setName((prev) => {
        if (prev.trim()) return prev;
        const base = path.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/i, "");
        return base || prev;
      });
    } catch (e) {
      useGameStore.setState({
        error:
          typeof e === "string" ? e : e instanceof Error ? e.message : "Could not open file picker.",
      });
    }
  };

  const handleAdd = async () => {
    const n = name.trim();
    const p = targetPath.trim();
    if (!n || !p) return;
    setBusy(true);
    clearError();
    try {
      await invoke<Game>("library_manual_add", {
        add: { kind: "executable", name: n, category, targetPath: p },
      });
      await scanGames();
      setName("");
      setTargetPath("");
      setShowForm(false);
    } catch (e) {
      useGameStore.setState({
        error:
          typeof e === "string" ? e : e instanceof Error ? e.message : "Could not add this entry.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="glass-dark border-white/10">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-white">Add to library</CardTitle>
        <CardDescription className="text-white/60">
          Scanning and platform sync use the same grid as titles you add here. After you add something, it shows up like
          any other tile—archive, hide from tabs, favorites, and launch behave the same. Use this when a title never
          appeared in a scan (for example only a Start Menu <span className="text-white/80">.lnk</span>). Targets can be
          a <span className="text-white/80">.exe</span>, <span className="text-white/80">.lnk</span>, or{" "}
          <span className="text-white/80">.url</span>—use <span className="text-white/80">Choose file…</span> or paste a
          path. Streaming and site links are in the next card. Persisted rows live in{" "}
          <span className="text-white/80">portal_library.db</span> and are merged every time the library is scanned.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <p className="text-sm text-red-400 bg-red-950/40 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>
        )}
        {!showForm ? (
          <Button
            onClick={() => {
              clearError();
              setShowForm(true);
            }}
            className="h-12 px-8 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="mr-2 w-5 h-5" />
            Add program or shortcut…
          </Button>
        ) : (
          <div className="space-y-4 max-w-xl">
            <Input
              type="text"
              placeholder="Display name (e.g. League of Legends)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 glass-dark border-white/20 text-white placeholder:text-white/40 focus:border-primary/50"
            />
            <div className="flex flex-col gap-2">
              <span className="text-xs text-white/50 uppercase tracking-wide">Category</span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={category === "Game" ? "default" : "outline"}
                  size="sm"
                  className={
                    category === "Game"
                      ? ""
                      : "border-white/20 text-white/80 hover:bg-white/10 bg-transparent"
                  }
                  onClick={() => setCategory("Game")}
                >
                  <Gamepad2 className="w-4 h-4 mr-1.5" />
                  Game
                </Button>
                <Button
                  type="button"
                  variant={category === "App" ? "default" : "outline"}
                  size="sm"
                  className={
                    category === "App"
                      ? ""
                      : "border-white/20 text-white/80 hover:bg-white/10 bg-transparent"
                  }
                  onClick={() => setCategory("App")}
                >
                  <Monitor className="w-4 h-4 mr-1.5" />
                  App
                </Button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 max-w-xl">
              <Input
                type="text"
                placeholder="Full path to .exe, .lnk, or .url"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                className="h-12 flex-1 glass-dark border-white/20 text-white placeholder:text-white/40 focus:border-primary/50 font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void pickShortcutOrExe()}
                className="h-12 px-5 shrink-0 border-white/20 text-white hover:bg-white/10"
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Choose file…
              </Button>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => void handleAdd()}
                disabled={busy || !name.trim() || !targetPath.trim()}
                className="h-12 px-8 font-semibold bg-primary hover:bg-primary/90"
              >
                {busy ? "Saving…" : "Add to library"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowForm(false)}
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
