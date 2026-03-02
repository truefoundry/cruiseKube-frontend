import { useState } from "react";
import {
  Activity,
  ChevronDown,
  ChevronRight,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const CATEGORY_META: Record<
  string,
  { icon: LucideIcon; color: string }
> = {
  CPU_RECOMMENDATION_APPLIED: { icon: Cpu, color: "text-blue-600 dark:text-blue-400" },
  MEMORY_RECOMMENDATION_APPLIED: { icon: HardDrive, color: "text-violet-600 dark:text-violet-400" },
  POD_DISRUPTION_BLOCK_REMOVED: { icon: ShieldOff, color: "text-amber-600 dark:text-amber-400" },
  POD_DISRUPTION_BLOCK_RESTORED: { icon: Shield, color: "text-emerald-600 dark:text-emerald-400" },
  PDB_RELAXED: { icon: LockKeyholeOpen, color: "text-amber-500 dark:text-amber-400" },
  PDB_RESTORED: { icon: LockKeyhole, color: "text-emerald-500 dark:text-emerald-400" },
  WEBHOOK_MUTATION: { icon: Code, color: "text-slate-600 dark:text-slate-400" },
  POD_EVICTION: { icon: Trash2, color: "text-red-600 dark:text-red-400" },
  OOM_EVENT: { icon: AlertTriangle, color: "text-red-600 dark:text-red-400" },
  NODE_OVERLOAD_TAINT_ADDED: { icon: CloudOff, color: "text-orange-600 dark:text-orange-400" },
  NODE_OVERLOAD_TAINT_REMOVED: { icon: Cloud, color: "text-teal-600 dark:text-teal-400" },
};

const DEFAULT_CATEGORY_META = { icon: Activity, color: "text-muted-foreground" };

const MINUTES_OPTIONS = [1, 5, 15, 30, 60];

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

function EventRow({ event }: { event: AuditEvent }) {
  const [open, setOpen] = useState(false);
  const target = event.payload?.target;
  const details = event.payload?.details;
  const hasDetails = details != null && Object.keys(details).length > 0;
  const meta = CATEGORY_META[event.category] ?? DEFAULT_CATEGORY_META;
  const Icon = meta.icon;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border-b border-border last:border-b-0">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors min-h-0"
          >
            <span className="shrink-0 w-5 flex justify-center pt-0.5">
              {hasDetails ? (
                open ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )
              ) : (
                <span className="w-5" />
              )}
            </span>
            <span className={`shrink-0 pt-0.5 ${meta.color}`} aria-hidden>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-foreground leading-snug">
                  {event.payload?.message ?? event.category.replace(/_/g, " ")}
                </p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatEventTime(event.created_at)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span className="font-medium">{event.category.replace(/_/g, " ")}</span>
                {target && (
                  <>
                    <span className="text-muted-foreground/60" aria-hidden>·</span>
                    <span>
                      {target.kind} / {target.namespace} / <span className="font-mono">{target.name}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {hasDetails && (
            <div className="px-3 pb-2 pl-9">
              <p className="text-xs font-medium text-muted-foreground mb-1">Details (raw JSON)</p>
              <pre className="text-xs bg-muted/50 rounded-md p-2 overflow-auto max-h-48 font-mono whitespace-pre-wrap break-words">
                {JSON.stringify(details, null, 2)}
              </pre>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/** Workload id format: TYPE:NAMESPACE:NAME (e.g. Deployment:my-namespace:my-app) */
const WORKLOAD_ID_PLACEHOLDER = "Deployment:namespace:workload-name";

export default function Events() {
  const { selectedClusterId } = useCluster();
  const [minutes, setMinutes] = useState(1);
  const [workloadSearch, setWorkloadSearch] = useState("");

  const workloadId = workloadSearch.trim() || undefined;

  const { data, isLoading, error } = useQuery({
    queryKey: ["audit-events", selectedClusterId, minutes, workloadId],
    queryFn: () => apiClient.getAuditEvents(selectedClusterId!, minutes, workloadId),
    enabled: !!selectedClusterId,
    retry: 1,
  });

  const events = data?.events ?? [];

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-muted-foreground" />
            Events
          </h1>
          <p className="text-sm text-muted-foreground">
            Audit events performed by CruiseKube (recommendations applied, evictions, PDB changes, etc.)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Last</span>
          <Select
            value={String(minutes)}
            onValueChange={(v) => setMinutes(Number(v))}
          >
            <SelectTrigger className="w-[7rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MINUTES_OPTIONS.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {m === 1 ? "1 minute" : `${m} minutes`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[16rem] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder={WORKLOAD_ID_PLACEHOLDER}
            value={workloadSearch}
            onChange={(e) => setWorkloadSearch(e.target.value)}
            className="pl-8 pr-8 h-9 text-sm"
          />
          {workloadSearch && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 bottom-0 h-9 w-9"
              onClick={() => setWorkloadSearch("")}
              aria-label="Clear workload filter"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          Filter by workload (Kind:Namespace:Name). Leave empty for all events.
        </span>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Audit events</CardTitle>
        </CardHeader>
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
              {workloadId
                ? `No events for workload "${workloadId}" in the last ${minutes} minute${minutes !== 1 ? "s" : ""}`
                : `No events in the last ${minutes} minute${minutes !== 1 ? "s" : ""}`}
            </div>
          ) : (
            <div className="divide-y-0">
              {events.map((event, index) => (
                <EventRow key={`${event.created_at}-${index}`} event={event} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
