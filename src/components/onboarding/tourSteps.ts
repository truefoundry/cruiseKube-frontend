import type { Step } from "react-joyride";

export const tourSteps: Step[] = [
  {
    target: '[data-tour="overview-metrics"]',
    title: "Welcome to CruiseKube!",
    content:
      "CruiseKube automatically right-sizes your Kubernetes workloads to cut cloud costs — without sacrificing reliability. These cards show your monthly cost, current savings, cluster utilization, and node count.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: '[data-tour="untapped-savings"]',
    title: "Discover untapped savings",
    content:
      "This section shows how many workloads have CruiseKube enabled and how much more you could save. Click 'View Workloads' to start optimizing the rest.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: '[data-tour="nav-workloads"]',
    title: "Manage your workloads",
    content:
      "The Workloads page lists every workload in your cluster. Toggle between Cruise mode (auto-optimize) and Recommend mode (view suggestions only). You can also set criticality levels and disruption windows for safe, scheduled optimizations.",
    placement: "right",
    skipBeacon: true,
  },
  {
    target: '[data-tour="nav-events"]',
    title: "Full audit trail",
    content:
      "Every action CruiseKube takes — resource changes, pod evictions, PDB adjustments — is logged here. Filter by time range, category, or workload to see exactly what happened and when.",
    placement: "right",
    skipBeacon: true,
  },
  {
    target: '[data-tour="sidebar-help"]',
    title: "Need help? We're here.",
    content:
      "Browse our documentation, join the community on Discord, or book a call with the team. You can also retake this tour anytime from the sidebar.",
    placement: "right",
    skipBeacon: true,
  },
];
