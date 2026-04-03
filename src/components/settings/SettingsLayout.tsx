import { Outlet } from "react-router-dom";

export function SettingsLayout() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="container mx-auto p-8 space-y-8 max-w-5xl">
        <Outlet />
      </div>
    </div>
  );
}
