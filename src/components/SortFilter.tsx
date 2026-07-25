import { useGameStore, SortType } from "@/stores/gameStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowUpAZ, Clock, Grid3x3 } from "lucide-react";

const sortOptions: { type: SortType; label: string; icon: typeof ArrowUpAZ }[] = [
  { type: "default", label: "Default", icon: Grid3x3 },
  { type: "alphabetical", label: "A-Z", icon: ArrowUpAZ },
  { type: "lastOpened", label: "Recent", icon: Clock },
];

export function SortFilter({
  orientation = "horizontal",
  className,
}: {
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  const { sortType, setSortType } = useGameStore();
  const isVertical = orientation === "vertical";

  return (
    <div
      className={cn(isVertical ? "flex flex-col gap-3 px-3 pb-3" : "flex gap-3 px-8 pb-4", className)}
    >
      {sortOptions.map((option) => {
        const Icon = option.icon;
        const isSelected = sortType === option.type;

        return (
          <Button
            key={option.type}
            variant="ghost"
            size="sm"
            onClick={() => setSortType(option.type)}
            className={cn(
              "rounded-xl whitespace-nowrap",
              "transition-all duration-panel spring-ease",
              "text-xs font-semibold",
              isVertical ? "h-11 w-full justify-start px-4" : "h-9 px-4",
              isSelected
                ? "bg-foreground/10 text-foreground"
                : "hover:bg-foreground/5 text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-4 h-4 mr-2 transition-transform duration-panel-fast" />
            <span>{option.label}</span>
          </Button>
        );
      })}
    </div>
  );
}

