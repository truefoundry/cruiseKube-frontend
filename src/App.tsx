import * as Sentry from "@sentry/react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ClusterProvider } from "@/contexts/ClusterContext";
import { ConfigProvider } from "@/contexts/ConfigContext";
import { DevModeProvider } from "@/contexts/DevModeContext";
import Overview from "./pages/Overview";
import Workloads from "./pages/Workloads";
import WorkloadDetail from "./pages/WorkloadDetail";
import Policies from "./pages/Policies";
import Events from "./pages/Events";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes);

const App = () => (
  <Sentry.ErrorBoundary fallback={<p>An unexpected error has occurred.</p>} showDialog>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ClusterProvider>
          <ConfigProvider>
            <DevModeProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <SentryRoutes>
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<Overview />} />
                    <Route path="/workloads" element={<Workloads />} />
                    <Route path="/workloads/:namespace/:workloadName" element={<WorkloadDetail />} />
                    <Route path="/policies" element={<Policies />} />
                    <Route path="/events" element={<Events />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </SentryRoutes>
              </BrowserRouter>
            </DevModeProvider>
          </ConfigProvider>
        </ClusterProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </Sentry.ErrorBoundary>
);

export default App;
