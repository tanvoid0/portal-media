import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SaveGameExplorer } from "@/components/saves/SaveGameExplorer";
import { appNavigate } from "@/nav/appNavigate";
import { Button } from "@/components/ui/button";
import { Cloud, HardDrive } from "lucide-react";

export function SettingsSavesPage() {
  return (
    <div className="space-y-6">
      <Card className="glass-dark border-white/10 overflow-hidden">
        <CardHeader className="space-y-1 pb-3">
          <div className="flex items-center gap-2 text-primary/90">
            <HardDrive className="w-5 h-5" aria-hidden />
            <CardTitle className="text-2xl font-semibold tracking-tight text-white">
              Save data explorer
            </CardTitle>
          </div>
          <CardDescription className="text-white/55 text-sm max-w-2xl">
            A console-style view of every save folder Portal found on this machine — grouped by game,
            with quick open and copy actions. Pair with cloud sync for backup across PCs.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 pt-0 pb-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-white/15 text-white hover:bg-white/10"
            onClick={() => appNavigate("/settings/game")}
          >
            <Cloud className="w-4 h-4 mr-2" aria-hidden />
            Cloud sync settings
          </Button>
        </CardContent>
      </Card>

      <SaveGameExplorer variant="settings" />
    </div>
  );
}
