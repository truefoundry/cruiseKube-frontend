import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ClusterProvider } from "@/contexts/ClusterContext";
import { ConfigProvider } from "@/contexts/ConfigContext";
import Overview from "./pages/Overview";
import Workloads from "./pages/Workloads";
import WorkloadDetail from "./pages/WorkloadDetail";
import Policies from "./pages/Policies";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ClusterProvider>
        <ConfigProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Overview />} />
                <Route path="/workloads" element={<Workloads />} />
                <Route path="/workloads/:namespace/:workloadName" element={<WorkloadDetail />} />
                <Route path="/policies" element={<Policies />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ConfigProvider>
      </ClusterProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
