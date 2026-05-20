import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Outlet } from "react-router-dom";
import { OnboardingTourProvider } from "@/components/onboarding/OnboardingTourProvider";

function AppLayoutContent() {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main className="min-h-0 min-w-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AppLayout() {
  return (
    <SidebarProvider defaultOpen={true}>
      <OnboardingTourProvider>
        <AppLayoutContent />
      </OnboardingTourProvider>
    </SidebarProvider>
  );
}
