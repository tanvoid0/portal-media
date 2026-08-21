import { StreamingAddonSettingsSection } from "@/components/settings/StreamingAddonSettingsSection";
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from "@/components/ui/panel";

export function SettingsStreamingPage() {
  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Streaming add-ons</PanelTitle>
        <PanelDescription>Plugin folder, optional zip override, detected archives.</PanelDescription>
      </PanelHeader>
      <PanelBody>
        <StreamingAddonSettingsSection embedded />
      </PanelBody>
    </Panel>
  );
}
