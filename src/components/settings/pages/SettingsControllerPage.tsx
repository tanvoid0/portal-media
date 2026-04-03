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
            On the library screen, use D-pad or left stick to move, A to launch, B to go back. In Settings, use Tab to
            move between controls; Escape or B returns to the library. The Home key always opens the library. Use the
            left rail to jump between Settings sections; the top bar Library button also returns to the grid.
          </p>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <p className="text-white/60 text-sm font-medium">Navigation</p>
              <p className="text-white/40 text-xs">D-pad or Left Stick</p>
            </div>
            <div className="space-y-2">
              <p className="text-white/60 text-sm font-medium">Launch</p>
              <p className="text-white/40 text-xs">A/X Button</p>
            </div>
            <div className="space-y-2">
              <p className="text-white/60 text-sm font-medium">Back</p>
              <p className="text-white/40 text-xs">B/Circle or Escape</p>
            </div>
            <div className="space-y-2">
              <p className="text-white/60 text-sm font-medium">Menu / Home</p>
              <p className="text-white/40 text-xs">Start — sidebar; from Settings, library</p>
            </div>
            <div className="space-y-2">
              <p className="text-white/60 text-sm font-medium">Search (library)</p>
              <p className="text-white/40 text-xs">/ key or Y / Triangle</p>
            </div>
            <div className="space-y-2">
              <p className="text-white/60 text-sm font-medium">Shell focus (library)</p>
              <p className="text-white/40 text-xs">Tab — rail, categories, grid</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
