import { useUnifiedNavigation } from "@/hooks/useUnifiedNavigation";

export function Navigation() {
  // Unified hook handles all navigation logic (mouse, keyboard, gamepad)
  useUnifiedNavigation();
  
  return null; // This component doesn't render anything, it just sets up navigation
}

