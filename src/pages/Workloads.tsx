import { ReactNode, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { 
  Search,
  X,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Info,
  Cpu,
  HardDrive,
  Package,
  Database,
  Briefcase,
  CalendarClock,
  Copy,
  CircleDot,
  Box,
  type LucideIcon,
  Pencil,
  ShieldAlert,
  Zap,
  Activity,
  BarChart2,
  Shrink,
  Ban,
  List,
  Layers,
  LockKeyhole,
  LockKeyholeOpen,
  Shield,
  DollarSign,
  MoreVertical,
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleArrowUp } from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCluster } from "@/contexts/ClusterContext";
import {
  apiClient,
  type Overrides,
  type WorkloadDetail,
  type WorkloadSummaryResponse,
  EXCLUDED_CODE_LABELS,
} from "@/lib/api";
import { 
  FrontendWorkload,
  formatCpu,
  formatCpuSigned,
  formatMemory,
  formatMemorySigned,
  moneySignedClass,
  mapCriticalToEvictionRanking,
} from "@/lib/transformers";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Panel } from "@/components/ui/panel";
import { EmptyState, LoadingState } from "@/components/ui/state";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { asArray, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { humanizeWindow } from "@/lib/cronUtils";
import { DisruptionWindowEditor } from "@/components/DisruptionWindowEditor";

const WORKLOAD_TYPE_ICONS: Record<string, LucideIcon> = {
  Deployment: Package,
  StatefulSet: Database,
  DaemonSet: Cpu,
  Job: Briefcase,
  CronJob: CalendarClock,
  ReplicaSet: Copy,
  Pod: CircleDot,
};

function WorkloadTypeIcon({ type }: { type: string }) {
  const Icon = WORKLOAD_TYPE_ICONS[type] ?? Box;
  const displayName = type || "Workload";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center justify-center cursor-default" onClick={(e) => e.stopPropagation()}>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{displayName}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function FilterSelect({
  value,
  onValueChange,
  placeholder,
  triggerClassName,
  children,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  triggerClassName: string;
  children: ReactNode;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

function StatusIconWithTooltip({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description: ReactNode;
  className: string;
  children: ReactNode;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("inline-flex cursor-help", className)}>{children}</span>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-sm">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-muted-foreground">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function WorkloadStatusIcons({ workload }: { workload: FrontendWorkload }) {
  const isGpuWorkload = workload.isGpuWorkload === true || (workload.excluded && workload.excludedReason?.toLowerCase().includes("gpu"));
  const hasDisruptionWindows = asArray(workload.disruptionWindows).length > 0;
  const pdbDndMitigated = isPdbDndMitigatedForUi(workload);
  const disruptionLockClassName = pdbDndMitigated ? "text-success" : "text-destructive";
  const disabledDescription = "Cruise is disabled for this workload (non-optimizable, HPA, GPU, etc.). Disruption windows are not applied;";
  const recommendOnlyDescription = "Cruise is in recommend-only mode, so disruption windows are not used for consolidation;";
  const statuses: Array<{
    key: string;
    show: boolean;
    title: string;
    description: ReactNode;
    className: string;
    icon: ReactNode;
  }> = [
    {
      key: "excluded",
      show: workload.excluded,
      title: "Non-optimizable",
      description: workload.excludedReason || "This workload is not optimizable by CruiseKube.",
      className: "text-muted-foreground",
      icon: <Ban className="h-4 w-4" aria-hidden />,
    },
    {
      key: "hpa",
      show: workload.hpaEnabled,
      title: "HPA enabled",
      description: "This workload has Horizontal Pod Autoscaler (HPA) on CPU or memory. Cruise is disabled for HPA workloads.",
      className: "text-amber-600 dark:text-amber-400",
      icon: <BarChart2 className="h-4 w-4" aria-hidden />,
    },
    {
      key: "scaled-down",
      show: workload.scaledDown,
      title: "Scaled down",
      description: "This workload has been scaled down to 0 replicas.",
      className: "text-blue-600 dark:text-blue-400",
      icon: <Shrink className="h-4 w-4" aria-hidden />,
    },
    {
      key: "gpu",
      show: isGpuWorkload,
      title: "GPU workload",
      description: <>This workload is identified as a GPU workload. {workload.excluded ? "It is non-optimizable for Cruise because it uses GPU resources." : "It may be non-optimizable for Cruise when it uses GPU resources."}</>,
      className: "text-violet-500 dark:text-violet-400",
      icon: <Cpu className="h-4 w-4" aria-hidden />,
    },
    {
      key: "pdb",
      show: workload.blockingConsolidationPdb,
      title: "Pod Disruption Budget (PDB)",
      description: isWorkloadDisabled(workload)
        ? `${disabledDescription} PDB is shown as locked.`
        : workload.mode !== "enabled"
          ? `${recommendOnlyDescription} PDB is shown as locked. Turn Cruise on to use scheduled windows.`
          : hasDisruptionWindows
            ? "Disruption windows are configured; during those windows the PDB is relaxed so nodes can consolidate. Outside the window the PDB still applies."
            : "PDB will block node consolidation. Add a disruption window in Edit CruiseConfig so consolidation can run during scheduled windows.",
      className: disruptionLockClassName,
      icon: pdbDndMitigated ? <LockKeyholeOpen className="h-4 w-4" aria-hidden /> : <LockKeyhole className="h-4 w-4" aria-hidden />,
    },
    {
      key: "dnd",
      show: workload.blockingConsolidationDoNotDisrupt,
      title: "Do-not-disrupt",
      description: isWorkloadDisabled(workload)
        ? `${disabledDescription} do-not-disrupt is shown as blocking.`
        : workload.mode !== "enabled"
          ? `${recommendOnlyDescription} do-not-disrupt is shown as blocking. Turn Cruise on to use scheduled windows.`
          : hasDisruptionWindows
            ? "Disruption windows are configured; during those windows the do-not-disrupt annotation is lifted so nodes can consolidate. Outside the window it still applies."
            : "Do-not-disrupt will block node consolidation. Add a disruption window in Edit CruiseConfig so consolidation can run during scheduled windows.",
      className: disruptionLockClassName,
      icon: <Shield className="h-4 w-4" aria-hidden />,
    },
    {
      key: "consolidation",
      show: workload.blockingConsolidation && !workload.inDisruptionWindow && !workload.blockingConsolidationPdb && !workload.blockingConsolidationDoNotDisrupt,
      title: "Blocks node consolidation",
      description: "This workload blocks consolidation of nodes. Set up a disruption window in Edit CruiseConfig so that nodes can consolidate during the window.",
      className: "text-amber-600 dark:text-amber-400",
      icon: <ShieldAlert className="h-4 w-4" aria-hidden />,
    },
  ];

  return (
    <span className="inline-flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
      {statuses.filter((status) => status.show).map((status) => (
        <StatusIconWithTooltip
          key={status.key}
          title={status.title}
          description={status.description}
          className={status.className}
        >
          {status.icon}
        </StatusIconWithTooltip>
      ))}
    </span>
  );
}

/** Server metadata: exclusion annotation and/or non-empty excludedCodes (matches Non-optimizable summary + filter). */
function isNonOptimizableByMetadata(workload: FrontendWorkload): boolean {
  return workload.excluded === true || !!(workload.excludedCodes && workload.excludedCodes.length > 0);
}

/** True when workload should be disabled for Cruise. */
function isWorkloadDisabled(workload: FrontendWorkload): boolean {
  return !!(
    workload.excluded ||
    workload.isGpuWorkload ||
    workload.hpaEnabled ||
    (workload.excludedCodes && workload.excludedCodes.length > 0)
  );
}

/** Green / open PDB–DND icons only when Cruise is on, the row is optimizable, and disruption windows exist. */
function isPdbDndMitigatedForUi(workload: FrontendWorkload): boolean {
  return (
    !isWorkloadDisabled(workload) &&
    workload.mode === "enabled" &&
    asArray(workload.disruptionWindows).length > 0
  );
}

function getCriticalColor(critical: string): string {
  switch (critical) {
    case "low": return "text-destructive";
    case "medium": return "text-warning";
    case "high": return "text-success";
    case "very-high": return "text-primary";
    case "nonOptimizable": return "text-muted-foreground";
    default: return "text-muted-foreground";
  }
}

function formatCriticalLabel(critical: string): string {
  switch (critical) {
    case "very-high":
      return "Very High";
    case "low":
    case "medium":
    case "high":
      return critical.charAt(0).toUpperCase() + critical.slice(1);
    default:
      return critical.replace(/-/g, " ");
  }
}

/** API expects workload ID with colons; stats may use slashes. */
function workloadIdForApi(id: string): string {
  return id.includes("/") ? id.replace(/\//g, ":") : id;
}

/** Short relative time for table display (e.g. "now", "5m", "2h", "3d"). */
function formatUpdatedAtShort(utcSeconds: number): string {
  const diffMs = Date.now() - utcSeconds * 1000;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

function normalizeCritical(p: string): "low" | "medium" | "high" | "very-high" {
  if (p === "low" || p === "medium" || p === "high" || p === "very-high") return p;
  return "medium";
}

function workloadDetailToFrontend(d: WorkloadDetail): FrontendWorkload {
  const mode = d.config.cruiseEnabled ? "enabled" : "recommend-only";
  const critical = normalizeCritical(d.config.criticalityLevel);
  const c = d.constraints;
  const podAvgCpu = d.cpu.pod_current_avg ?? d.cpu.podCurrentAvg;
  const podAvgMem = d.memory.pod_current_avg ?? d.memory.podCurrentAvg;
  return {
    id: d.workloadID,
    namespace: d.namespace,
    workload: d.name,
    type: d.kind,
    replicas: d.podsCount,
    potentialCpu: d.cpu.recommended.change,
    potentialMem: d.memory.recommended.change,
    currentCpu: formatCpu(d.cpu.current),
    podCurrentAvgCpu: typeof podAvgCpu === "number" ? formatCpu(podAvgCpu) : "—",
    recommendedCpu: formatCpu(d.cpu.recommended.avg),
    currentMem: formatMemory(d.memory.current),
    podCurrentAvgMem: typeof podAvgMem === "number" ? formatMemory(podAvgMem) : "—",
    recommendedMem: formatMemory(d.memory.recommended.avg),
    potentialDollars: d.dollarSavingsPerMonth,
    reliabilityCostDollars: d.dollarExpenditurePerMonth,
    lastUpdated: formatUpdatedAtShort(d.updatedAt),
    updatedAt: d.updatedAt,
    mode,
    critical,
    hasRecommendations: d.dollarSavingsPerMonth !== 0 || d.dollarExpenditurePerMonth !== 0,
    excluded: c?.excludedAnnotation ?? false,
    excludedReason: c?.excludedAnnotation ? "Non-optimizable (exclusion annotation)" : undefined,
    disruptionWindows: (d.config.disruptionSchedule ?? []).map((w) => ({
      startCron: w.windowStartCron,
      endCron: w.windowEndCron,
    })),
    blockingConsolidation: c?.blockingConsolidation ?? false,
    blockingConsolidationPdb: c?.pdb ?? false,
    blockingConsolidationDoNotDisrupt: c?.doNotDisruptAnnotation ?? false,
    inDisruptionWindow: d.config.inDisruptionWindow ?? false,
    isGpuWorkload: c?.isGPUWorkload ?? false,
    hpaEnabled: d.config.hpaEnabled ?? false,
    excludedCodes: (d.config.excludedCodes?.length ?? 0) > 0 ? d.config.excludedCodes : undefined,
    scaledDown: d.scaledDown ?? false,
  };
}

function InfoTooltip({
  label,
  children,
  contentClassName = "max-w-xs",
}: {
  label: string;
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="inline-flex shrink-0 text-muted-foreground hover:text-foreground focus:outline-none"
            aria-label={label}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className={contentClassName}>
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ColumnResizeHandle({ columnIndex, onResizeStart }: { columnIndex: number; onResizeStart: (columnIndex: number, clientX: number) => void }) {
  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onResizeStart(columnIndex, e.clientX);
      }}
      aria-hidden
    />
  );
}

function SortIcon({ active, direction }: { active: boolean; direction: "asc" | "desc" | null }) {
  if (!active || !direction) return null;
  return direction === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
}

function SortableResizableHeader({
  column,
  sortColumn,
  sortDirection,
  onSort,
  resizeColumnIndex,
  onResizeStart,
  children,
  className,
  contentClassName,
  rowSpan,
}: {
  column: string;
  sortColumn: string | null;
  sortDirection: "asc" | "desc" | null;
  onSort: (column: string) => void;
  resizeColumnIndex: number;
  onResizeStart: (columnIndex: number, clientX: number) => void;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  rowSpan?: number;
}) {
  return (
    <th
      rowSpan={rowSpan}
      className={cn("cursor-pointer select-none hover:bg-muted/50 transition-colors align-middle leading-none py-2 relative", className)}
      onClick={(e) => {
        e.stopPropagation();
        onSort(column);
      }}
    >
      <div className={cn("flex items-center gap-1 pr-2", contentClassName)}>
        {children}
        <SortIcon active={sortColumn === column} direction={sortDirection} />
      </div>
      <ColumnResizeHandle columnIndex={resizeColumnIndex} onResizeStart={onResizeStart} />
    </th>
  );
}

export default function Workloads() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { selectedClusterId } = useCluster();
  const [search, setSearch] = useState("");
  const [namespaceFilter, setNamespaceFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [criticalFilter, setCriticalFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "excluded" | "blocking-consolidation" | "gpu" | "hpa-enabled" | "scaled-down"
  >("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<string | null>("potentialDollars");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc" | null>("desc");
  const [editWorkload, setEditWorkload] = useState<FrontendWorkload | null>(null);
  const [editCritical, setEditCritical] = useState<'low' | 'medium' | 'high' | 'very-high'>('medium');
  const [editMode, setEditMode] = useState<'enabled' | 'recommend-only'>('recommend-only');
  const [editDisruptionWindows, setEditDisruptionWindows] = useState<{ startCron: string; endCron: string }[]>([]);
  const [selectedWorkloadIds, setSelectedWorkloadIds] = useState<Set<string>>(new Set());

  const MIN_COLUMN_WIDTH = 40;
  const DEFAULT_COLUMN_WIDTHS = [30, 250, 125, 40, 90, 90, 90, 90, 90, 90, 90, 78, 78, 36];
  const [columnWidths, setColumnWidths] = useState<number[]>(() => DEFAULT_COLUMN_WIDTHS);
  const [resizingCol, setResizingCol] = useState<number | null>(null);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(0);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (resizingCol === null) return;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const onMove = (e: MouseEvent) => {
      setColumnWidths((prev) => {
        const next = [...prev];
        const newW = resizeStartWidthRef.current + (e.clientX - resizeStartXRef.current);
        next[resizingCol] = Math.max(MIN_COLUMN_WIDTH, newW);
        return next;
      });
    };
    const onUp = () => {
      setResizingCol(null);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [resizingCol]);

  const startResize = (colIndex: number, clientX: number) => {
    setResizingCol(colIndex);
    resizeStartXRef.current = clientX;
    resizeStartWidthRef.current = columnWidths[colIndex];
  };

  const updateOverrideMutation = useMutation<
    Awaited<ReturnType<typeof apiClient.updateWorkloadOverrides>>,
    Error,
    { workloadId: string; overrides: Overrides },
    { previous?: WorkloadSummaryResponse }
  >({
    mutationFn: async ({ workloadId, overrides }: { workloadId: string; overrides: Overrides }) => {
      if (!selectedClusterId) throw new Error('No cluster selected');
      return apiClient.updateWorkloadOverrides(selectedClusterId, workloadId, overrides);
    },

    onMutate: async ({ workloadId, overrides }) => {
      if (!selectedClusterId || typeof overrides.enabled !== "boolean")
        return {} as { previous?: WorkloadSummaryResponse };
      const key = ["workloads-summary", selectedClusterId] as const;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<WorkloadSummaryResponse>(key);
      if (previous) {
        flushSync(() => {
          queryClient.setQueryData<WorkloadSummaryResponse>(key, {
            ...previous,
            workloadDetails: previous.workloadDetails.map((d) =>
              workloadIdForApi(d.workloadID) === workloadId
                ? { ...d, config: { ...d.config, cruiseEnabled: overrides.enabled! } }
                : d
            ),
          });
        });
      }
      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      const key = ["workloads-summary", selectedClusterId] as const;
      if (context?.previous !== undefined) {
        queryClient.setQueryData(key, context.previous);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update CruiseConfig",
        variant: "destructive",
      });
    },

    onSuccess: () => {
      toast({
        title: "Success",
        description: "CruiseConfig updated successfully",
      });
      setEditWorkload(null);
    },
    onSettled: () => {
      if (selectedClusterId) {
        void queryClient.invalidateQueries({ queryKey: ['workloads-summary', selectedClusterId] });
      }
    },
  });

  const batchOverridesMutation = useMutation<
    Awaited<ReturnType<typeof apiClient.batchWorkloadOverrides>>,
    Error,
    { workloadIds: string[]; enabled: boolean },
    { previous?: WorkloadSummaryResponse }
  >({
    mutationFn: async ({ workloadIds, enabled }: { workloadIds: string[]; enabled: boolean }) => {
      if (!selectedClusterId) throw new Error('No cluster selected');
      return apiClient.batchWorkloadOverrides(selectedClusterId, workloadIds, { enabled });
    },
    onMutate: async ({ workloadIds, enabled }) => {
      if (!selectedClusterId) return {} as { previous?: WorkloadSummaryResponse };
      const key = ["workloads-summary", selectedClusterId] as const;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<WorkloadSummaryResponse>(key);
      const targets = new Set(workloadIds.map((id) => workloadIdForApi(id)));
      if (previous) {
        flushSync(() => {
          queryClient.setQueryData<WorkloadSummaryResponse>(key, {
            ...previous,
            workloadDetails: previous.workloadDetails.map((d) =>
              targets.has(workloadIdForApi(d.workloadID))
                ? { ...d, config: { ...d.config, cruiseEnabled: enabled } }
                : d
            ),
          });
        });
      }
      return { previous };
    },
    onError: (error: Error, _vars, context) => {
      const key = ["workloads-summary", selectedClusterId] as const;
      if (context?.previous !== undefined) {
        queryClient.setQueryData(key, context.previous);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update workloads",
        variant: "destructive",
      });
    },
    onSuccess: (_, { workloadIds, enabled }) => {
      setSelectedWorkloadIds(new Set());
      toast({
        title: "Success",
        description: `Cruise ${enabled ? "enabled" : "disabled"} for ${workloadIds.length} workload${workloadIds.length !== 1 ? "s" : ""}.`,
      });
    },
    onSettled: () => {
      if (selectedClusterId) {
        void queryClient.invalidateQueries({ queryKey: ['workloads-summary', selectedClusterId] });
      }
    },
  });

  const isRowCruiseTogglePending = (workload: FrontendWorkload) => {
    const apiId = workloadIdForApi(workload.id);
    if (updateOverrideMutation.isPending && updateOverrideMutation.variables?.workloadId === apiId) {
      return true;
    }
    if (batchOverridesMutation.isPending && batchOverridesMutation.variables) {
      return batchOverridesMutation.variables.workloadIds.some(
        (id) => workloadIdForApi(id) === apiId
      );
    }
    return false;
  };

  const openEditModal = (workload: FrontendWorkload) => {
    setEditWorkload(workload);
    setEditCritical(workload.critical);
    setEditMode(workload.mode);
    setEditDisruptionWindows(workload.disruptionWindows ?? []);
  };

  const handleModeToggle = (workload: FrontendWorkload) => {
    if (isWorkloadDisabled(workload) || !selectedClusterId) return;
    const newMode = workload.mode === "enabled" ? "recommend-only" : "enabled";
    const cruiseEnabled = newMode === "enabled";
    const apiWorkloadId = workloadIdForApi(workload.id);
    const overrides: Overrides = {
      eviction_ranking: mapCriticalToEvictionRanking(workload.critical),
      enabled: cruiseEnabled,
    };
    const windows = asArray(workload.disruptionWindows);
    if (windows.length > 0) {
      overrides.disruption_windows = windows.map((w) => ({
        start_cron: w.startCron,
        end_cron: w.endCron,
      }));
    }
    updateOverrideMutation.mutate({
      workloadId: apiWorkloadId,
      overrides,
    });
  };

  const handleSaveCruiseConfig = () => {
    if (!editWorkload || !selectedClusterId) return;
    const id = workloadIdForApi(editWorkload.id);
    const cruiseEnabled = editMode === "enabled";
    const overrides: Overrides = {
      eviction_ranking: mapCriticalToEvictionRanking(editCritical),
      enabled: cruiseEnabled,
    };
    if (editDisruptionWindows.length > 0) {
      overrides.disruption_windows = editDisruptionWindows.map((w) => ({
        start_cron: w.startCron,
        end_cron: w.endCron,
      }));
    }
    updateOverrideMutation.mutate({
      workloadId: id,
      overrides,
    });
  };

  const { data: summaryData, isLoading: isLoadingSummary, error: summaryError } = useQuery({
    queryKey: ['workloads-summary', selectedClusterId],
    queryFn: () => apiClient.getWorkloadsSummary(selectedClusterId!),
    enabled: !!selectedClusterId,
  });

  const workloads: FrontendWorkload[] = (summaryData?.workloadDetails ?? []).map(workloadDetailToFrontend);

  const parseCpuValue = (cpuString: string): number => {
    if (!cpuString) return 0;
    const rangeParts = cpuString.split("-");
    const valueToParse = rangeParts.length > 1 ? rangeParts[1].trim() : cpuString;
    if (valueToParse.endsWith("m")) {
      return parseFloat(valueToParse.replace("m", "")) / 1000;
    }
    if (valueToParse.includes("cores")) {
      return parseFloat(valueToParse.replace("cores", "")) || 0;
    }
    return parseFloat(valueToParse) || 0;
  };

  const parseMemoryValue = (memString: string): number => {
    if (!memString) return 0;
    const rangeParts = memString.split("-");
    const valueToParse = rangeParts.length > 1 ? rangeParts[1].trim() : memString;
    if (valueToParse.endsWith("MB")) {
      return parseFloat(valueToParse.replace("MB", "")) || 0;
    }
    if (valueToParse.endsWith("GB")) {
      return (parseFloat(valueToParse.replace("GB", "")) || 0) * 1000;
    }
    return parseFloat(valueToParse) || 0;
  };

  /** CPU for table cell: number only (cores), unit is in column header. Shows — when 0. */
  const tableCpuDisplay = (cpuString: string): string => {
    const cores = parseCpuValue(cpuString);
    if (cores === 0) return "—";
    return cores < 1 ? cores.toFixed(4) : cores.toFixed(2);
  };
  /** Memory for table cell: number only (GB), unit is in column header. Shows — when 0. */
  const tableMemDisplay = (memString: string): string => {
    const mb = parseMemoryValue(memString);
    if (mb === 0) return "—";
    return (mb / 1000).toFixed(4);
  };

  const sortWorkloads = (workloads: FrontendWorkload[]): FrontendWorkload[] => {
    const list = workloads ?? [];
    if (!sortColumn || !sortDirection) {
      return list;
    }

    const sorted = [...list].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortColumn) {
        case "namespace":
        case "workload":
        case "type":
        case "mode":
        case "critical":
          aValue = a[sortColumn as keyof FrontendWorkload] as string;
          bValue = b[sortColumn as keyof FrontendWorkload] as string;
          if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
          if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
          return 0;

        case "replicas":
        case "potentialDollars":
        case "reliabilityCostDollars":
          aValue = a[sortColumn as keyof FrontendWorkload] as number;
          bValue = b[sortColumn as keyof FrontendWorkload] as number;
          return sortDirection === "asc" ? aValue - bValue : bValue - aValue;

        case "netSavings": {
          const aNet = a.potentialDollars - a.reliabilityCostDollars;
          const bNet = b.potentialDollars - b.reliabilityCostDollars;
          return sortDirection === "asc" ? aNet - bNet : bNet - aNet;
        }

        case "cruiseConfig": {
          const modeOrder = (m: string) => (m === "enabled" ? 1 : 0);
          const criticalOrder = (p: string) => ({ "very-high": 3, high: 2, medium: 1, low: 0 }[p] ?? -1);
          const aMode = modeOrder(a.mode);
          const bMode = modeOrder(b.mode);
          if (aMode !== bMode) return sortDirection === "asc" ? aMode - bMode : bMode - aMode;
          const aPri = criticalOrder(a.critical);
          const bPri = criticalOrder(b.critical);
          return sortDirection === "asc" ? aPri - bPri : bPri - aPri;
        }

        case "currentCpu":
        case "podCurrentAvgCpu":
        case "recommendedCpu":
          aValue = parseCpuValue(a[sortColumn as keyof FrontendWorkload] as string);
          bValue = parseCpuValue(b[sortColumn as keyof FrontendWorkload] as string);
          return sortDirection === "asc" ? aValue - bValue : bValue - aValue;

        case "potentialCpu":
          aValue = a.potentialCpu;
          bValue = b.potentialCpu;
          return sortDirection === "asc" ? aValue - bValue : bValue - aValue;

        case "currentMem":
        case "podCurrentAvgMem":
        case "recommendedMem":
          aValue = parseMemoryValue(a[sortColumn as keyof FrontendWorkload] as string);
          bValue = parseMemoryValue(b[sortColumn as keyof FrontendWorkload] as string);
          return sortDirection === "asc" ? aValue - bValue : bValue - aValue;

        case "potentialMem":
          aValue = a.potentialMem;
          bValue = b.potentialMem;
          return sortDirection === "asc" ? aValue - bValue : bValue - aValue;

        default:
          return 0;
      }
    });

    return sorted;
  };

  const filteredWorkloads = asArray(workloads).filter((w) => {
    const matchesSearch = 
      w.workload.toLowerCase().includes(search.toLowerCase()) ||
      w.namespace.toLowerCase().includes(search.toLowerCase());
    const matchesNamespace = namespaceFilter === "all" || w.namespace === namespaceFilter;
    const matchesMode = modeFilter === "all" || w.mode === modeFilter;
    const matchesCritical = criticalFilter === "all" || w.critical === criticalFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "excluded" && isNonOptimizableByMetadata(w)) ||
      (statusFilter === "blocking-consolidation" && w.blockingConsolidation === true) ||
      (statusFilter === "gpu" && w.isGpuWorkload === true) ||
      (statusFilter === "hpa-enabled" && w.hpaEnabled === true) ||
      (statusFilter === "scaled-down" && w.scaledDown === true);
    const matchesType = typeFilter === "all" || w.type === typeFilter;
    return matchesSearch && matchesNamespace && matchesMode && matchesCritical && matchesStatus && matchesType;
  });

  const sortedWorkloads = sortWorkloads(filteredWorkloads);
  const selectableWorkloads = asArray(sortedWorkloads).filter((w) => !isWorkloadDisabled(w));

  const toggleSelection = (workloadId: string) => {
    setSelectedWorkloadIds((prev) => {
      const next = new Set(prev);
      if (next.has(workloadId)) next.delete(workloadId);
      else next.add(workloadId);
      return next;
    });
  };
  const selectAllSelectable = () => {
    setSelectedWorkloadIds(new Set(selectableWorkloads.map((w) => w.id)));
  };
  const clearSelection = () => setSelectedWorkloadIds(new Set());
  const allSelectableSelected = selectableWorkloads.length > 0 && selectableWorkloads.every((w) => selectedWorkloadIds.has(w.id));
  const someSelected = selectedWorkloadIds.size > 0;
  const columnWidthTotal = columnWidths.reduce((total, width) => total + width, 0);
  const activeFilterCount = [
    namespaceFilter !== "all",
    modeFilter !== "all",
    criticalFilter !== "all",
    statusFilter !== "all",
    typeFilter !== "all",
    search.trim().length > 0,
  ].filter(Boolean).length;

  const handleBatchEnable = () => {
    const ids = [...selectedWorkloadIds].map((id) => workloadIdForApi(id));
    if (ids.length === 0 || !selectedClusterId) return;
    batchOverridesMutation.mutate({ workloadIds: ids, enabled: true });
  };
  const handleBatchDisable = () => {
    const ids = [...selectedWorkloadIds].map((id) => workloadIdForApi(id));
    if (ids.length === 0 || !selectedClusterId) return;
    batchOverridesMutation.mutate({ workloadIds: ids, enabled: false });
  };

  const namespaces = [...new Set(asArray(workloads).map((w) => w.namespace))];
  const workloadTypesInData = [...new Set(asArray(workloads).map((w) => w.type))].sort();

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      if (sortDirection === "desc") {
        setSortDirection("asc");
      } else if (sortDirection === "asc") {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  if (!selectedClusterId) {
    return (
      <PageShell className="animate-fade-in">
        <PageHeader
          icon={<Layers className="h-5 w-5" />}
          title="Workloads"
          description="Browse workloads, compare recommended CPU and memory, estimate monthly savings, and switch Cruise or recommend-only mode."
        />
        <EmptyState
          icon={Layers}
          title="Select a cluster"
          description="Choose a cluster to view workload recommendations, CruiseConfig status, and optimization opportunities."
        />
      </PageShell>
    );
  }

  const isLoadingMetrics = isLoadingSummary;
  const apiErrorMessage = summaryError instanceof Error ? summaryError.message : (summaryError ? "Unknown error" : null);

  const enabledWorkloads = sortedWorkloads.filter((w) => w.mode === "enabled" && !isWorkloadDisabled(w));
  const enabledCount = enabledWorkloads.length;
  const costOptimisedCount = enabledWorkloads.filter((w) => w.potentialDollars > 0).length;
  const reliabilityImprovedCount = enabledWorkloads.filter((w) => w.reliabilityCostDollars > 0).length;
  const disabledCount = sortedWorkloads.filter((w) => w.mode === "recommend-only" && !isWorkloadDisabled(w)).length;
  const nonOptimizableCount = sortedWorkloads.filter(isNonOptimizableByMetadata).length;

  const hasNoData = !isLoadingMetrics && (summaryData?.workloadDetails?.length ?? 0) === 0;

  const clusterUtilisationTooltipContent = (
    <div className="space-y-2 text-left">
      <p className="font-medium text-foreground">Cluster utilisation</p>
      <p className="text-xs text-muted-foreground">
        These bars compare allocatable capacity against what workloads are using and what they have requested.
      </p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        <li>Utilised: resources currently consumed by running workloads.</li>
        <li>Requested: resources reserved by Kubernetes requests, including unused headroom.</li>
        <li>Free: allocatable capacity not currently requested.</li>
      </ul>
    </div>
  );

  const cruiseKubeAdoptionTooltipContent = (
    <div className="space-y-2 text-left">
      <p className="font-medium text-foreground">CruiseKube adoption</p>
      <p className="text-xs text-muted-foreground">
        This summary shows how workloads are distributed across optimization states.
      </p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        <li>Workloads: rows currently shown in the table (after search and filters).</li>
        <li>Enabled: Cruise mode on (non-disabled rows), then cost optimised and reliability improved as count and estimated monthly total, separated by middots.</li>
        <li>Disabled: recommend-only among non-disabled visible rows.</li>
        <li>Non-optimizable: visible workloads that are not eligible for optimization (per server metadata or reason codes).</li>
      </ul>
    </div>
  );

  const untappedSavingsTooltipContent = (
    <div className="space-y-2 text-left">
      <p className="font-medium text-foreground">Untapped savings</p>
      <p className="text-xs text-muted-foreground">
        Possible savings is the monthly reduction available if recommended requests are applied. Current savings is what the cluster is already saving relative to normalized workload requests.
      </p>
    </div>
  );

  const podsTooltipContent = (
    <p className="max-w-xs text-xs text-muted-foreground">
      Number of running pod replicas for this workload.
    </p>
  );

  const netSavingsTooltipContent = (
    <p className="max-w-xs text-xs text-muted-foreground">
      Estimated monthly savings from rightsizing this workload. It reflects only cost reductions from lower resource requests and does not subtract reliability increase costs.
    </p>
  );

  const modeTooltipContent = (
    <p className="max-w-xs text-xs text-muted-foreground">
      Cruise automatically applies recommendations. Recommend shows recommendations without auto-applying them.
    </p>
  );

  const criticalityTooltipContent = (
    <div className="space-y-2 text-left">
      <p className="font-medium text-foreground">Criticality</p>
      <p className="text-xs text-muted-foreground">
        Indicates how sensitive a workload is during optimization. Higher criticality workloads are treated more conservatively.
      </p>
    </div>
  );

  const modeHeaderTooltipContent = (
    <div className="space-y-2 text-left">
      <p className="font-medium text-foreground">Mode</p>
      <p className="text-xs text-muted-foreground">
        When on, recommendations are auto-applied in Cruise mode. When off, recommendations are shown without being auto-applied.
      </p>
    </div>
  );

  const resourceHeaderTooltipContent = (
    <div className="space-y-2 text-left">
      <p className="font-medium text-foreground">CPU and memory fields</p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        <li>Workload: configured resource request for the workload (from manifests).</li>
        <li>Current: average observed per pod.</li>
        <li>Recommended: the request CruiseKube recommends based on observed usage.</li>
        <li>Savings: the reduction from workload request to recommended request.</li>
      </ul>
    </div>
  );

  return (
    <PageShell className="min-w-0 animate-fade-in gap-6">
      <PageHeader
        icon={<Layers className="h-5 w-5" />}
        title="Workloads"
        description="Browse workloads, compare recommended CPU and memory, estimate monthly savings, and switch Cruise or recommend-only mode."
      />

      {apiErrorMessage && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error loading workloads</AlertTitle>
          <AlertDescription>{apiErrorMessage}</AlertDescription>
        </Alert>
      )}

      {hasNoData && (
        <Alert variant="info">
          <Info className="h-4 w-4" />
          <AlertTitle>No workload data available</AlertTitle>
          <AlertDescription>
            No workload or stats data was returned for this cluster. The cluster may have no workloads yet, or the data sync may not have completed. Try refreshing the page or selecting another cluster.
          </AlertDescription>
        </Alert>
      )}

      <section aria-labelledby="workloads-heading" className="min-w-0 space-y-4">
        <Panel variant="subtle" padding="md">
          {activeFilterCount > 0 ? (
            <div className="mb-3 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setSearch("");
                  setNamespaceFilter("all");
                  setModeFilter("all");
                  setCriticalFilter("all");
                  setStatusFilter("all");
                  setTypeFilter("all");
                }}
              >
                Clear {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
              </Button>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 lg:items-end">
            <label className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Search</span>
              <div className="relative flex min-w-0 items-center">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search workloads..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 min-w-0 flex-1 bg-surface pl-8 pr-8 text-sm"
                />
                {search ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 bottom-0 h-9 w-9 shrink-0"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Namespace</span>
              <FilterSelect
                value={namespaceFilter}
                onValueChange={setNamespaceFilter}
                placeholder="Namespace"
                triggerClassName="h-9 w-full bg-surface text-sm"
              >
                <SelectItem value="all">All namespaces</SelectItem>
                {asArray(namespaces).map((ns) => (
                  <SelectItem key={ns} value={ns}>{ns}</SelectItem>
                ))}
              </FilterSelect>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Mode</span>
              <FilterSelect
                value={modeFilter}
                onValueChange={setModeFilter}
                placeholder="Mode"
                triggerClassName="h-9 w-full bg-surface text-sm"
              >
                <SelectItem value="all">All modes</SelectItem>
                <SelectItem value="enabled">Cruise</SelectItem>
                <SelectItem value="recommend-only">Recommend</SelectItem>
              </FilterSelect>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Criticality</span>
              <FilterSelect
                value={criticalFilter}
                onValueChange={setCriticalFilter}
                placeholder="Criticality"
                triggerClassName="h-9 w-full bg-surface text-sm"
              >
                <SelectItem value="all">All criticalities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="very-high">Very High</SelectItem>
              </FilterSelect>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</span>
              <FilterSelect
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
                placeholder="Status"
                triggerClassName="h-9 w-full bg-surface text-sm"
              >
                <SelectItem value="all">All workload states</SelectItem>
                <SelectItem value="excluded">Non-optimizable</SelectItem>
                <SelectItem value="blocking-consolidation">Blocking consolidation</SelectItem>
                <SelectItem value="gpu">GPU workload</SelectItem>
                <SelectItem value="hpa-enabled">HPA enabled</SelectItem>
                <SelectItem value="scaled-down">Scaled down</SelectItem>
              </FilterSelect>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Type</span>
              <FilterSelect
                value={typeFilter}
                onValueChange={setTypeFilter}
                placeholder="Type"
                triggerClassName="h-9 w-full bg-surface text-sm"
              >
                <SelectItem value="all">All types</SelectItem>
                {workloadTypesInData.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </FilterSelect>
            </label>
          </div>
        </Panel>

        <Panel data-tour="workload-table" padding="none" className="min-w-0 overflow-hidden">
            <div className="border-b border-border bg-surface px-4 py-4 sm:px-5">
              <SectionHeader
                id="workloads-heading"
                title="Workload list"
                description="Compare workload recommendations, resource requests, savings, and CruiseConfig controls."
                helpText={cruiseKubeAdoptionTooltipContent}
              />
            </div>

            {/* Workload summary — integrated bar above table */}
            <div data-tour="workload-summary" className="border-b border-border bg-surface-subtle/80 px-4 py-3">
              {isLoadingMetrics ? (
                <div className="flex flex-wrap items-center gap-6">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-[min(100%,36rem)]" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-muted-foreground">Workloads</span>
                      <span className="font-mono font-semibold tabular-nums text-foreground">{sortedWorkloads.length}</span>
                    </div>
                    <div
                      className="flex min-w-0 max-w-full items-baseline gap-x-1.5 overflow-x-auto whitespace-nowrap text-sm [scrollbar-width:thin]"
                      aria-label={`Enabled ${enabledCount} workloads. Cost optimised: ${costOptimisedCount} workloads. Reliability improved: ${reliabilityImprovedCount} workloads.`}
                    >
                      <span className="text-muted-foreground shrink-0">Enabled</span>
                      <span className="font-mono font-semibold tabular-nums text-foreground shrink-0">
                        {enabledCount}
                      </span>
                      <span className="text-muted-foreground/50 shrink-0" aria-hidden>
                        ·
                      </span>
                      <span className="text-muted-foreground shrink-0">Cost optimised</span>
                      <span className="font-mono tabular-nums text-foreground shrink-0">{costOptimisedCount}</span>
                      <span className="text-muted-foreground/50 shrink-0" aria-hidden>
                        ·
                      </span>
                      <span className="text-muted-foreground shrink-0">Reliability improved</span>
                      <span className="font-mono tabular-nums text-foreground shrink-0">{reliabilityImprovedCount}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-muted-foreground">Disabled</span>
                      <span className="font-mono font-semibold tabular-nums text-foreground">{disabledCount}</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-muted-foreground">Non-optimizable</span>
                      <span className="font-mono font-semibold tabular-nums text-foreground">{nonOptimizableCount}</span>
                    </div>
                  </div>
                  {someSelected && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {selectedWorkloadIds.size} selected
                      </span>
                      {selectableWorkloads.length > 0 && !allSelectableSelected && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={selectAllSelectable}
                        >
                          Select all
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={clearSelection}
                      >
                        Clear selection
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={handleBatchEnable}
                        disabled={batchOverridesMutation.isPending}
                      >
                        {batchOverridesMutation.isPending ? (
                          <>Updating…</>
                        ) : (
                          <>
                            <Zap className="h-3 w-3" />
                            Enable Cruise
                          </>
                        )}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={handleBatchDisable}
                        disabled={batchOverridesMutation.isPending}
                      >
                        Disable Cruise
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div
              ref={tableScrollRef}
              className="w-full min-w-0 overflow-x-auto"
            >
              {isLoadingSummary ? (
                <LoadingState
                  title="Loading workloads"
                  description="Fetching workload recommendations and CruiseConfig status for this cluster."
                  className="min-h-[22rem] rounded-none border-0 shadow-none"
                />
              ) : (
              <table
                className="data-table data-table-compact w-full min-w-full border-collapse"
                style={{ tableLayout: "fixed", width: "100%" }}
              >
            <colgroup>
              {columnWidths.map((w, i) => (
                <col
                  key={i}
                  style={{
                    width: `${(w / columnWidthTotal) * 100}%`,
                    minWidth: MIN_COLUMN_WIDTH,
                  }}
                />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10 border-b border-border bg-surface-elevated/95 text-muted-foreground shadow-sm backdrop-blur supports-[backdrop-filter]:bg-surface-elevated/85">
              <tr>
                <th rowSpan={2} className="w-11 px-2 py-2 align-middle border-r border-border text-center leading-none">
                  <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    {selectableWorkloads.length > 0 ? (
                      <Checkbox
                        checked={allSelectableSelected ? true : someSelected ? "indeterminate" : false}
                        onCheckedChange={(checked) => {
                          if (checked === true) selectAllSelectable();
                          else clearSelection();
                        }}
                        aria-label="Select all selectable workloads"
                        className="h-4 w-4 border-muted-foreground/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground"
                      />
                    ) : (
                      <span className="w-4 h-4" aria-hidden />
                    )}
                  </div>
                </th>
                <SortableResizableHeader
                  rowSpan={2}
                  column="workload"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  resizeColumnIndex={1}
                  onResizeStart={startResize}
                  className="text-left"
                  contentClassName="justify-start"
                >
                  Workload
                </SortableResizableHeader>
                <SortableResizableHeader
                  rowSpan={2}
                  column="namespace"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  resizeColumnIndex={2}
                  onResizeStart={startResize}
                  className="text-left"
                  contentClassName="justify-start"
                >
                  Namespace
                </SortableResizableHeader>
                <SortableResizableHeader
                  rowSpan={2}
                  column="replicas"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  resizeColumnIndex={3}
                  onResizeStart={startResize}
                  className="text-center w-20"
                  contentClassName="justify-center"
                >
                  Pods
                  <InfoTooltip label="What pod count means">
                    {podsTooltipContent}
                  </InfoTooltip>
                </SortableResizableHeader>
                <th colSpan={3} className="border-t border-l border-r border-b-0 border-border bg-muted/40 font-medium align-middle text-center leading-none py-2 px-0">
                  <div className="flex items-center justify-center">
                    <span className="inline-flex items-center gap-1.5">
                      <Cpu className="h-4 w-4" />
                      CPU
                      <InfoTooltip label="How CPU columns are defined" contentClassName="max-w-sm p-4 text-left">
                        {resourceHeaderTooltipContent}
                      </InfoTooltip>
                    </span>
                  </div>
                </th>
                <th colSpan={3} className="border-t border-l border-r border-b-0 border-border bg-muted/40 font-medium align-middle text-center leading-none py-2 px-0">
                  <div className="flex items-center justify-center">
                    <span className="inline-flex items-center gap-1.5">
                      <HardDrive className="h-4 w-4" />
                      Memory
                      <InfoTooltip label="How memory columns are defined" contentClassName="max-w-sm p-4 text-left">
                        {resourceHeaderTooltipContent}
                      </InfoTooltip>
                    </span>
                  </div>
                </th>
                <SortableResizableHeader
                  rowSpan={2}
                  column="netSavings"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  resizeColumnIndex={10}
                  onResizeStart={startResize}
                  className="text-center"
                  contentClassName="justify-center"
                >
                  Net Savings/M
                  <InfoTooltip label="What net savings per month means">
                    {netSavingsTooltipContent}
                  </InfoTooltip>
                </SortableResizableHeader>
                <th colSpan={2} className="border-t border-l border-r border-b-0 border-border font-medium align-middle text-center leading-none py-2 px-0">
                  <div className="flex items-center justify-center">
                    <span className="inline-flex items-center gap-1.5">
                      Config
                      <SortIcon active={sortColumn === "cruiseConfig"} direction={sortDirection} />
                    </span>
                  </div>
                </th>
                <th rowSpan={2} className="relative w-9 min-w-9 max-w-9 p-0 align-middle border-l border-border">
                  <span className="sr-only">Row actions</span>
                  <ColumnResizeHandle columnIndex={13} onResizeStart={startResize} />
                </th>
              </tr>
              <tr>
                <SortableResizableHeader
                  column="currentCpu"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  resizeColumnIndex={4}
                  onResizeStart={startResize}
                  className="border-b border-l border-border bg-muted/30 hover:bg-muted/30 !text-right py-1.5"
                  contentClassName="w-full justify-end"
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <span className="cursor-help">Workload</span>
                      </TooltipTrigger>
                      <TooltipContent side="top">Workload (configured request)</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </SortableResizableHeader>
                <SortableResizableHeader
                  column="podCurrentAvgCpu"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  resizeColumnIndex={5}
                  onResizeStart={startResize}
                  className="border-b border-border bg-muted/30 hover:bg-muted/30 !text-right py-1.5"
                  contentClassName="w-full justify-end"
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <span className="cursor-help">Current</span>
                      </TooltipTrigger>
                      <TooltipContent side="top">Current (average per pod)</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </SortableResizableHeader>
                <SortableResizableHeader
                  column="recommendedCpu"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  resizeColumnIndex={6}
                  onResizeStart={startResize}
                  className="border-b border-r border-border bg-muted/30 hover:bg-muted/30 !text-right py-1.5"
                  contentClassName="w-full justify-end"
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <span className="cursor-help">Rec</span>
                      </TooltipTrigger>
                      <TooltipContent side="top">Recommended (average per pod)</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </SortableResizableHeader>
                <SortableResizableHeader
                  column="currentMem"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  resizeColumnIndex={7}
                  onResizeStart={startResize}
                  className="border-b border-l border-border bg-muted/30 hover:bg-muted/30 !text-right py-1.5"
                  contentClassName="w-full justify-end"
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <span className="cursor-help">Workload</span>
                      </TooltipTrigger>
                      <TooltipContent side="top">Workload (configured request)</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </SortableResizableHeader>
                <SortableResizableHeader
                  column="podCurrentAvgMem"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  resizeColumnIndex={8}
                  onResizeStart={startResize}
                  className="border-b border-border bg-muted/30 hover:bg-muted/30 !text-right py-1.5"
                  contentClassName="w-full justify-end"
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <span className="cursor-help">Current</span>
                      </TooltipTrigger>
                      <TooltipContent side="top">Current (average per pod)</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </SortableResizableHeader>
                <SortableResizableHeader
                  column="recommendedMem"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  resizeColumnIndex={9}
                  onResizeStart={startResize}
                  className="border-b border-r border-border bg-muted/30 hover:bg-muted/30 !text-right py-1.5"
                  contentClassName="w-full justify-end"
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <span className="cursor-help">Rec</span>
                      </TooltipTrigger>
                      <TooltipContent side="top">Recommended (average per pod)</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </SortableResizableHeader>
                <SortableResizableHeader
                  column="cruiseConfig"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  resizeColumnIndex={11}
                  onResizeStart={startResize}
                  className="border-b border-l border-border text-center py-1.5"
                  contentClassName="justify-center"
                >
                  Mode
                  <InfoTooltip label="How mode is defined" contentClassName="max-w-sm p-4 text-left">
                    {modeHeaderTooltipContent}
                  </InfoTooltip>
                </SortableResizableHeader>
                <SortableResizableHeader
                  column="cruiseConfig"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  resizeColumnIndex={12}
                  onResizeStart={startResize}
                  className="border-b border-r border-border text-center py-1.5"
                  contentClassName="justify-center"
                >
                  Critical
                  <InfoTooltip label="How criticality is defined" contentClassName="max-w-sm p-4 text-left">
                    {criticalityTooltipContent}
                  </InfoTooltip>
                </SortableResizableHeader>
              </tr>
            </thead>
            <tbody>
              {asArray(sortedWorkloads).map((workload, index) => (
                <tr
                  key={workload.id}
                  id={`workload-row-${index + 1}`}
                  data-tour={index === 4 ? "workload-row-5" : undefined}
                  data-state={selectedWorkloadIds.has(workload.id) ? "selected" : undefined}
                  className={cn(
                    "group border-l-2 border-l-transparent transition-colors",
                    selectedWorkloadIds.has(workload.id) && "border-l-primary bg-primary/10 hover:bg-primary/15",
                    isWorkloadDisabled(workload)
                      ? "border-l-muted-foreground/40 bg-muted/35 opacity-65 hover:bg-muted/45"
                      : !selectedWorkloadIds.has(workload.id) && (index % 2 === 1 ? "bg-surface-subtle/35 hover:bg-accent/45" : "hover:bg-accent/45"),
                  )}
                >
                  <td className="w-11 px-2 align-middle border-r border-border text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center min-h-[2rem]">
                      <Checkbox
                        checked={selectedWorkloadIds.has(workload.id)}
                        onCheckedChange={() => !isWorkloadDisabled(workload) && toggleSelection(workload.id)}
                        disabled={isWorkloadDisabled(workload)}
                        aria-label={`Select ${workload.workload}`}
                        className="h-4 w-4 border-muted-foreground/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                      />
                    </div>
                  </td>
                  <td className="min-w-0 break-words align-middle text-left">
                    <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 items-start min-w-0">
                      <span className="shrink-0 inline-flex items-center gap-1 self-start mt-0.5" onClick={(e) => e.stopPropagation()}>
                        <WorkloadTypeIcon type={workload.type} />
                        <WorkloadStatusIcons workload={workload} />
                      </span>
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className={`font-medium break-words min-w-0 ${isWorkloadDisabled(workload) ? "text-muted-foreground" : ""}`}>{workload.workload}</span>
                        {(workload.excluded || (workload.excludedCodes && workload.excludedCodes.length > 0)) && (
                          <div className="flex flex-wrap gap-1">
                            {workload.excluded && (
                              <Badge variant="secondary" className="text-xs font-normal py-0">
                                {workload.excludedReason || "Non-optimizable"}
                              </Badge>
                            )}
                            {workload.excludedCodes?.map((code) => (
                              <Badge key={code} variant="outline" className="text-xs font-normal py-0 text-muted-foreground border-muted-foreground/30">
                                {EXCLUDED_CODE_LABELS[code] ?? code}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="font-mono text-xs min-w-0 break-words align-middle text-left">{workload.namespace}</td>
                  <td className="font-mono text-sm tabular-nums text-right min-w-0 align-middle">{workload.replicas}</td>
                  <td className={`font-mono text-sm tabular-nums !text-right bg-muted/20 border-l border-b border-border min-w-0 overflow-hidden align-middle ${index === 0 ? "border-t" : ""}`}>
                    {workload.currentCpu}
                  </td>
                  <td className={`font-mono text-sm tabular-nums !text-right bg-muted/20 border-b border-border min-w-0 overflow-hidden align-middle ${index === 0 ? "border-t" : ""}`}>
                    {workload.podCurrentAvgCpu}
                  </td>
                  <td className={`font-mono text-sm tabular-nums !text-right bg-muted/20 border-r border-b border-border min-w-0 overflow-hidden align-middle ${index === 0 ? "border-t" : ""}`}>
                    {workload.recommendedCpu}
                    {workload.potentialCpu !== 0 && (
                      <span className={workload.potentialCpu > 0 ? "text-amber-500 dark:text-amber-400" : ""}>
                        <br /><span className="opacity-40">({formatCpuSigned(workload.potentialCpu)})</span>
                      </span>
                    )}
                  </td>
                  <td className={`font-mono text-sm tabular-nums !text-right bg-muted/20 border-l border-b border-border min-w-0 overflow-hidden align-middle ${index === 0 ? "border-t" : ""}`}>
                    {workload.currentMem}
                  </td>
                  <td className={`font-mono text-sm tabular-nums !text-right bg-muted/20 border-b border-border min-w-0 overflow-hidden align-middle ${index === 0 ? "border-t" : ""}`}>
                    {workload.podCurrentAvgMem}
                  </td>
                  <td className={`font-mono text-sm tabular-nums !text-right bg-muted/20 border-r border-b border-border min-w-0 overflow-hidden align-middle ${index === 0 ? "border-t" : ""}`}>
                    {workload.recommendedMem}
                    {workload.potentialMem !== 0 && (
                      <span className={workload.potentialMem > 0 ? "text-amber-500 dark:text-amber-400 opacity-100" : ""}>
                        <br /><span className="opacity-40">({formatMemorySigned(workload.potentialMem)})</span>
                      </span>
                    )}
                  </td>
                  <td className="font-mono text-sm text-right min-w-0 align-middle overflow-hidden">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex flex-col items-end gap-0.5 cursor-default min-w-0">
                            {(() => {
                              const net = workload.potentialDollars - workload.reliabilityCostDollars;
                              const hasReliability = workload.reliabilityCostDollars > 0;
                              const display = net === 0 ? "—" : (net >= 0 ? `$${net.toFixed(2)}` : `-$${Math.abs(net).toFixed(2)}`);
                              return (
                                <>
                                  <span className={moneySignedClass(net)}>{display}</span>
                                  {hasReliability && (
                                    <span className="inline-flex items-center gap-0.5 text-success text-xs font-medium" aria-label="Reliability improved" title="Reliability improved (resources recommended to be increased)">
                                      <span className="whitespace-nowrap">Reliability</span>
                                      <FontAwesomeIcon icon={faCircleArrowUp} className="h-3.5 w-3.5 shrink-0" />
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          <p>Net = Possible savings − cost of reliability increases. {workload.reliabilityCostDollars > 0 ? "Reliability Up: this workload had reliability improved (resources recommended to be increased)." : ""}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </td>
                  <td className={`min-w-0 overflow-hidden ${index === 0 ? "border-t" : ""} border-l border-b border-border align-middle`}>
                    <div className="flex justify-center min-w-0" onClick={(e) => e.stopPropagation()}>
                      {isWorkloadDisabled(workload) ? (
                        <span className="text-xs font-medium text-muted-foreground">Non-optimizable</span>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1.5 cursor-default">
                                <Switch
                                  checked={workload.mode === "enabled"}
                                  onCheckedChange={() => handleModeToggle(workload)}
                                  disabled={
                                    updateOverrideMutation.isPending &&
                                    updateOverrideMutation.variables?.workloadId === workloadIdForApi(workload.id)
                                  }
                                  className="scale-90 opacity-90 data-[state=checked]:bg-muted-foreground/80"
                                  aria-label={workload.mode === "enabled" ? "Cruise on; click to switch to Recommend" : "Recommend; click to switch to Cruise"}
                                />
                                <span className={`text-xs ${workload.mode === "enabled" ? "text-success" : "text-muted-foreground"}`}>
                                  {workload.mode === "enabled" ? "On" : "Off"}
                                </span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>When on, recommendations are auto-applied (Cruise). When off, recommend only. Click to toggle.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </td>
                  <td className={`border-r border-b border-border min-w-0 overflow-hidden ${index === 0 ? "border-t" : ""} align-middle`}>
                    <div className="flex flex-col gap-0.5 justify-center min-w-0">
                      <div className="flex items-center gap-1 flex-wrap min-w-0">
                        <span className={`text-xs font-medium ${getCriticalColor(isWorkloadDisabled(workload) ? "nonOptimizable" : workload.critical)}`}>
                          {isWorkloadDisabled(workload) ? "Non-optimizable" : formatCriticalLabel(workload.critical)}
                        </span>
                        {!isWorkloadDisabled(workload) && asArray(workload.disruptionWindows).length > 0 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-muted-foreground cursor-default border-b border-dotted border-muted-foreground/50">
                                  {workload.disruptionWindows!.length} window{workload.disruptionWindows!.length !== 1 ? "s" : ""}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-sm">
                                <div className="space-y-1">
                                  {workload.disruptionWindows!.map((w, i) => (
                                    <p key={i} className="text-xs">
                                      {humanizeWindow(w.startCron, w.endCron)}
                                    </p>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="w-9 min-w-9 max-w-9 p-0 overflow-hidden align-middle text-center border-l border-border" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                            disabled={isWorkloadDisabled(workload)}
                            aria-label={`Actions for ${workload.workload}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="min-w-[9rem] py-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenuItem
                            className="text-xs py-1.5"
                            onSelect={() => navigate(`/workloads/${workload.namespace}/${workload.workload}`)}
                          >
                            <List className="mr-2 h-3.5 w-3.5" />
                            Pod details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-xs py-1.5"
                            onSelect={() =>
                              navigate(`/events?workload=${encodeURIComponent(workloadIdForApi(workload.id))}`)
                            }
                          >
                            <Activity className="mr-2 h-3.5 w-3.5" />
                            View events
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-xs py-1.5" onSelect={() => openEditModal(workload)}>
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Edit CruiseConfig
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
              )}
        </div>
      </Panel>

      {!isLoadingSummary && sortedWorkloads.length === 0 && (
        <EmptyState
          title="No workloads match your filters"
          description="Adjust the search query or clear filters to show more workloads."
          className="min-h-[12rem]"
        />
      )}

        {/* Edit CruiseConfig modal */}
        <Dialog open={!!editWorkload} onOpenChange={(open) => !open && setEditWorkload(null)}>
          <DialogContent className="sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Edit CruiseConfig</DialogTitle>
              <DialogDescription>
                {editWorkload && (
                  <>Update critical, mode, and disruption windows for <span className="font-medium text-foreground">{editWorkload.workload}</span> in <span className="font-mono text-foreground">{editWorkload.namespace}</span>.</>
                )}
              </DialogDescription>
            </DialogHeader>
            {editWorkload && (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">CruiseOn</label>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={editMode === "enabled"}
                      onCheckedChange={(checked) => setEditMode(checked ? "enabled" : "recommend-only")}
                      disabled={updateOverrideMutation.isPending}
                      aria-label="CruiseOn"
                    />
                    <span className="text-sm text-muted-foreground">
                      {editMode === "enabled"
                        ? "Recommendations will be applied to pods."
                        : "Recommendations are only computed — never applied."}
                    </span>
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Critical</label>
                  <Select value={editCritical} onValueChange={(v) => setEditCritical(v as typeof editCritical)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="very-high">Very High</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    During node consolidation, the controller may need to evict pods to free capacity. Higher critical workloads are evicted last; low critical first. Use <strong>very-high</strong> for workloads that must never be evicted (e.g. critical system pods). Use <strong>High</strong> for important apps and <strong>Low</strong> for best-effort or batch workloads.
                  </p>
                </div>
                {editWorkload.blockingConsolidation && (
                  <Alert variant="warning">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Disruption window recommended</AlertTitle>
                    <AlertDescription>
                      This workload will block node consolidation because of{" "}
                      {[editWorkload.blockingConsolidationPdb && "Pod Disruption Budget (PDB)", editWorkload.blockingConsolidationDoNotDisrupt && "do-not-disrupt annotation"]
                        .filter(Boolean)
                        .join(" and ")}
                      . Set up a disruption window below so that during the window, pod disruption budgets and do-not-disrupt annotations are temporarily removed from this workload, allowing nodes to consolidate. Constraints are applied back automatically just before the disruption window ends.
                    </AlertDescription>
                  </Alert>
                )}
                <DisruptionWindowEditor
                  windows={editDisruptionWindows}
                  onChange={setEditDisruptionWindows}
                  disabled={updateOverrideMutation.isPending}
                  allowAdd={editWorkload.blockingConsolidation}
                />
                {!editWorkload.blockingConsolidation && (
                  <Alert variant="neutral">
                    <Info className="h-4 w-4" />
                    <AlertTitle>No disruption window needed</AlertTitle>
                    <AlertDescription>
                      This workload doesn&apos;t have pod-disruption-budgets or do-not-disrupt marked. No disruption window needs to be provided in this case since it will not block node consolidation.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditWorkload(null)}>Cancel</Button>
              <Button onClick={handleSaveCruiseConfig} disabled={updateOverrideMutation.isPending}>
                {updateOverrideMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </PageShell>
  );
}
