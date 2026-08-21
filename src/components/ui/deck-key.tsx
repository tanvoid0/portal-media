import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Console control-deck key: icon above label, square frame that thickens when live. */
export function DeckKey({
  icon,
  label,
  active,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      data-active={active ? "true" : "false"}
      className={cn(
        "flex min-w-[7rem] flex-col items-center justify-center gap-2 px-5 py-4",
        "rounded-none border-2 border-transparent bg-transparent",
        "font-hub text-[0.95rem] font-semibold tracking-wide text-muted-foreground",
        "transition-[border-width,color] duration-150",
        "hover:text-foreground hover:border-border",
        "focus-visible:outline-none focus-visible:border-primary focus-visible:border-[3px]",
        "data-[active=true]:border-primary data-[active=true]:border-[3px] data-[active=true]:text-foreground",
        "disabled:opacity-40 disabled:pointer-events-none",
        className
      )}
      {...props}
    >
      <span className="[&>svg]:h-8 [&>svg]:w-8" aria-hidden>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
