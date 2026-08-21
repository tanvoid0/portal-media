import { SaveGameExplorer } from "@/components/saves/SaveGameExplorer";
import { appNavigate } from "@/nav/appNavigate";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Cloud, HardDrive } from "lucide-react";

export function SettingsSavesPage() {
  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader>
          <div className="flex items-center gap-2 text-foreground">
            <HardDrive className="w-5 h-5" aria-hidden />
            <PanelTitle>Save data explorer</PanelTitle>
          </div>
          <PanelDescription>
            A console-style view of every save folder Portal found on this machine — grouped by game,
            with quick open and copy actions. Pair with cloud sync for backup across PCs.
          </PanelDescription>
        </PanelHeader>
        <PanelBody className="flex flex-wrap gap-2 pt-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-none"
            onClick={() => appNavigate("/settings/game")}
          >
            <Cloud className="w-4 h-4" aria-hidden />
            Cloud sync settings
          </Button>
        </PanelBody>
      </Panel>

      <SaveGameExplorer variant="settings" />
    </div>
  );
}
