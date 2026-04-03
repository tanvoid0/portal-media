import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Gamepad2, KeyRound, Library, Package, Palette } from "lucide-react";

const sections = [
  { to: "/settings/game", label: "Library & sync", icon: Library },
  { to: "/settings/streaming", label: "Streaming", icon: Package },
  { to: "/settings/appearance", label: "Appearance", icon: Palette },
  { to: "/settings/api", label: "Metadata API", icon: KeyRound },
  { to: "/settings/controller", label: "Controller", icon: Gamepad2 },
] as const;

export function SettingsSectionTabs() {
  return (
    <nav
      className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1 px-1 min-h-[3rem]"
      aria-label="Settings sections"
      style={{ scrollBehavior: "smooth", WebkitOverflowScrolling: "touch" }}
    >
      {sections.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 shrink-0 h-11 px-4 rounded-xl whitespace-nowrap transition-all duration-panel spring-ease",
              "border border-transparent",
              isActive
                ? "bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25"
                : "bg-muted/30 text-muted-foreground hover:bg-foreground/5 hover:text-foreground border-border/40"
            )
          }
        >
          <Icon className="w-4 h-4 shrink-0 opacity-90" aria-hidden />
          <span className="text-sm font-medium">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
