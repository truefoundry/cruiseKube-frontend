import * as Sentry from "@sentry/react";
import { usePostHog } from "@posthog/react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { AuthProvider } from "@/contexts/AuthContext";
import { ClusterProvider } from "@/contexts/ClusterContext";
import { ConfigProvider } from "@/contexts/ConfigContext";
import Overview from "./pages/Overview";
import Workloads from "./pages/Workloads";
import WorkloadDetail from "./pages/WorkloadDetail";
import Policies from "./pages/Policies";
import Events from "./pages/Events";
import NotFound from "./pages/NotFound";
import { isPostHogEnabled } from "./posthog-config";
import Login from "./pages/Login";


const queryClient = new QueryClient();

const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes);

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const AnalyticsPageTracker = () => {
  const location = useLocation();

  useEffect(() => {
    window.gtag?.("event", "page_view", {
      page_path: `${location.pathname}${location.search}${location.hash}`,
      page_title: document.title,
      page_location: window.location.href,
    });
  }, [location]);

  return null;
};

const PostHogPageViewTracker = () => {
  const location = useLocation();
  const posthogClient = usePostHog();

  useEffect(() => {
    posthogClient?.capture("$pageview", {
      $current_url: window.location.href,
    });
  }, [location, posthogClient]);

  return null;
};

const App = () => (
 <Sentry.ErrorBoundary fallback={<p>An unexpected error has occurred.</p>} showDialog>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || undefined}>
        <AuthProvider>
          <AnalyticsPageTracker />
          {isPostHogEnabled ? <PostHogPageViewTracker /> : null}
          <SentryRoutes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedLayout />}>
              <Route
                element={
                  <ClusterProvider>
                    <ConfigProvider>
                      <AppLayout />
                    </ConfigProvider>
                  </ClusterProvider>
                }
              >
                <Route path="/" element={<Overview />} />
                <Route path="/workloads" element={<Workloads />} />
                <Route path="/workloads/:namespace/:workloadName" element={<WorkloadDetail />} />
                <Route path="/policies" element={<Policies />} />
                <Route path="/events" element={<Events />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Route>
          </SentryRoutes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
 </Sentry.ErrorBoundary>
);

export default App;
