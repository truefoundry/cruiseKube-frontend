import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Activity,
  Cpu,
  HardDrive,
  ShieldOff,
  Shield,
  LockKeyholeOpen,
  LockKeyhole,
  Code,
  Trash2,
  AlertTriangle,
  CloudOff,
  Cloud,
  Search,
  X,
  Copy,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCluster } from "@/contexts/ClusterContext";
import { apiClient, type AuditEvent } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Panel } from "@/components/ui/panel";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { useToast } from "@/hooks/use-toast";
import { eventCategoryIconColor } from "@/theme";

const CATEGORY_META: Record<
  string,
  { icon: LucideIcon; color: string; description: string; explanation: string }
> = {
  CPU_RECOMMENDATION_APPLIED: {
    icon: Cpu,
    color: eventCategoryIconColor.CPU_RECOMMENDATION_APPLIED,
    description: "CPU request/limit was updated by CruiseKube based on recommendations.",
    explanation: "CruiseKube analyzed actual usage and applied a new CPU request and/or limit to the workload. This helps right-size resources so the cluster can run more efficiently. The change is reflected in the pod spec.",
  },
  MEMORY_RECOMMENDATION_APPLIED: {
    icon: HardDrive,
    color: eventCategoryIconColor.MEMORY_RECOMMENDATION_APPLIED,
    description: "Memory request/limit was updated by CruiseKube based on recommendations.",
    explanation: "CruiseKube analyzed actual memory usage and applied a new memory request and/or limit to the workload. This reduces over-provisioning and can free capacity for other workloads. The change is reflected in the pod spec.",
  },
  POD_DISRUPTION_BLOCK_REMOVED: {
    icon: ShieldOff,
    color: eventCategoryIconColor.POD_DISRUPTION_BLOCK_REMOVED,
    description: "A pod disruption block was removed so the workload can be optimized.",
    explanation: "A temporary block that prevented evictions or changes was removed so CruiseKube can apply recommendations or consolidate pods. This is done during the configured disruption window when it is safe to touch the workload.",
  },
  POD_DISRUPTION_BLOCK_RESTORED: {
    icon: Shield,
    color: eventCategoryIconColor.POD_DISRUPTION_BLOCK_RESTORED,
    description: "A pod disruption block was restored after the optimization window.",
    explanation: "After the disruption window ended, CruiseKube restored the block that protects the workload from evictions or changes. The workload returns to its protected state until the next window.",
  },
  PDB_RELAXED: {
    icon: LockKeyholeOpen,
    color: eventCategoryIconColor.PDB_RELAXED,
    description: "PodDisruptionBudget was temporarily relaxed to allow evictions.",
    explanation: "The PodDisruptionBudget (PDB) minAvailable or maxUnavailable was temporarily relaxed so that evictions or scaling could proceed. This allows consolidation or right-sizing without violating the PDB during the change.",
  },
  PDB_RESTORED: {
    icon: LockKeyhole,
    color: eventCategoryIconColor.PDB_RESTORED,
    description: "PodDisruptionBudget was restored to its original minAvailable/maxUnavailable.",
    explanation: "After the planned evictions or changes, the PDB was restored to its original values. The workload is again protected by its normal disruption budget.",
  },
  WEBHOOK_MUTATION: {
    icon: Code,
    color: eventCategoryIconColor.WEBHOOK_MUTATION,
    description: "A webhook mutation was applied (e.g. resource patch).",
    explanation: "A Kubernetes admission webhook (e.g. from CruiseKube) mutated the resource—for example, patching CPU or memory requests/limits. The event records that the mutation was applied to the object.",
  },
  POD_EVICTION: {
    icon: Trash2,
    color: eventCategoryIconColor.POD_EVICTION,
    description: "A pod was evicted (e.g. for consolidation or scaling).",
    explanation: "A pod was evicted from its node, typically to consolidate workloads onto fewer nodes (bin packing) or to allow resource changes. The workload controller will recreate the pod elsewhere if needed.",
  },
  OOM_EVENT: {
    icon: AlertTriangle,
    color: eventCategoryIconColor.OOM_EVENT,
    description: "Out-of-memory event detected for a pod.",
    explanation: "The pod was killed or reported an out-of-memory (OOM) condition. This may indicate the workload needs more memory or that usage spiked. Check the workload’s memory requests and limits and any OOM details in the payload.",
  },
  NODE_OVERLOAD_TAINT_ADDED: {
    icon: CloudOff,
    color: eventCategoryIconColor.NODE_OVERLOAD_TAINT_ADDED,
    description: "Node was marked overloaded; taint added to discourage new pods.",
    explanation: "The node was identified as overloaded (e.g. high usage or pressure). A taint was added so the scheduler avoids placing new pods on it, helping to stabilize the node or allow evictions.",
  },
  NODE_OVERLOAD_TAINT_REMOVED: {
    icon: Cloud,
    color: eventCategoryIconColor.NODE_OVERLOAD_TAINT_REMOVED,
    description: "Overload taint was removed from the node.",
    explanation: "The overload condition on the node was cleared and the taint was removed. The node is again eligible for normal scheduling.",
  },
};

