import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Ban,
  BarChart3,
  BookOpen,
  Calendar,
  CircleCheck,
  CircleDollarSign,
  CircleDot,
  Clock,
  Hand,
  LayoutList,
  Lock,
  MessagesSquare,
  Pause,
  RefreshCw,
  Rocket,
  ScrollText,
  Settings,
  Shield,
  Sparkles,
  TrendingUp,
  Wrench,
} from "lucide-react";
import type { Step } from "react-joyride";
import type { NavigateFunction } from "react-router-dom";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

const CRUISEKUBE_INSTALL_URL =
  "https://cruisekube.com/install/gs-installation/";

function StepTitle({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span className="flex items-center gap-2">
      <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
      <span>{children}</span>
    </span>
  );
}

function IconListItem({
  icon: Icon,
  iconClassName,
  children,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-2">
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground ${iconClassName ?? ""}`}
        aria-hidden
      />
      <span>{children}</span>
    </li>
  );
}

export function createTourSteps(navigate: NavigateFunction): Step[] {
  /** Navigate to the Overview page (no-op if already there).
   *  A short delay after navigation gives joyride time to render the
   *  current step before its target element appears in the DOM.
   *  Without this, joyride finds the target instantly and skips past
   *  the step in a single render cycle (same fix as ensureWorkloads). */
  const ensureOverview = async () => {
    navigate("/", { replace: true });
    await new Promise((resolve) => setTimeout(resolve, 300));
  };

  /** Navigate to the Workloads page (no-op if already there).
   *  A short delay after navigation gives joyride time to render the
   *  current step before its target element appears in the DOM.
   *  Without this, joyride finds the target instantly and skips past
   *  the step in a single render cycle. */
  const ensureWorkloads = async () => {
    navigate("/workloads", { replace: true });
    await new Promise((resolve) => setTimeout(resolve, 300));
  };

  return [
    {
      target: "body",
      placement: "center" as const,
      title: "Welcome to CruiseKube",
      content: (
        <div className="space-y-2">
          <p>
            CruiseKube automatically right-sizes your Kubernetes workloads to save
            cloud costs.
          </p>
          <p className="font-medium">Here&apos;s what you can do:</p>
          <ul className="list-disc space-y-1 pl-4 text-left">
            <li>
              <strong>Monitor</strong> cluster costs, savings, and utilization at a
              glance
            </li>
            <li>
              <strong>Cruise Mode</strong> — auto-optimize workloads with one toggle
            </li>
            <li>
              <strong>Disruption Windows</strong> — schedule safe optimization
            </li>
          </ul>
          <p className="flex items-center gap-2 text-center justify-center pt-4">
            
            <span>Let&apos;s take 60 seconds to get you started!</span>
          </p>
        </div>
      ),
    },
    {
      target: '[data-tour="overview-metrics"]',
      placement: "bottom" as const,
      title: <StepTitle icon={BarChart3}>Your cluster at a glance</StepTitle>,
      content: (
        <div className="space-y-2">
          <p>These cards give you a real-time snapshot of your cluster:</p>
          <ul className="list-disc space-y-1 pl-4 text-left">
            <li>
              <strong>Monthly Cost</strong> — your current run-rate
            </li>
            <li>
              <strong>Current Savings</strong> — what CruiseKube has saved so far
            </li>
            <li>
              <strong>Cluster Utilization</strong> — how efficiently resources are
              used
            </li>
            <li>
              <strong>Node Count</strong> — active nodes in your cluster
            </li>
          </ul>
        </div>
      ),
      before: ensureOverview,
    },
    {
      target: '[data-tour="untapped-savings"]',
      placement: "bottom" as const,
      title: (
        <StepTitle icon={CircleDollarSign}>Discover untapped savings</StepTitle>
      ),
      content: (
        <div className="space-y-2">
          <p>This section shows your optimization progress:</p>
          <ul className="list-disc space-y-1 pl-4 text-left">
            <li>
              <strong>Adoption</strong> — percentage of workloads with Cruise mode
              enabled
            </li>
            <li>
              <strong>CPU &amp; Memory coverage</strong> — percentage of resources
              optimized
            </li>
            <li>
              <strong>Untapped savings</strong> — how much more you could save
            </li>
          </ul>

        </div>
      ),
      before: ensureOverview,
    },
    {
      target: '[data-tour="workload-summary"]',
      placement: "bottom" as const,
      title: <StepTitle icon={LayoutList}>Workloads in scope</StepTitle>,
      content: (
        <div className="space-y-2">
          <p>This bar shows a breakdown of all your workloads:</p>
          <ul className="space-y-1.5 text-left">
            <IconListItem icon={CircleCheck} iconClassName="text-success">
              <strong>Enabled</strong> — actively optimized by CruiseKube
            </IconListItem>
            <IconListItem icon={Pause}>
              <strong>Disabled</strong> — recommendations only, no auto-changes
            </IconListItem>
            <IconListItem icon={Ban}>
              <strong>Non-optimizable</strong> — GPU workloads, HPA-managed, or
              excluded
            </IconListItem>
          </ul>
          <p>
            CruiseKube supports{" "}
            <strong>
              Deployments, StatefulSets and DaemonSets
            </strong>
          </p>
        </div>
      ),
      before: ensureWorkloads,
    },
    {
      target: "#workload-row-5",
      placement: "top" as const,
      title: (
        <StepTitle icon={Rocket}>
          Workload level controls
        </StepTitle>
      ),
      content: (
        <div className="space-y-2">
          <p>
            Each row shows a workload with its resource usage and savings potential:
          </p>
          <ul className="space-y-1.5 text-left">
            <IconListItem icon={CircleCheck} iconClassName="text-success">
              <strong>Cruise (On)</strong> — CruiseKube auto-applies optimizations
            </IconListItem>
            <IconListItem icon={CircleDot} iconClassName="text-primary">
              <strong>Recommend (Off)</strong> — view suggestions without applying
            </IconListItem>
            <IconListItem icon={CircleDollarSign}>
              <strong>Net Savings</strong> — estimated monthly savings per workload
            </IconListItem>
            <IconListItem icon={Shield}>
              <strong>Criticality</strong> — controls eviction priority (Low → Very
              High)
            </IconListItem>
          </ul>
          <p className="text-left pt-2">
            <strong>Disruption Windows</strong> let you schedule safe time slots when
            PDB protections are temporarily relaxed — allowing node consolidation.
          </p>
          <ul className="space-y-1.5 text-left">
            <IconListItem icon={Clock}>
              Set start/end times and days of the week
            </IconListItem>
            <IconListItem icon={Lock}>
              Protections are <strong>automatically restored</strong> when the window
              ends
            </IconListItem>
            <IconListItem icon={Settings}>
              Configure per workload via the{" "}
              <strong>row menu → Edit CruiseConfig</strong>
            </IconListItem>
          </ul>
        </div>
      ),
      before: ensureWorkloads,
    },
    {
      target: '[data-tour="nav-events"]',
      placement: "right" as const,
      title: <StepTitle icon={ScrollText}>Full audit trail</StepTitle>,
      content: (
        <div className="space-y-2">
          <p>Every action CruiseKube takes is logged here:</p>
          <ul className="space-y-1.5 text-left">
            <IconListItem icon={TrendingUp}>
              CPU &amp; memory recommendation changes
            </IconListItem>
            <IconListItem icon={RefreshCw}>
              Pod evictions and PDB adjustments
            </IconListItem>
            <IconListItem icon={AlertTriangle} iconClassName="text-amber-500">
              OOM events and node overload taints
            </IconListItem>
            <IconListItem icon={Wrench}>
              Webhook mutations
              </IconListItem>
          </ul>

        </div>
      ),
    },
    {
      target: '[data-tour="sidebar-help"]',
      placement: "right" as const,
      title: <StepTitle icon={Hand}>Need help? We&apos;re here!</StepTitle>,
      content: (
        <div className="space-y-2">
          <p>When you need support, these links are always in the sidebar:</p>
          <ul className="space-y-1.5 text-left">
            <IconListItem icon={BookOpen}>
              <strong>Documentation</strong> — detailed guides and references
            </IconListItem>
            <IconListItem icon={MessagesSquare}>
              <strong>Community Discord</strong> — chat with other users
            </IconListItem>
            <IconListItem icon={Calendar}>
              <strong>Talk to team</strong> — book a call with us
            </IconListItem>
          </ul>

        </div>
      ),
    },
    {
      target: "body",
      placement: "center" as const,
      title: (
        <StepTitle icon={Sparkles}>
          You&apos;re ready to save on Kubernetes
        </StepTitle>
      ),
      content: (
        <div className="space-y-3">
          <p>
            You&apos;ve seen how CruiseKube monitors costs, optimizes workloads, and
            keeps a full audit trail. Install it on your cluster to start realizing
            savings in production.
          </p>
          <div className="mx-2 my-4 flex justify-center p-4">
            <Button asChild size="sm">
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
          </div>
        </div>
      ),
    },
  ];
}
