import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { SessionProvider } from "./state/SessionContext";
import { SettingsProvider } from "./state/SettingsContext";
import { FeedbackProvider } from "./state/FeedbackContext";
import { RadioProvider } from "./state/RadioContext";
import { ToastProvider } from "./state/ToastContext";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SettingsProvider>
      <SessionProvider>
        <FeedbackProvider>
          <RadioProvider>
            <ToastProvider>
              <RouterProvider router={router} />
            </ToastProvider>
          </RadioProvider>
        </FeedbackProvider>
      </SessionProvider>
    </SettingsProvider>
  </StrictMode>,
);
