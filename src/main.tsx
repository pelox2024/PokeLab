import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@fontsource-variable/geist/index.css";
import "@fontsource-variable/space-grotesk/index.css";
import App from "./App.tsx";
import { initPrefs } from "./lib/prefs";
import { initPwaInstallCapture } from "./lib/pwa";
import "./styles/globals.css";

initPrefs();
initPwaInstallCapture();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
