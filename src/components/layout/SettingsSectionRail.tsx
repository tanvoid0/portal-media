import { NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Gamepad2, KeyRound, Library, Palette } from "lucide-react";

const sections = [
  { to: "/settings/game", label: "Library & sync", icon: Library },
  { to: "/settings/appearance", label: "Appearance", icon: Palette },
  { to: "/settings/api", label: "Metadata API", icon: KeyRound },
  { to: "/settings/controller", label: "Controller", icon: Gamepad2 },
] as const;

export function SettingsSectionRail() {
  return (
    <div className="flex flex-col items-center gap-2 w-full px-1">
      {sections.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} title={label} className="w-full flex justify-center">
          {({ isActive }) => (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "w-14 h-14 rounded-2xl transition-all duration-ps5 spring-ease transform-gpu",
                isActive
                  ? "bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30 scale-105"
                  : "hover:bg-foreground/5 text-muted-foreground hover:text-foreground hover:scale-105"
              )}
            >
              <Icon className={cn("w-6 h-6", isActive && "scale-105")} />
            </Button>
          )}
        </NavLink>
      ))}
    </div>
  );
}
