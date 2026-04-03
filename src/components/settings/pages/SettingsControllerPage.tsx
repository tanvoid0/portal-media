import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SettingsControllerPage() {
  return (
    <Card className="glass-dark border-white/10">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-white">Controller</CardTitle>
        <CardDescription className="text-white/60">Gamepad and remote shortcuts in the shell</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="glass rounded-xl p-6 space-y-3">
          <p className="text-white/80">
            The library uses a horizontal category strip under the top bar (no left rail). D-pad or left stick moves the
            focus; Tab cycles shell buttons, categories, and the grid.             Item details open as a full page (route) — click a tile, or press A / Enter on the focused tile.
            Square / X (button 2) on the library grid quick-launches without opening the details page. <strong>Home</strong>{" "}
            on the library or
            details routes opens Quick access (settings link, app switcher, resume browser). From
            Settings or other views, Home still returns to the library. View / Select (button 8) also
            toggles Quick access on the library. Options / Menu (button 9) opens the bottom game
            options sheet when a tile is focused. Context Menu or F10 does the same; otherwise it focuses the shell
            chrome. Start (8 / 9 combined on some pads) in Settings exits to the library; with the
            in-app browser fullscreen it closes the browser. The Xbox Guide and PlayStation Home buttons are often not
            visible to the web view — use View + Options or the keyboard if a control does not respond. The app switcher
            can focus another Windows process when Portal received a PID from a direct executable launch; Steam and
            other URI launches usually cannot be focused by PID. On the keyboard, <strong>Win</strong> (tap without
            another key) toggles Quick access the same way as Home or View (Start may still open on some systems if the OS
            captures the key first). <strong>Alt+F4</strong> exits the app immediately.
          </p>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <p className="text-white/60 text-sm font-medium">Navigation</p>
              <p className="text-white/40 text-xs">D-pad or left stick</p>
            </div>
            <div className="space-y-2">
              <p className="text-white/60 text-sm font-medium">Open details</p>
              <p className="text-white/40 text-xs">A / Cross — Enter</p>
            </div>
            <div className="space-y-2">
              <p className="text-white/60 text-sm font-medium">Back</p>
              <p className="text-white/40 text-xs">B / Circle or Escape</p>
            </div>
            <div className="space-y-2">
              <p className="text-white/60 text-sm font-medium">Quick launch (grid)</p>
              <p className="text-white/40 text-xs">Square / X (button 2)</p>
            </div>
            <div className="space-y-2">
              <p className="text-white/60 text-sm font-medium">Quick access</p>
              <p className="text-white/40 text-xs">Win · Home on library · View (button 8)</p>
            </div>
            <div className="space-y-2">
              <p className="text-white/60 text-sm font-medium">Quit app</p>
              <p className="text-white/40 text-xs">Alt+F4</p>
            </div>
            <div className="space-y-2">
              <p className="text-white/60 text-sm font-medium">Game options sheet</p>
              <p className="text-white/40 text-xs">Menu / Options (9); Context Menu</p>
            </div>
            <div className="space-y-2">
              <p className="text-white/60 text-sm font-medium">Search</p>
              <p className="text-white/40 text-xs">/ key or Y / Triangle</p>
            </div>
            <div className="space-y-2">
              <p className="text-white/60 text-sm font-medium">Shell focus</p>
              <p className="text-white/40 text-xs">Tab — chrome, categories, grid</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
