import { useState, useEffect, useCallback } from "react";
import { useBrowserStore } from "@/stores/browserStore";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoSettings, injectVideoManipulationScript } from "@/utils/videoCropper";


export function VideoControls() {
  const { activeTabId, tabs } = useBrowserStore();
  const [isOpen, setIsOpen] = useState(false);
  const [settings, setSettings] = useState<VideoSettings>({
    aspectRatio: "16:9",
    zoom: 100,
    positionX: 50,
    positionY: 50,
  });

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  const applyVideoSettings = useCallback(
    (newSettings: VideoSettings, tab: NonNullable<typeof activeTab>) => {
      try {
        const iframe = document.querySelector(
          'iframe[src*="' + tab.url + '"]'
        ) as HTMLIFrameElement;
        if (iframe) {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            injectVideoManipulationScript(iframeDoc, newSettings);
          }
        }
      } catch (_e) {
        console.log("Cannot apply video settings directly (cross-origin)");
      }
    },
    []
  );

  useEffect(() => {
    if (!activeTab) return;

    const domain = new URL(activeTab.url).hostname;
    const saved = localStorage.getItem(`videoSettings_${domain}`);
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (err) {
        console.error("Failed to load video settings:", err);
      }
    }

    applyVideoSettings(settings, activeTab);
  }, [activeTab, applyVideoSettings, settings]);

  const handleAspectRatioChange = (ratio: string) => {
    const newSettings = { ...settings, aspectRatio: ratio };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleZoomChange = (value: number[]) => {
    const newSettings = { ...settings, zoom: value[0] };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handlePositionChange = (axis: "x" | "y", value: number[]) => {
    const newSettings = {
      ...settings,
      [axis === "x" ? "positionX" : "positionY"]: value[0],
    };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const saveSettings = (newSettings: VideoSettings) => {
    if (!activeTab) return;
    const domain = new URL(activeTab.url).hostname;
    localStorage.setItem(`videoSettings_${domain}`, JSON.stringify(newSettings));
    applyVideoSettings(newSettings, activeTab);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isOpen]);

  if (!activeTab) return null;

  const aspectRatios = [
    { label: "16:9", value: "16:9" },
    { label: "21:9", value: "21:9" },
    { label: "32:9", value: "32:9" },
    { label: "4:3", value: "4:3" },
    { label: "Custom", value: "custom" },
  ];

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className={cn(
          "fixed bottom-4 right-4 z-[101]",
          isOpen && "bg-primary text-primary-foreground"
        )}
        onClick={() => setIsOpen(!isOpen)}
        title="Video Controls"
      >
        <Maximize2 className="h-4 w-4" />
      </Button>

      {isOpen && (
        <div className="fixed bottom-16 right-4 w-80 bg-card border border-border rounded-lg shadow-xl p-4 z-[101]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Video Controls</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsOpen(false)}
            >
              <Minimize2 className="h-3 w-3" />
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">
                Aspect Ratio
              </label>
              <div className="flex flex-wrap gap-2">
                {aspectRatios.map((ratio) => (
                  <Button
                    key={ratio.value}
                    variant={settings.aspectRatio === ratio.value ? "default" : "outline"}
                    size="sm"
                    className="text-xs"
                    onClick={() => handleAspectRatioChange(ratio.value)}
                  >
                    {ratio.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-2 block">
                Zoom: {settings.zoom}%
              </label>
              <Slider
                value={[settings.zoom]}
                onValueChange={handleZoomChange}
                min={50}
                max={200}
                step={5}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-2 block">
                Position X: {settings.positionX}%
              </label>
              <Slider
                value={[settings.positionX]}
                onValueChange={(v) => handlePositionChange("x", v)}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-2 block">
                Position Y: {settings.positionY}%
              </label>
              <Slider
                value={[settings.positionY]}
                onValueChange={(v) => handlePositionChange("y", v)}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

