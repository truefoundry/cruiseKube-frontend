import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Outlet } from "react-router-dom";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { isDemoMode } from "@/lib/demo-mode";

export function AppLayout() {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <main className="min-h-0 min-w-0 flex-1 overflow-auto">
            <Outlet />
          </main>
          {isDemoMode && (
            <div className="pointer-events-none fixed right-4 top-4 z-[100] max-w-xs sm:max-w-sm">
              <Alert
                variant="default"
                className="pointer-events-auto border-primary bg-primary/20 py-2.5 pl-3 pr-3  backdrop-blur-sm supports-[backdrop-filter]:bg-primary/15"
              >
                <AlertTitle className="mb-0 text-sm font-semibold tracking-tight text-foreground">
                  Demo mode
                </AlertTitle>
                <p className="mt-1 text-xs text-muted-foreground">All data is synthetic.</p>
              </Alert>
            </div>
          )}
        </div>
      </div>
    </SidebarProvider>
  );
}
