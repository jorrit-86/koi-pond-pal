import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import { StandaloneLandingPage } from "./pages/StandaloneLandingPage";

const App = () => (
  <I18nextProvider i18n={i18n}>
    <ThemeProvider defaultTheme="light" storageKey="koi-pond-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <StandaloneLandingPage />
      </TooltipProvider>
    </ThemeProvider>
  </I18nextProvider>
);

export default App;
