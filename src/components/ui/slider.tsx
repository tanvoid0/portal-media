import * as React from "react"
import { cn } from "@/lib/utils"

export interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: number[]
  onValueChange: (value: number[]) => void
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, onValueChange, min = 0, max = 100, step = 1, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onValueChange([Number(e.target.value)])
    }

    return (
      <input
        type="range"
        ref={ref}
        className={cn(
          "w-full bg-muted rounded-slider appearance-none cursor-pointer h-[var(--slider-track-height)]",
          "accent-primary",
          className
        )}
        value={value[0]}
        onChange={handleChange}
        min={min}
        max={max}
        step={step}
        {...props}
      />
    )
  }
)
Slider.displayName = "Slider"

export { Slider }
