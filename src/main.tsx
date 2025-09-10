import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ParameterTimersProvider } from './hooks/use-parameter-timers'

createRoot(document.getElementById("root")!).render(
  <ParameterTimersProvider>
    <App />
  </ParameterTimersProvider>
);
