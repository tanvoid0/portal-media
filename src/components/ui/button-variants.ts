import { cva } from "class-variance-authority";

/**
 * Variants use theme structural tokens (see `src/styles/themes/*.css`):
 * rounded-button, h-control*, shadow-button, font-ui, font-button, ring widths.
 * Bold accent themes (Nimbus, Vertex, Forge, …) diverge via those variables only.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-button text-sm font-ui font-button ring-offset-background transition-colors duration-200 focus-visible:outline-none focus-visible:ring-[length:var(--ring-width)] focus-visible:ring-ring focus-visible:ring-offset-[length:var(--ring-offset-width)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-button hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-button hover:bg-destructive/90",
        outline:
          "border border-ui border-solid border-input bg-background shadow-none hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-none hover:bg-secondary/80",
        ghost: "shadow-none hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 shadow-none hover:underline",
      },
      size: {
        default: "h-control px-4 py-2",
        sm: "h-control-sm px-3 py-1.5 text-xs",
        lg: "h-control-lg px-8 text-base",
        icon: "h-control-icon w-control-icon shrink-0 p-0",
      },
    },
    compoundVariants: [
      {
        variant: "link",
        size: "default",
        class: "!h-auto min-h-0 w-auto rounded-sm px-0 py-0 text-sm",
      },
      {
        variant: "link",
        size: "sm",
        class: "!h-auto min-h-0 w-auto rounded-sm px-0 py-0 text-xs",
      },
      {
        variant: "link",
        size: "lg",
        class: "!h-auto min-h-0 w-auto rounded-sm px-0 py-0 text-base",
      },
      {
        variant: "link",
        size: "icon",
        class: "!h-control-icon !w-control-icon shrink-0 rounded-button p-0",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