const DEFAULT_CATEGORY_META = {
  icon: Activity,
  color: "text-muted-foreground",
  description: "CruiseKube audit event.",
  explanation: "This event was recorded by CruiseKube. Check the Details section for more information.",
};

/** Minutes lookback for audit-events API (12h, 1d, 7d as common presets). */
const MINUTES_OPTIONS = [1, 5, 15, 30, 60, 720, 1440, 10080];

const CATEGORY_OPTIONS = [
  "all",
  ...Object.keys(CATEGORY_META),
] as const;

function categoryLabel(category: string): string {
  if (category === "all") return "All categories";
  return category.replace(/_/g, " ");
}

function categoryIcon(category: string): { Icon: LucideIcon; color: string } {
  const meta = category === "all" ? DEFAULT_CATEGORY_META : (CATEGORY_META[category] ?? DEFAULT_CATEGORY_META);
  return { Icon: meta.icon, color: meta.color };
}

function formatEventTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "medium",
    });
  } catch {
    return iso;
  }
}

function timeRangeOptionLabel(minutes: number): string {
  if (minutes === 1) return "1 minute";
  if (minutes === 720) return "12 hours";
  if (minutes === 1440) return "1 day";
  if (minutes === 10080) return "7 days";
  return `${minutes} minutes`;
}

/** Phrase for empty-state copy, e.g. "the last 7 days" vs "the last 5 minutes". */
function auditEventsWindowPhrase(minutes: number): string {
  if (minutes === 720) return "the last 12 hours";
  if (minutes === 1440) return "the last day";
  if (minutes === 10080) return "the last 7 days";
  return `the last ${minutes} minute${minutes !== 1 ? "s" : ""}`;
}

function formatTimeAgo(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);
    if (diffSec < 60) return "just now";
    if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? "s" : ""} ago`;
    if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? "s" : ""} ago`;
    return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;
  } catch {
    return "";
  }
}

function workloadName(event: AuditEvent): string {
  const t = event.payload?.target;
  return t?.kind && t?.name ? `${t.kind}/${t.name}` : "—";
}

/** Target as "Kind / Namespace / Name" for display in event details. */
function targetDisplay(event: AuditEvent): string {
  const t = event.payload?.target;
  if (!t) return "—";
  return `${t.kind} / ${t.namespace} / ${t.name}`;
}

/** Workload ID from event payload details (not derived from target). */
function workloadIdFromEvent(event: AuditEvent): string {
  const details = event.payload?.details;
  if (details == null || typeof details !== "object") return "";
  const id = details.workloadId;
  return typeof id === "string" ? id : "";
}

function eventCategoryLabel(category: string): string {
  return category.replace(/_/g, " ");
}

