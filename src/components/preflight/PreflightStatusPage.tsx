import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  GitBranch,
  Loader2,
  MinusCircle,
  Plug,
  RefreshCw,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type {
  PreflightResponse,
  PreflightStep,
  PreflightMetricGroup,
  PreflightPrometheusConnectivity,
  PreflightVersions,
} from "@/lib/api";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DownloadReportButton } from "@/components/preflight/DownloadReportButton";
import { cn } from "@/lib/utils";

/** Ordered step metadata for grouping the flat `failures[]` list. */
const STEP_META: Record<PreflightStep, { label: string; icon: LucideIcon }> = {
  prometheus_connectivity: { label: "Prometheus connectivity", icon: Plug },
  versions: { label: "Versions", icon: GitBranch },
  metrics: { label: "Metrics", icon: BarChart3 },
};

const STEP_ORDER: PreflightStep[] = [
  "prometheus_connectivity",
  "versions",
  "metrics",
];

/** Stable group identifiers → friendly labels. Unknown names fall through as-is. */
const METRIC_GROUP_LABELS: Record<string, string> = {
  "kube-state-metrics": "Kube State Metrics",
  "cadvisor-kubelet": "cAdvisor / Kubelet",
  "node-exporter": "Node Exporter",
  psi: "Pressure Stall Information (PSI)",
  karpenter: "Karpenter",
};

function metricGroupLabel(name: string): string {
  return METRIC_GROUP_LABELS[name] ?? name;
}

/**
 * The Prometheus endpoint that was checked: the explicit `target`, else
 * `host:port`, else `url`, else null.
 */
function connectivityTarget(
  conn: PreflightResponse["prometheus_connectivity"]
): string | null {
  if (conn.target) return conn.target;
  if (conn.host) return conn.port ? `${conn.host}:${conn.port}` : conn.host;
  if (conn.url) return conn.url;
  return null;
}

function CheckIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label="present" />
  ) : (
    <XCircle className="h-4 w-4 shrink-0 text-destructive" aria-label="missing" />
  );
}

/**
 * Per-metric status icon. Present → success. Absent + required → error. Absent +
 * optional → neutral "not present" (legitimately zero-series on healthy clusters).
 */
function MetricCheckIcon({ present, required }: { present: boolean; required: boolean }) {
  if (present) {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label="present" />;
  }
  if (required) {
    return <XCircle className="h-4 w-4 shrink-0 text-destructive" aria-label="missing" />;
  }
  return <MinusCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="not present" />;
}

function FailureRow({
  item,
  message,
  optional = false,
}: {
  item: string;
  message: string;
  optional?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-md border px-3 py-2.5",
        optional ? "border-border bg-muted/30" : "border-destructive/20 bg-destructive/5"
      )}
    >
      {optional ? (
        <MinusCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      )}
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <p className="font-mono text-xs font-semibold text-foreground">{item}</p>
          {optional ? (
            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
              optional · non-blocking
            </Badge>
          ) : null}
        </div>
        <p className="break-words text-sm text-muted-foreground">{message}</p>
      </div>
    </li>
  );
}

