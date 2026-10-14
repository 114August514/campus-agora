import "@primer/primitives/dist/css/primitives.css";
import "@primer/primitives/dist/css/functional/themes/light.css";
import "@primer/primitives/dist/css/functional/themes/dark.css";
import "./app/theme.css";
import { BaseStyles } from "@primer/react";
import { ThemeProvider } from "@primer/react/next";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";

const THEME_KEY = "campus-agora.color-mode.v1";
type ColorMode = "day" | "night";

function readColorMode(): ColorMode {
  try {
    return window.localStorage.getItem(THEME_KEY) === "night" ? "night" : "day";
  } catch {
    return "day";
  }
}

function AppRoot() {
  const [colorMode, setColorMode] = useState<ColorMode>(readColorMode);

  useEffect(() => {
    // Apply library tokens to the document as well as the app, including dialogs.
    document.documentElement.dataset.colorMode = colorMode === "day" ? "light" : "dark";
    document.documentElement.dataset.lightTheme = "light";
    document.documentElement.dataset.darkTheme = "dark";
    try {
      window.localStorage.setItem(THEME_KEY, colorMode);
    } catch {
      // Switching still works for this visit when browser storage is unavailable.
    }
  }, [colorMode]);

  return (
    <ThemeProvider colorMode={colorMode} dayScheme="light" nightScheme="dark">
      <BaseStyles>
        <App
          colorMode={colorMode}
          onToggleColorMode={() =>
            setColorMode((mode) => (mode === "day" ? "night" : "day"))
          }
        />
      </BaseStyles>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>,
);
