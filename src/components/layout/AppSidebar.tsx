import {
  LayoutDashboard,
  Layers,
  Activity,
  Settings,
  Tag,
  Github,
  MessagesSquare,
  BookOpen,
  Calendar,
  LogOut,
  CircleDollarSign,
  Compass,
} from "lucide-react";
import { useOnboardingTour } from "@/components/onboarding/useOnboardingTour";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { isDemoMode } from "@/lib/demo-mode";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConfig } from "@/contexts/ConfigContext";
import { useAuth } from "@/contexts/AuthContext";
import { ClusterSelector } from "@/components/ClusterSelector";
import { publicUrl } from "@/lib/public-asset";


const navItems = [
  { title: "Overview", url: "/", icon: LayoutDashboard },
  { title: "Workloads", url: "/workloads", icon: Layers, dataTour: "nav-workloads" },
  { title: "Events", url: "/events", icon: Activity, dataTour: "nav-events" },
  { title: "Policies & Configuration", url: "/policies", icon: Settings },
];

const helpLinks = [
  {
    title: "Report an issue",
    href: "https://github.com/truefoundry/cruisekube/issues/new/choose",
    icon: Github,
  },
  {
    title: "Community Discord",
    href: "https://discord.com/invite/Dqek4xJa3N",
    icon: MessagesSquare,
  },
  {
    title: "Documentation",
    href: "https://cruisekube.com/",
    icon: BookOpen,
  },
  {
    title: "Talk to team",
    href: "https://calendar.app.google/2wec4rbL1tyYNreJ7",
    icon: Calendar,
  },
] as const;

const logoMaskUrl = publicUrl("logo.svg");
const CRUISEKUBE_INSTALL_URL = "https://cruisekube.com/install/gs-installation/";

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { config } = useConfig();
  const { username, logout, authEnabled } = useAuth();
  const { startTour, isMobile } = useOnboardingTour();
  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg">
            <div
              className="h-7 w-7 shrink-0 bg-white opacity-80"
              style={{
                maskImage: `url(${logoMaskUrl})`,
                WebkitMaskImage: `url(${logoMaskUrl})`,
                maskSize: "contain",
                maskRepeat: "no-repeat",
                maskPosition: "center",
              }}
              role="img"
              aria-label="CruiseKube"
            />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sidebar-accent-foreground truncate">CruiseKube</span>
              </div>
              <span className="text-xs text-sidebar-foreground">K8s Optimizer</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent className="">
        {!isCollapsed && (
          <SidebarGroup className="border-b border-sidebar-border">
            <SidebarGroupLabel>Cluster</SidebarGroupLabel>
            <SidebarGroupContent className="px-2 pb-3">
              <ClusterSelector
                variant="stacked"
                showLabel={false}
                triggerClassName="w-full border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground"
              />
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      data-tour={item.dataTour}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        isCollapsed && "justify-center"
                      )}
                      activeClassName="bg-sidebar-accent text-primary"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <div className="mt-auto shrink-0 border-t border-sidebar-border p-2 space-y-3">
        {authEnabled && (
          <SidebarGroup className="p-0">
            <SidebarGroupLabel>Account</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {!isCollapsed && username ? (
                  <SidebarMenuItem>
                    <div
                      className="cursor-default select-none truncate px-3 py-1.5 text-xs text-sidebar-foreground/80"
                      title={username}
                    >
                      {username}
                    </div>
                  </SidebarMenuItem>
                ) : null}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip={isCollapsed ? "Sign out" : undefined}
                    className={cn(isCollapsed && "justify-center")}
                  >
                    <button
                      type="button"
                      onClick={() => logout()}
                      className="cursor-pointer select-none [&>span]:pointer-events-none [&>svg]:pointer-events-none"
                    >
                      <LogOut className="h-4 w-4 shrink-0" />
                      {!isCollapsed && <span>Sign out</span>}
                    </button>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isDemoMode && (
          <SidebarGroup className="p-0">
            {isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={CRUISEKUBE_INSTALL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex justify-center rounded-md p-2 text-primary transition-colors hover:bg-sidebar-accent"
                    aria-label="Demo mode — Start saving with CruiseKube"
                  >
                    <CircleDollarSign className="h-4 w-4 shrink-0" />
                  </a>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="font-semibold">Demo mode</p>
                  <p className="text-xs text-muted-foreground">
                    Start saving with your cluster.
                  </p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <SidebarGroupContent className="px-1">
                <Alert
                  variant="default"
                  className="border-primary/50 bg-primary/15 py-2.5 pl-3 pr-3"
                >
                  <AlertTitle className="mb-0 text-sm font-semibold tracking-tight text-sidebar-accent-foreground">
                    Demo mode
                  </AlertTitle>
                  <p className="mt-1 text-xs text-sidebar-foreground/80">
                    Start saving with your cluster.
                  </p>
                  <Button
                    asChild
                    size="sm"
                    className="mt-2 h-7 w-full px-3 text-xs"
                  >
                    <a
                      href={CRUISEKUBE_INSTALL_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5"
                    >
                      <CircleDollarSign className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Start Saving
                    </a>
                  </Button>
                </Alert>
              </SidebarGroupContent>
            )}
          </SidebarGroup>
        )}

        <SidebarGroup className="p-0" data-tour="sidebar-help">
          <SidebarGroupLabel>Get help</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {helpLinks.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        isCollapsed && "justify-center"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isDemoMode && !isMobile && (
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip={isCollapsed ? "Take tour" : undefined}
                    onClick={() => startTour()}
                    className={cn(isCollapsed && "justify-center")}
                  >
                    <Compass className="h-4 w-4 shrink-0" />
                    {!isCollapsed && <span>Take tour</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <div className="space-y-2 border-t border-sidebar-border pt-3">
          {config?.version ? (
            isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="flex cursor-pointer justify-center py-0.5 text-sidebar-foreground/50"
                    aria-label={`Version ${config.version}`}
                  >
                    <Tag className="h-4 w-4" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-mono text-xs max-w-xs break-all">
                  {config.version}
                </TooltipContent>
              </Tooltip>
            ) : (
              <p className="text-center text-xs font-mono text-sidebar-foreground/50 px-1 truncate" title={config.version}>
                {config.version}
              </p>
            )
          ) : null}
          <SidebarTrigger className="w-full justify-center" />
        </div>
      </div>
    </Sidebar>
  );
}
