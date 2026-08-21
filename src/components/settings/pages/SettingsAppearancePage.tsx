import { ThemeAppearancePicker } from "@/components/settings/ThemeAppearancePicker";
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { useTheme } from "@/hooks/useTheme";

export function SettingsAppearancePage() {
  const { themeId, setThemeId } = useTheme();

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Appearance</PanelTitle>
        <PanelDescription>Theme and surfaces. Light/dark is in the top bar.</PanelDescription>
      </PanelHeader>
      <PanelBody>
        <ThemeAppearancePicker value={themeId} onChange={setThemeId} />
      </PanelBody>
    </Panel>
  );
}