function FailureSection({
  step,
  blockingCount,
  optionalCount,
  children,
}: {
  step: PreflightStep;
  blockingCount: number;
  optionalCount: number;
  children: ReactNode;
}) {
  const { label, icon: Icon } = STEP_META[step];
  const blocking = blockingCount > 0;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "rounded-lg p-1.5",
            blocking ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        {blocking ? (
          <Badge variant="destructive" className="ml-1">
            {blockingCount} {blockingCount === 1 ? "issue" : "issues"}
          </Badge>
        ) : null}
        {optionalCount > 0 ? (
          <Badge variant="outline" className="text-muted-foreground">
            {optionalCount} optional
          </Badge>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function MetricGroupRow({ group }: { group: PreflightMetricGroup }) {
  const [open, setOpen] = useState(!group.present);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted/40">
        <CheckIcon ok={group.present} />
        <span className="text-sm font-medium text-foreground">
          {metricGroupLabel(group.name)}
        </span>
        {!group.required && (
          <Badge variant="outline" className="text-[10px]">
            optional
          </Badge>
        )}
        {group.job_matcher ? (
          <code className="ml-auto hidden truncate font-mono text-[11px] text-muted-foreground sm:inline">
            {group.job_matcher}
          </code>
        ) : null}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            !group.job_matcher && "ml-auto",
            open && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-1 border-l border-border/60 pb-2 pl-4 pt-1">
          {group.checks.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              No individual metric checks reported.
            </p>
          ) : (
            group.checks.map((check) => (
              <div key={check.metric} className="px-2 py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <MetricCheckIcon present={check.present} required={check.required} />
                  <code className="font-mono text-foreground">{check.metric}</code>
                  {!check.required && (
                    <span className="text-[10px] text-muted-foreground">(optional)</span>
                  )}
                  <span className="ml-auto shrink-0 font-mono text-muted-foreground">
                    {check.present
                      ? `${check.series} series`
                      : check.required
                        ? "no series"
                        : "not present"}
                  </span>
                  {check.error ? (
                    <span
                      className="max-w-[12rem] shrink-0 truncate text-destructive"
                      title={check.error}
                    >
                      {check.error}
                    </span>
                  ) : null}
                </div>
                {check.present && check.labels && check.labels.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1 pl-6">
                    {check.labels.map((label) => (
                      <span
                        key={label}
                        className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function VersionRow({
  label,
  sub,
  version,
  meets,
  error,
}: {
  label: string;
  sub?: string;
  version?: string;
  meets: boolean;
  error?: string;
}) {
  return (
    <>
      <TableRow className={error ? "border-b-0" : undefined}>
        <TableCell className="text-xs">
          <span className="font-mono text-foreground">{label}</span>
          {sub ? <span className="ml-1.5 text-muted-foreground">{sub}</span> : null}
        </TableCell>
        <TableCell className="font-mono text-xs">{version || "—"}</TableCell>
        <TableCell className="text-right">
          <span className="inline-flex justify-end">
            <CheckIcon ok={meets} />
          </span>
        </TableCell>
      </TableRow>
      {error ? (
        <TableRow>
          <TableCell colSpan={3} className="pt-0 text-xs text-destructive">
            {error}
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function DetailRow({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-all text-right font-mono text-foreground">
        {value === undefined || value === null || value === "" ? "—" : value}
      </span>
    </div>
  );
}

/** Connectivity detail: connection state, target, probe, version/revision, and error. */
function ConnectivityPanel({ conn }: { conn: PreflightPrometheusConnectivity }) {
  const target = connectivityTarget(conn);
  return (
    <Panel padding="none" className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3">
        <Plug className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Prometheus connectivity</h3>
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
            conn.connected
              ? "border-success/25 bg-success/10 text-success"
              : "border-destructive/25 bg-destructive/10 text-destructive"
          )}
        >
          {conn.connected ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          {conn.connected ? "Connected" : "Disconnected"}
        </span>
      </div>
      <div className="divide-y divide-border/40 px-5 py-2">
        <DetailRow label="Target" value={target ?? undefined} />
        <DetailRow label="URL" value={conn.url} />
        <DetailRow label="Host" value={conn.host} />
        <DetailRow label="Port" value={conn.port} />
        <DetailRow label="Probe" value={conn.probe} />
        <DetailRow label="Version" value={conn.version} />
        <DetailRow label="Revision" value={conn.revision} />
      </div>
      {conn.error ? (
        <p className="border-t border-destructive/20 bg-destructive/5 px-5 py-2.5 text-xs text-destructive">
          {conn.error}
        </p>
      ) : null}
    </Panel>
  );
}

/** Versions detail: Kubernetes server, per-node kubelet, and Prometheus rows. */
function VersionsPanel({ versions }: { versions: PreflightVersions }) {
  const nodes = versions.nodes ?? [];
  return (
    <Panel padding="none" className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3">
        <GitBranch className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Versions</h3>
        <span className="ml-auto truncate text-[11px] text-muted-foreground">
          min: k8s {versions.min_kubernetes_version} · kubelet {versions.min_kube_version} ·
          prom {versions.min_prometheus_version}
        </span>
      </div>
      <div className="max-h-72 overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-surface">
            <TableRow>
              <TableHead>Component</TableHead>
              <TableHead>Version</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <VersionRow
              label="Prometheus"
              version={versions.prometheus?.version}
              meets={versions.prometheus?.meets_minimum ?? false}
              error={versions.prometheus?.error}
            />
            <VersionRow
              label="Kubernetes"
              sub="server"
              version={versions.kubernetes?.version}
              meets={versions.kubernetes?.meets_minimum ?? false}
              error={versions.kubernetes?.error}
            />
            {versions.node_error ? (
              <TableRow>
                <TableCell colSpan={3} className="text-xs text-destructive">
                  {versions.node_error}
                </TableCell>
              </TableRow>
            ) : (
              nodes.map((node) => (
                <VersionRow
                  key={node.name}
                  label={node.name}
                  sub="kubelet"
                  version={node.kubelet_version}
                  meets={node.meets_minimum}
                  error={node.error}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}

/**
 * The report contents (versions + metric groups, then the flat failures list)
 * without any page chrome. Shared by the full-page gate view and the Settings
 * tab. Renders nothing extra when the cluster is healthy with no detail to show.
 */
export function PreflightReportBody({ data }: { data: PreflightResponse }) {
  const groups = data.metrics?.groups ?? [];

  // Metric names the backend marks as optional (required:false). Their absence
  // is non-blocking, but the backend still lists them in `failures[]` — so we
  // flag them here rather than showing them as hard errors.
  const optionalMetrics = new Set<string>();
  for (const g of groups) {
    for (const c of g.checks ?? []) {
      if (!c.required) optionalMetrics.add(c.metric);
    }
  }
  const isOptional = (f: PreflightResponse["failures"][number]) =>
    f.step === "metrics" && optionalMetrics.has(f.item);

  const failures = data.failures ?? [];
  const failuresByStep = STEP_ORDER.map((step) => {
    const items = failures.filter((f) => f.step === step);
    return {
      step,
      items,
      blockingCount: items.filter((f) => !isOptional(f)).length,
      optionalCount: items.filter((f) => isOptional(f)).length,
    };
  }).filter((g) => g.items.length > 0);

  const showConnectivity = !!data.prometheus_connectivity;
  const showVersions = !!data.versions;

  return (
    <>
      {/* Detail: versions, then Prometheus, then metrics — one wrapping row, equal height. */}
      {(showVersions || showConnectivity || data.metrics) && (
        <section className="flex flex-wrap gap-3">
          {showVersions && (
            <div className="min-w-[320px] flex-1 [&>section]:h-full">
              <VersionsPanel versions={data.versions} />
            </div>
          )}
          {showConnectivity && (
            <div className="min-w-[320px] flex-1 [&>section]:h-full">
              <ConnectivityPanel conn={data.prometheus_connectivity} />
            </div>
          )}
          {data.metrics && (
            <div className="min-w-[320px] flex-1 [&>section]:h-full">
              <Panel padding="none" className="overflow-hidden">
                <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Metric groups</h3>
                  <span className="text-xs text-muted-foreground">
                    lookback {data.metrics.lookback}
                  </span>
                </div>
                {groups.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-muted-foreground">
                    No metric groups reported.
                  </p>
                ) : (
                  <div className="p-2">
                    {groups.map((group) => (
                      <MetricGroupRow key={group.name} group={group} />
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          )}
        </section>
      )}

      {/* Issues to fix: flat failures grouped by step (bottom). */}
      {failuresByStep.length > 0 ? (
        <section className="space-y-6">
          {failuresByStep.map(({ step, items, blockingCount, optionalCount }) => (
            <FailureSection
              key={step}
              step={step}
              blockingCount={blockingCount}
              optionalCount={optionalCount}
            >
              <ul className="space-y-2">
                {items.map((f, i) => (
                  <FailureRow
                    key={`${f.item}-${i}`}
                    item={f.item}
                    message={f.message}
                    optional={isOptional(f)}
                  />
                ))}
              </ul>
            </FailureSection>
          ))}
        </section>
      ) : !data.healthy ? (
        <Panel className="text-sm text-muted-foreground">
          No specific failures were reported, but the cluster is not yet healthy.
          Try re-running the checks.
        </Panel>
      ) : null}
    </>
  );
}

export interface PreflightStatusPageProps {
  data: PreflightResponse;
  onRetry: () => void;
  isRetrying: boolean;
}

/** The "setup incomplete" page shown when preflight returns `healthy: false`. */
export function PreflightStatusPage({ data, onRetry, isRetrying }: PreflightStatusPageProps) {
  const { summary } = data;
  const conn = data.prometheus_connectivity;
  const target = connectivityTarget(conn);
  const ckVersion = data.versions?.cruisekube_version;

  return (
    <PageShell className="animate-fade-in gap-6">
      <PageHeader
        icon={<AlertTriangle className="h-5 w-5" />}
        title="Setup incomplete"
        description={
          <>
            {ckVersion ? (
              <>
                CruiseKube{" "}
                <code className="font-mono text-foreground">{ckVersion}</code>
                {" · "}
              </>
            ) : null}
            {summary.failed} of {summary.total_checks} checks failed
            {!conn.healthy && target ? (
              <>
                {" · "}can&apos;t reach Prometheus at{" "}
                <code className="break-all font-mono text-foreground">{target}</code>
              </>
            ) : null}
          </>
        }
        actions={
          <>
            <DownloadReportButton data={data} />
            <Button onClick={onRetry} disabled={isRetrying} className="gap-2">
              {isRetrying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {isRetrying ? "Re-running…" : "Re-run checks"}
            </Button>
          </>
        }
      />
      <PreflightReportBody data={data} />
    </PageShell>
  );
}
