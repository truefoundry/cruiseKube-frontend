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
} from "lucide-react";
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

const navItems = [
  { title: "Overview", url: "/", icon: LayoutDashboard },
  { title: "Workloads", url: "/workloads", icon: Layers },
  { title: "Events", url: "/events", icon: Activity },
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
    href: "https://cruisekube.com/src/gs-installation/",
    icon: BookOpen,
  },
  {
    title: "Talk to team",
    href: "https://calendar.app.google/2wec4rbL1tyYNreJ7",
    icon: Calendar,
  },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { config } = useConfig();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg ">
            <img src="/logo.png" alt="CruiseKube" className="h-8 w-8 object-contain" />
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
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
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
        <SidebarGroup className="p-0">
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

        <div className="space-y-2 border-t border-sidebar-border pt-3">
          {config?.version ? (
            isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex justify-center py-0.5 text-sidebar-foreground/50" aria-label={`Version ${config.version}`}>
                    <Tag className="h-3.5 w-3.5" />
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
