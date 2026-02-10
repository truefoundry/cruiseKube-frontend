import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ClusterSelector } from "@/components/ClusterSelector";
import { useConfig } from "@/contexts/ConfigContext";
import { Outlet } from "react-router-dom";
import { FileSearch } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AppLayout() {
  const { applyRecommendationDryRun, isLoading: configLoading } = useConfig();

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-border px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <ClusterSelector />
              <div className="flex items-center gap-2 shrink-0">
                <span className="rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  Beta
                </span>
                {!configLoading && applyRecommendationDryRun && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/60 bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                          <FileSearch className="h-3.5 w-3.5" />
                          Recommendation mode only
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <p>Recommendations are shown but not applied. Application is in dry-run / recommend-only mode.</p>
                        <p className="mt-2">
                          <a
                            href="https://cruisekube.com/src/gs-installation/#uninstall"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline hover:no-underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            How to remove dry run
                          </a>
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </header>
          <main className="min-w-0 flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
