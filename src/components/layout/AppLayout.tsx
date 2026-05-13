import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Outlet } from "react-router-dom";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { isDemoMode } from "@/lib/demo-mode";

const CRUISEKUBE_INSTALL_URL = "https://cruisekube.com/install/gs-installation/";

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
                className="pointer-events-auto cursor-pointer border-primary bg-primary/20 py-2.5 pl-3 pr-3 backdrop-blur-sm supports-[backdrop-filter]:bg-primary/15"
              >
                <AlertTitle className="mb-0 text-sm font-semibold tracking-tight text-foreground">
                  Demo mode
                </AlertTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Start saving with your cluster.
                </p>
                <Button
                  asChild
                  size="sm"
                  className="mt-2 h-7 px-3 text-xs"
                >
                  <a
                    href={CRUISEKUBE_INSTALL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Get started
                  </a>
                </Button>
              </Alert>
            </div>
          )}
        </div>
      </div>
    </SidebarProvider>
  );
}
