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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

  const copyWorkloadId = (event: AuditEvent) => {
    const id = workloadIdFromEvent(event);
    if (!id) return;
    void navigator.clipboard.writeText(id).then(() => {
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

  if (!selectedClusterId) {
    return (
      <div className="p-6">
        <div className="text-center text-muted-foreground">
          Please select a cluster to view CruiseKube events
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Activity className="h-6 w-6 text-muted-foreground" />
          Events
        </h1>
        <p className="text-sm text-muted-foreground">
          Audit events performed by CruiseKube (recommendations applied, evictions, PDB changes, etc.)
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Last</span>
          <Select
            value={String(minutes)}
            onValueChange={(v) => setMinutes(Number(v))}
          >
            <SelectTrigger className="w-[9rem]">
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
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Category</span>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[18rem]">
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
        </div>
        <div className="relative flex-1 min-w-[16rem] max-w-md flex items-center gap-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder={WORKLOAD_ID_PLACEHOLDER}
            value={workloadSearch}
            onChange={(e) => setWorkloadSearch(e.target.value)}
            className="pl-8 pr-8 h-9 text-sm flex-1 min-w-0"
          />
          {workloadSearch && (
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
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : error ? (
            <div className="p-6 text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load events"}
            </div>
          ) : events.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">
              {categoryFilter !== "all" && allEvents.length > 0
                ? `No events match the selected category (${categoryLabel(categoryFilter)}).`
                : workloadId
                  ? `No events for workload "${workloadId}" in ${auditEventsWindowPhrase(minutes)}`
                  : `No events in ${auditEventsWindowPhrase(minutes)}`}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
                  <TableHead className="h-9 px-3 py-2 text-xs font-medium text-muted-foreground w-[8rem]">Time</TableHead>
                  <TableHead className="h-9 px-3 py-2 text-xs font-medium text-muted-foreground min-w-[10rem]">Category</TableHead>
                  <TableHead className="h-9 px-3 py-2 text-xs font-medium text-muted-foreground min-w-[10rem]">Workload ID</TableHead>
                  <TableHead className="h-9 px-3 py-2 text-xs font-medium text-muted-foreground min-w-[16rem]">Object name</TableHead>
                  <TableHead className="h-9 px-3 py-2 text-xs font-medium text-muted-foreground w-20">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event, index) => {
                  const meta = CATEGORY_META[event.category] ?? DEFAULT_CATEGORY_META;
                  const Icon = meta.icon;
                  return (
                    <TableRow
                      key={`${event.created_at}-${index}`}
                      className={index % 2 === 1 ? "bg-muted/10" : ""}
                    >
                      <TableCell className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap align-top">
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
                      <TableCell className="py-2 px-3 align-top">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={`inline-flex items-center gap-1 cursor-help text-xs ${meta.color}`}>
                                <Icon className="h-3 w-3 shrink-0" />
                                {event.category.replace(/_/g, " ")}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-md">
                              <p className="font-semibold">{event.category.replace(/_/g, " ")}</p>
                              <p className="mt-1 text-muted-foreground text-xs">{meta.description}</p>
                              <p className="mt-2 text-muted-foreground text-xs border-t border-border pt-2">{meta.explanation}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="py-2 px-3 font-mono text-xs align-top break-all min-w-0">
                        <span className="inline-flex items-center gap-1.5">
                          {workloadIdFromEvent(event) || "—"}
                          {workloadIdFromEvent(event) && (
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
                                      copyWorkloadId(event);
                                    }}
                                    aria-label="Copy workload ID"
                                  >
                                    <Copy className="h-3 w-3 text-muted-foreground" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                  Copy workload ID
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 px-3 font-mono text-xs align-top min-w-0">
                        {workloadName(event)}
                      </TableCell>
                      <TableCell className="py-2 px-3 align-top">
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
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base">
              {selectedEvent && (() => {
                const { icon: EventIcon } = CATEGORY_META[selectedEvent.category] ?? DEFAULT_CATEGORY_META;
                return (
                  <span className="flex items-center gap-2">
                    <EventIcon className="h-4 w-4 shrink-0" />
                    {selectedEvent.category.replace(/_/g, " ")}
                  </span>
                );
              })()}
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="flex flex-col gap-3 overflow-auto min-h-0">
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <span className="text-muted-foreground">Time</span>
                <span>{formatEventTime(selectedEvent.created_at)}</span>
                <span className="text-muted-foreground">Workload ID</span>
                <span className="font-mono inline-flex items-center gap-1.5">
                  {workloadIdFromEvent(selectedEvent) || "—"}
                  {workloadIdFromEvent(selectedEvent) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => copyWorkloadId(selectedEvent)}
                      aria-label="Copy workload ID"
                    >
                      <Copy className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  )}
                </span>
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
                <pre className="text-xs bg-muted/50 rounded-md p-3 overflow-auto max-h-[50vh] font-mono whitespace-pre-wrap break-words border border-border">
                  {selectedEvent.payload?.details != null && Object.keys(selectedEvent.payload.details).length > 0
                    ? JSON.stringify(selectedEvent.payload.details, null, 2)
                    : "No details"}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
