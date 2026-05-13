import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ClusterSelector } from "@/components/ClusterSelector";
import { Outlet } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isDemoMode } from "@/lib/demo-mode";

export function AppLayout() {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-border px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <ClusterSelector />
              {isDemoMode && (
                <Alert className="border-primary/40 bg-primary/5 py-2 sm:ml-auto sm:max-w-xl">
                  <AlertTitle className="text-sm">Demo mode</AlertTitle>
                  <AlertDescription className="text-xs text-muted-foreground">
                    All data is synthetic. API calls are not sent to a real backend.
                  </AlertDescription>
                </Alert>
              )}
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
