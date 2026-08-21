import { AiAssistSection } from "@/components/settings/AiAssistSection";
import { MetadataIntegrationsSection } from "@/components/settings/MetadataIntegrationsSection";

export function SettingsApiPage() {
  return (
    <div className="space-y-8">
      <MetadataIntegrationsSection />
      <AiAssistSection />
    </div>
  );
}
