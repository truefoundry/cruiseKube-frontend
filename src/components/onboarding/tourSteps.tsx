import type { Step } from "react-joyride";
import type { NavigateFunction } from "react-router-dom";

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
      title: "👋 Welcome to CruiseKube!",
      content: (
        <div className="space-y-2">
          <p>CruiseKube automatically right-sizes your Kubernetes workloads to save cloud costs — without sacrificing reliability.</p>
          <p className="font-medium">Here&apos;s what you can do:</p>
          <ul className="list-disc space-y-1 pl-4 text-left">
            <li>📊 <strong>Monitor</strong> cluster costs, savings, and utilization at a glance</li>
            <li>🚀 <strong>Cruise Mode</strong> — auto-optimize workloads with one toggle</li>
            <li>🔍 <strong>Recommend Mode</strong> — view suggestions before applying</li>
            <li>🕐 <strong>Disruption Windows</strong> — schedule safe optimization windows</li>
            <li>📋 <strong>Full Audit Trail</strong> — every action logged and filterable</li>
            <li>⚙️ <strong>Criticality Levels</strong> — control eviction priority per workload</li>
          </ul>
          <p>Let&apos;s take a quick tour! 🎯</p>
        </div>
      ),
    },
    {
      target: '[data-tour="overview-metrics"]',
      placement: "bottom" as const,
      title: "📊 Your cluster at a glance",
      content: (
        <div className="space-y-2">
          <p>These cards give you a real-time snapshot of your cluster:</p>
          <ul className="list-disc space-y-1 pl-4 text-left">
            <li><strong>Monthly Cost</strong> — your current run-rate</li>
            <li><strong>Current Savings</strong> — what CruiseKube has saved so far</li>
            <li><strong>Cluster Utilization</strong> — how efficiently resources are used</li>
            <li><strong>Node Count</strong> — active nodes in your cluster</li>
          </ul>
        </div>
      ),
      before: ensureOverview,
    },
    {
      target: '[data-tour="untapped-savings"]',
      placement: "bottom" as const,
      title: "💰 Discover untapped savings",
      content: (
        <div className="space-y-2">
          <p>This section shows your optimization progress:</p>
          <ul className="list-disc space-y-1 pl-4 text-left">
            <li><strong>Adoption ring</strong> — percentage of workloads with CruiseKube enabled</li>
            <li><strong>CPU &amp; Memory coverage</strong> — how much of your resources are optimized</li>
            <li><strong>Untapped savings</strong> — how much more you could save</li>
          </ul>
          <p>Click <strong>&quot;View Workloads&quot;</strong> to start optimizing the rest! 🚀</p>
        </div>
      ),
      before: ensureOverview,
    },
    {
      // Step index 3 — first Workloads step
      target: '[data-tour="workload-summary"]',
      placement: "bottom" as const,
      title: "📋 Workloads in scope",
      content: (
        <div className="space-y-2">
          <p>This bar shows a breakdown of all your workloads:</p>
          <ul className="list-disc space-y-1 pl-4 text-left">
            <li>✅ <strong>Enabled</strong> — actively optimized by CruiseKube</li>
            <li>⏸️ <strong>Disabled</strong> — recommendations only, no auto-changes</li>
            <li>🚫 <strong>Non-optimizable</strong> — GPU workloads, HPA-managed, or excluded</li>
          </ul>
          <p>CruiseKube supports <strong>Deployments, StatefulSets, DaemonSets, Jobs, CronJobs</strong>, and more.</p>
        </div>
      ),
      before: ensureWorkloads,
    },
    {
      target: '[data-tour="workload-table"]',
      placement: "top" as const,
      title: "🚀 Cruise Mode, Recommendations & Disruption Windows",
      content: (
        <div className="space-y-2">
          <p>Each row shows a workload with its resource usage and savings potential:</p>
          <ul className="list-disc space-y-1 pl-4 text-left">
            <li>🟢 <strong>Cruise (On)</strong> — CruiseKube auto-applies optimizations</li>
            <li>🔵 <strong>Recommend (Off)</strong> — view suggestions without applying</li>
            <li>💵 <strong>Net Savings</strong> — estimated monthly savings per workload</li>
            <li>🛡️ <strong>Criticality</strong> — controls eviction priority (Low → Very High)</li>
          </ul>
          <p><strong>Disruption Windows</strong> let you schedule safe time slots when PDB protections are temporarily relaxed — allowing node consolidation.</p>
          <ul className="list-disc space-y-1 pl-4 text-left">
            <li>⏰ Set start/end times and days of the week</li>
            <li>🔒 Protections are <strong>automatically restored</strong> when the window ends</li>
            <li>⚙️ Configure per workload via the <strong>row menu → Edit CruiseConfig</strong></li>
          </ul>
        </div>
      ),
      before: ensureWorkloads,
    },
    {
      target: '[data-tour="nav-events"]',
      placement: "right" as const,
      title: "📋 Full audit trail",
      content: (
        <div className="space-y-2">
          <p>Every action CruiseKube takes is logged here:</p>
          <ul className="list-disc space-y-1 pl-4 text-left">
            <li>📈 CPU &amp; memory recommendation changes</li>
            <li>🔄 Pod evictions and PDB adjustments</li>
            <li>⚠️ OOM events and node overload taints</li>
            <li>🔧 Webhook mutations</li>
          </ul>
          <p>Filter by time range, category, or workload to find exactly what you need. 🔍</p>
        </div>
      ),
    },
    {
      target: '[data-tour="sidebar-help"]',
      placement: "right" as const,
      title: "🤝 Need help? We're here!",
      content: (
        <div className="space-y-2">
          <p>You&apos;re all set! Here&apos;s where to go next:</p>
          <ul className="list-disc space-y-1 pl-4 text-left">
            <li>📖 <strong>Documentation</strong> — detailed guides and references</li>
            <li>💬 <strong>Community Discord</strong> — chat with other users</li>
            <li>📅 <strong>Talk to team</strong> — book a call with us</li>
          </ul>
          <p>You can retake this tour anytime from <strong>Policies &amp; Configuration</strong>. 🔄</p>
        </div>
      ),
    },
  ];
}
