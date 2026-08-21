import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FrameKey } from "@/components/ui/frame-key";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from "@/components/ui/panel";
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
    <Panel>
      <PanelHeader>
        <PanelTitle>Add to library</PanelTitle>
        <PanelDescription>
          Add a missing <span className="text-foreground">.exe</span>,{" "}
          <span className="text-foreground">.lnk</span>, or{" "}
          <span className="text-foreground">.url</span>. Merges on the next scan.
        </PanelDescription>
      </PanelHeader>
      <PanelBody className="space-y-5">
        {error ? (
          <p className="rounded-none border border-destructive/40 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {!showForm ? (
          <Button
            className="h-10 rounded-none px-5"
            onClick={() => {
              clearError();
              setShowForm(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add program or shortcut
          </Button>
        ) : (
          <div className="max-w-xl space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="manual-add-name">Display name</Label>
              <Input
                id="manual-add-name"
                type="text"
                placeholder="Display name (e.g. League of Legends)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Category</span>
              <div className="flex gap-2">
                <FrameKey active={category === "Game"} onClick={() => setCategory("Game")}>
                  <Gamepad2 className="h-4 w-4" />
                  Game
                </FrameKey>
                <FrameKey active={category === "App"} onClick={() => setCategory("App")}>
                  <Monitor className="h-4 w-4" />
                  App
                </FrameKey>
              </div>
            </div>
            <div className="flex max-w-xl flex-col gap-2 sm:flex-row">
              <Input
                type="text"
                placeholder="Full path to .exe, .lnk, or .url"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                className="h-12 flex-1 font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void pickShortcutOrExe()}
                className="h-12 shrink-0 rounded-none px-5"
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Choose file…
              </Button>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => void handleAdd()}
                disabled={busy || !name.trim() || !targetPath.trim()}
                className="h-12 rounded-none px-8"
              >
                {busy ? "Saving…" : "Add to library"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowForm(false)}
                className="h-12 rounded-none px-8"
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
