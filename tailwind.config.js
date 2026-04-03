import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        card: "var(--radius-card)",
        button: "var(--radius-button)",
        input: "var(--radius-input)",
        slider: "var(--slider-track-radius)",
      },
      borderWidth: {
        ui: "var(--border-width-ui)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        button: "var(--shadow-button)",
      },
      fontFamily: {
        ui: "var(--font-ui)",
      },
      fontWeight: {
        button: "var(--font-weight-button)",
      },
      height: {
        control: "var(--control-height)",
        "control-sm": "var(--control-height-sm)",
        "control-lg": "var(--control-height-lg)",
        "control-icon": "var(--control-height-icon)",
      },
      width: {
        "control-icon": "var(--control-height-icon)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
              animation: {
                "card-scale-up": "card-scale-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
                "card-scale-down": "card-scale-down 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
                "card-elevate": "card-elevate 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
                "card-tilt": "card-tilt 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite",
                "parallax": "parallax-move 20s ease-in-out infinite",
                "focus-ring": "focus-ring-pulse 2s ease-in-out infinite",
                "gradient": "gradient-shift 15s ease infinite",
                "fade-in-up": "fade-in-up 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
                "fade-in": "fade-in 0.5s ease-in forwards",
                "slide-in-right": "slide-in-right 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
                "slide-in-bottom": "slide-in-from-bottom 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
                "scale-in": "scale-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
                "icon-bounce": "icon-bounce 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
                "count-pop": "count-badge-pop 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
                "glow-pulse": "glow-pulse 2s ease-in-out infinite",
              },
      transitionTimingFunction: {
        "spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "spring-smooth": "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        "spring-bounce": "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
      },
      transitionDuration: {
        panel: "400ms",
        "panel-fast": "250ms",
        "panel-slow": "600ms",
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

