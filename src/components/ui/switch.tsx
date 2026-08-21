import { cn } from "@/lib/utils";
import { type InputHTMLAttributes, forwardRef, useId } from "react";

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

/** Square frame checkbox. On-state thickens the primary inset — it is not a colored pill. */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, id, label, disabled, ...props }, ref) => {
    const uid = useId();
    const inputId = id ?? uid;

    return (
      <span className={cn("inline-flex items-center gap-3", className)}>
        {label ? (
          <label htmlFor={inputId} className="text-sm text-foreground">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          role="switch"
          disabled={disabled}
          className="peer sr-only"
          {...props}
        />
        <label
          htmlFor={inputId}
          className={cn(
            "relative h-6 w-6 shrink-0 rounded-none border-2 border-border bg-background cursor-pointer",
            "transition-[border-width,border-color] duration-150",
            "peer-checked:border-primary peer-checked:border-[3px]",
            "after:absolute after:inset-[5px] after:bg-foreground after:opacity-0",
            "peer-checked:after:opacity-100",
            "peer-focus-visible:border-primary",
            "peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
          )}
        />
      </span>
    );
  }
);
Switch.displayName = "Switch";
