import { Outlet } from "react-router-dom";

export function SettingsLayout() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="container mx-auto px-5 py-6 sm:px-6 sm:py-8 space-y-6 max-w-5xl">
        <Outlet />
      </div>
    </div>
  );
}
