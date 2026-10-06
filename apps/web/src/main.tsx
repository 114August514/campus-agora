import { BaseStyles, ThemeProvider } from "@primer/react";
import React from "react";
import ReactDOM from "react-dom/client";
import "@primer/primitives/dist/css/functional/themes/light.css";
import { App } from "./app/App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider colorMode="day" dayScheme="light">
      <BaseStyles>
        <App />
      </BaseStyles>
    </ThemeProvider>
  </React.StrictMode>,
);
