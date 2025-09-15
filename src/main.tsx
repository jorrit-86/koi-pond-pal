import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { ParameterTimersProvider } from './hooks/use-parameter-timers'

createRoot(document.getElementById("root")!).render(
  <ParameterTimersProvider>
    <App />
  </ParameterTimersProvider>
);