function EventCategoryBadge({ category, tooltipSide = "right" }: { category: string; tooltipSide?: "top" | "right" | "bottom" | "left" }) {
  const meta = CATEGORY_META[category] ?? DEFAULT_CATEGORY_META;
  const Icon = meta.icon;
  const label = eventCategoryLabel(category);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex cursor-help items-center gap-1.5 rounded-full border border-current/20 bg-current/10 px-2 py-0.5 text-xs font-medium ${meta.color}`}>
            <Icon className="h-3 w-3 shrink-0" />
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide} className="max-w-md">
          <p className="font-semibold">{label}</p>
          <p className="mt-1 text-muted-foreground text-xs">{meta.description}</p>
          <p className="mt-2 text-muted-foreground text-xs border-t border-border pt-2">{meta.explanation}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function WorkloadIdWithCopy({
  workloadId,
  onCopy,
  className,
  tooltipSide = "right",
}: {
  workloadId: string;
  onCopy: (workloadId: string) => void;
  className?: string;
  tooltipSide?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      {workloadId || "—"}
      {workloadId && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy(workloadId);
                }}
                aria-label="Copy workload ID"
              >
                <Copy className="h-3 w-3 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={tooltipSide}>Copy workload ID</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </span>
  );
}

/** Workload id format: TYPE:NAMESPACE:NAME (e.g. Deployment:my-namespace:my-app) */
const WORKLOAD_ID_PLACEHOLDER = "Deployment:namespace:workload-name";

export default function Events() {
  const { selectedClusterId } = useCluster();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [minutes, setMinutes] = useState(5);
  const [workloadSearch, setWorkloadSearch] = useState(() => searchParams.get("workload") ?? "");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);

  const copyWorkloadId = (workloadId: string) => {
    if (!workloadId) return;
    void navigator.clipboard.writeText(workloadId).then(() => {
      toast({ title: "Copied", description: "Workload ID copied to clipboard." });
    });
  };

  useEffect(() => {
    const w = searchParams.get("workload");
    if (w != null && w !== "") setWorkloadSearch(w);
  }, [searchParams]);

  const workloadId = workloadSearch.trim() || undefined;

  const { data, isLoading, error } = useQuery({
    queryKey: ["audit-events", selectedClusterId, minutes, workloadId],
    queryFn: () => apiClient.getAuditEvents(selectedClusterId!, minutes, workloadId),
    enabled: !!selectedClusterId,
    retry: 1,
  });

  const allEvents = data?.events ?? [];
  const events =
    categoryFilter === "all"
      ? allEvents
      : allEvents.filter((e) => e.category === categoryFilter);

  const categoryCount = (cat: string) =>
    cat === "all" ? allEvents.length : allEvents.filter((e) => e.category === cat).length;

  const activeFilterCount = [
    categoryFilter !== "all",
    workloadSearch.trim().length > 0,
  ].filter(Boolean).length;

  if (!selectedClusterId) {
    return (
      <PageShell className="animate-fade-in">
        <PageHeader
          icon={<Activity className="h-5 w-5" />}
          title="Events"
          description="Audit events performed by CruiseKube, including recommendations applied, evictions, and PDB changes."
        />
        <Alert variant="neutral">
          <Activity className="h-4 w-4" />
          <AlertTitle>Select a cluster</AlertTitle>
          <AlertDescription>Please select a cluster to view CruiseKube events.</AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  const emptyDescription =
    categoryFilter !== "all" && allEvents.length > 0
      ? `No events match the selected category (${categoryLabel(categoryFilter)}).`
      : workloadId
        ? `No events for workload "${workloadId}" in ${auditEventsWindowPhrase(minutes)}.`
        : `No events in ${auditEventsWindowPhrase(minutes)}.`;

  return (
    <PageShell className="animate-fade-in">
      <PageHeader
        icon={<Activity className="h-5 w-5" />}
        title="Events"
        description="Audit events performed by CruiseKube, including recommendations applied, evictions, PDB changes, and node taints."
      />

      <Panel variant="subtle" padding="md">
        {activeFilterCount > 0 ? (
          <div className="mb-3 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setCategoryFilter("all");
                setWorkloadSearch("");
              }}
            >
              Clear {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
            </Button>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
          <label className="space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last</span>
            <Select
              value={String(minutes)}
              onValueChange={(v) => setMinutes(Number(v))}
            >
              <SelectTrigger className="h-9 w-full bg-surface text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MINUTES_OPTIONS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {timeRangeOptionLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Category</span>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-full bg-surface text-sm">
                <SelectValue>
                  {(() => {
                    const { Icon, color } = categoryIcon(categoryFilter);
                    return (
                      <span className="flex items-center gap-2">
                        <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
                        <span className="tabular-nums">{categoryCount(categoryFilter)}</span>
                        <span className="text-muted-foreground">·</span>
                        {categoryLabel(categoryFilter)}
                      </span>
                    );
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((cat) => {
                  const { Icon, color } = categoryIcon(cat);
                  return (
                    <SelectItem key={cat} value={cat}>
                      <span className="flex items-center gap-2">
                        <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
                        <span className="tabular-nums">{categoryCount(cat)}</span>
                        <span className="text-muted-foreground">·</span>
                        {categoryLabel(cat)}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Workload ID</span>
            <div className="relative flex min-w-0 items-center">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder={WORKLOAD_ID_PLACEHOLDER}
                value={workloadSearch}
                onChange={(e) => setWorkloadSearch(e.target.value)}
                className="h-9 min-w-0 flex-1 bg-surface pl-8 pr-8 text-sm"
              />
              {workloadSearch ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 bottom-0 h-9 w-9 shrink-0"
                  onClick={() => setWorkloadSearch("")}
                  aria-label="Clear workload filter"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          </label>
        </div>
      </Panel>

      <Panel padding="none" className="overflow-hidden">
        <div className="border-b border-border bg-surface px-4 py-4 sm:px-5">
          <SectionHeader
            title="Audit event stream"
            description={`${events.length.toLocaleString()} event${events.length === 1 ? "" : "s"} shown from ${auditEventsWindowPhrase(minutes)}.`}
            helpText="Use event details to inspect the raw CruiseKube payload and copy workload IDs for cross-page investigation."
          />
        </div>
          {isLoading ? (
            <div className="p-4 sm:p-5">
              <LoadingState
                title="Loading events"
                description="Fetching recent CruiseKube audit events for the selected cluster."
              />
            </div>
          ) : error ? (
            <div className="p-4 sm:p-5">
              <ErrorState
                title="Error loading events"
                description={error instanceof Error ? error.message : "Failed to load events."}
              />
            </div>
          ) : events.length === 0 ? (
            <div className="p-4 sm:p-5">
              <EmptyState
                icon={Activity}
                title="No events found"
                description={emptyDescription}
              />
            </div>
          ) : (
            <>
            <div className="hidden md:block">
            <Table density="compact">
              <TableHeader>
                <TableRow className="bg-surface-subtle hover:bg-surface-subtle">
                  <TableHead className="w-[8rem]">Time</TableHead>
                  <TableHead className="min-w-[13rem]">Category</TableHead>
                  <TableHead className="min-w-[14rem]">Workload ID</TableHead>
                  <TableHead className="min-w-[16rem]">Object name</TableHead>
                  <TableHead className="w-24 text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event, index) => {
                  const eventWorkloadId = workloadIdFromEvent(event);
                  return (
                    <TableRow
                      key={`${event.created_at}-${index}`}
                      className={index % 2 === 1 ? "bg-surface-subtle/35" : ""}
                    >
                      <TableCell className="whitespace-nowrap align-top text-xs text-muted-foreground">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default">
                                {formatTimeAgo(event.created_at)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              {formatEventTime(event.created_at)}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="align-top">
                        <EventCategoryBadge category={event.category} />
                      </TableCell>
                      <TableCell className="min-w-0 break-all align-top font-mono text-xs text-muted-foreground">
                        <WorkloadIdWithCopy workloadId={eventWorkloadId} onCopy={copyWorkloadId} />
                      </TableCell>
                      <TableCell className="min-w-0 align-top font-mono text-xs">
                        {workloadName(event)}
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(event);
                          }}
                        >
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
            <div className="divide-y divide-border md:hidden">
              {events.map((event, index) => {
                const eventWorkloadId = workloadIdFromEvent(event);
                return (
                  <div key={`${event.created_at}-${index}-mobile`} className="space-y-3 bg-surface px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <EventCategoryBadge category={event.category} />
                      <span className="whitespace-nowrap text-xs text-muted-foreground">{formatTimeAgo(event.created_at)}</span>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                        <span className="text-muted-foreground">Workload</span>
                        <WorkloadIdWithCopy workloadId={eventWorkloadId} onCopy={copyWorkloadId} className="break-all font-mono" />
                        <span className="text-muted-foreground">Object</span>
                        <span className="break-all font-mono">{workloadName(event)}</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-full text-xs"
                      onClick={() => setSelectedEvent(event)}
                    >
                      View details
                    </Button>
                  </div>
                );
              })}
            </div>
            </>
          )}
      </Panel>

      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base">
              {selectedEvent && <EventCategoryBadge category={selectedEvent.category} tooltipSide="bottom" />}
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="flex flex-col gap-3 overflow-auto min-h-0">
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <span className="text-muted-foreground">Time</span>
                <span>{formatEventTime(selectedEvent.created_at)}</span>
                <span className="text-muted-foreground">Workload ID</span>
                <WorkloadIdWithCopy
                  workloadId={workloadIdFromEvent(selectedEvent)}
                  onCopy={copyWorkloadId}
                  className="font-mono"
                  tooltipSide="bottom"
                />
                <span className="text-muted-foreground">Target</span>
                <span className="font-mono">{targetDisplay(selectedEvent)}</span>
                {selectedEvent.payload?.message != null && (
                  <>
                    <span className="text-muted-foreground">Message</span>
                    <span>{selectedEvent.payload.message}</span>
                  </>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Details</p>
                <pre className="text-xs bg-surface-subtle rounded-md p-3 overflow-auto max-h-[50vh] font-mono whitespace-pre-wrap break-words border border-border">
                  {selectedEvent.payload?.details != null && Object.keys(selectedEvent.payload.details).length > 0
                    ? JSON.stringify(selectedEvent.payload.details, null, 2)
                    : "No details"}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
