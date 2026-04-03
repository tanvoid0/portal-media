import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StreamingAddonSettingsSection } from "@/components/settings/StreamingAddonSettingsSection";

export function SettingsStreamingPage() {
  return (
    <Card className="glass-dark border-white/10">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-white">Streaming add-ons</CardTitle>
        <CardDescription className="text-white/60">
          Catalog archives, app data folder, and optional overrides
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <StreamingAddonSettingsSection embedded />
      </CardContent>
    </Card>
  );
}
