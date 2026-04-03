import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StreamingAddonSettingsSection } from "@/components/settings/StreamingAddonSettingsSection";

export function SettingsStreamingPage() {
  return (
    <Card className="glass-dark border-white/10">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl font-semibold tracking-tight text-white">Streaming add-ons</CardTitle>
        <CardDescription className="text-white/55 text-sm">
          Plugin folder, optional zip override, detected archives.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-0">
        <StreamingAddonSettingsSection embedded />
      </CardContent>
    </Card>
  );
}
