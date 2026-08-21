import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { Switch } from "@/components/ui/switch";

/** Console-style options row: label left, control right. Works at TV distance and at a desk. */
export function SettingRow({
  title,
  description,
  htmlFor,
  disabled,
  children,
  className,
}: {
  title: string;
  description?: string;
  htmlFor?: string;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 border-b border-border py-4 last:border-b-0",
        disabled && "opacity-50",
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
          {title}
        </label>
        {description ? (
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingToggle({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <SettingRow title={label} description={description} htmlFor={id} disabled={disabled}>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </SettingRow>
  );
}
