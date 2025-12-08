import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Overview from "./pages/Overview";
import Workloads from "./pages/Workloads";
import WorkloadDetail from "./pages/WorkloadDetail";

import HistoricalSavings from "./pages/HistoricalSavings";
import Performance from "./pages/Performance";
import Audit from "./pages/Audit";
import Policies from "./pages/Policies";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Overview />} />
            <Route path="/recommendations" element={<Workloads />} />
            <Route path="/recommendations/:namespace/:workloadName" element={<WorkloadDetail />} />
            <Route path="/savings" element={<HistoricalSavings />} />
            <Route path="/performance" element={<Performance />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/policies" element={<Policies />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
