import { useState, useEffect } from "react";
import { useBrowserStore } from "@/stores/browserStore";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { getSitePermissions, setSitePermissions, type SitePermissions } from "@/utils/cookieManager";
import { Cookie, Ban, Square } from "lucide-react";
import { cn } from "@/lib/utils";

export function SitePermissions() {
  const { activeTabId, tabs } = useBrowserStore();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const [permissions, setPermissions] = useState<SitePermissions>({
    allowCookies: false,
    allowAds: false,
    allowPopups: false,
  });

  useEffect(() => {
    if (!activeTab) return;

    try {
      const domain = new URL(activeTab.url).hostname;
      const sitePerms = getSitePermissions(domain);
      setPermissions(sitePerms);
    } catch (_e) {
      // Invalid URL or cross-origin
      setPermissions({
        allowCookies: false,
        allowAds: false,
        allowPopups: false,
      });
    }
  }, [activeTab]);

  if (!activeTab) return null;

  const domain = (() => {
    try {
      return new URL(activeTab.url).hostname.replace("www.", "");
    } catch {
      return activeTab.url;
    }
  })();

  const handleToggle = async (key: keyof SitePermissions) => {
    const newPermissions = { ...permissions, [key]: !permissions[key] };
    setPermissions(newPermissions);
    setSitePermissions(domain, newPermissions);
    
    // Inject scripts with new permissions
    const { invoke } = await import("@tauri-apps/api/core");
    try {
      if (activeTabId) {
        await invoke("inject_scripts_with_permissions", {
          tabId: activeTabId,
          allowCookies: newPermissions.allowCookies,
          allowAds: newPermissions.allowAds,
          allowPopups: newPermissions.allowPopups,
        });
      }
    } catch (e) {
      console.error("Failed to update permissions:", e);
    }
  };

  return (
    <Card className="glass-dark border-white/10">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-white">Site Permissions</CardTitle>
        <CardDescription className="text-white/60">
          {domain}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cookie className="w-4 h-4 text-foreground/60" />
            <span className="text-sm text-foreground">Allow Cookies</span>
          </div>
          <Button
            variant={permissions.allowCookies ? "default" : "outline"}
            size="sm"
            onClick={() => handleToggle("allowCookies")}
            className={cn(
              "w-16",
              permissions.allowCookies && "bg-primary text-primary-foreground"
            )}
          >
            {permissions.allowCookies ? "Allow" : "Deny"}
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ban className="w-4 h-4 text-foreground/60" />
            <span className="text-sm text-foreground">Allow Ads</span>
          </div>
          <Button
            variant={permissions.allowAds ? "default" : "outline"}
            size="sm"
            onClick={() => handleToggle("allowAds")}
            className={cn(
              "w-16",
              permissions.allowAds && "bg-primary text-primary-foreground"
            )}
          >
            {permissions.allowAds ? "Allow" : "Block"}
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Square className="w-4 h-4 text-foreground/60" />
            <span className="text-sm text-foreground">Allow Popups</span>
          </div>
          <Button
            variant={permissions.allowPopups ? "default" : "outline"}
            size="sm"
            onClick={() => handleToggle("allowPopups")}
            className={cn(
              "w-16",
              permissions.allowPopups && "bg-primary text-primary-foreground"
            )}
          >
            {permissions.allowPopups ? "Allow" : "Block"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

