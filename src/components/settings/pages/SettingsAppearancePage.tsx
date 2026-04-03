import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeAppearancePicker } from "@/components/settings/ThemeAppearancePicker";
import { useTheme } from "@/hooks/useTheme";

export function SettingsAppearancePage() {
  const { themeId, setThemeId } = useTheme();

  return (
    <Card className="glass-dark border-white/10">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl font-semibold tracking-tight text-white">Appearance</CardTitle>
        <CardDescription className="text-white/55 text-sm">
          Theme and surfaces. Light/dark is in the top bar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <ThemeAppearancePicker value={themeId} onChange={setThemeId} />
      </CardContent>
    </Card>
  );
}
