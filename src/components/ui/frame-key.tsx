import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

/** Compact square key: selected = 3px primary frame. Used for filters, theme chips, type picks. */
export function FrameKey({
  active,
  size = "default",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  size?: "default" | "sm";
}) {
  return (
    <button
      type="button"
      data-active={active ? "true" : "false"}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-none border-2 border-transparent bg-transparent",
        "font-hub font-medium text-muted-foreground",
        "transition-[border-width,color] duration-150",
        "hover:text-foreground hover:border-border",
        "focus-visible:outline-none focus-visible:border-primary focus-visible:border-[3px]",
        "data-[active=true]:border-primary data-[active=true]:border-[3px] data-[active=true]:text-foreground",
        "disabled:opacity-40 disabled:pointer-events-none",
        size === "sm" ? "h-9 px-3 text-xs" : "h-11 px-4 text-sm",
        className
      )}
      {...props}
    />
  );
}
