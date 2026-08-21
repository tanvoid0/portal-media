import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "./styles/index.css";
import { hydrateThemeFromStorage } from "./hooks/useTheme";

hydrateThemeFromStorage();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
