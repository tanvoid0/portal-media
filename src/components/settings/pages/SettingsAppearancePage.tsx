import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeAppearancePicker } from "@/components/settings/ThemeAppearancePicker";
import { useTheme } from "@/hooks/useTheme";

export function SettingsAppearancePage() {
  const { themeId, setThemeId } = useTheme();

  return (
    <Card className="glass-dark border-white/10">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-white">Appearance</CardTitle>
        <CardDescription className="text-white/60">Theme, typography, and surface styling</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-white/60 text-sm">
          UI theme (colors, typography, corners, shadows on cards, buttons, and inputs). Light/dark mode is toggled
          from the top bar.
        </p>
        <ThemeAppearancePicker value={themeId} onChange={setThemeId} />
      </CardContent>
    </Card>
  );
}
