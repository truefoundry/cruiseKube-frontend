import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Download,
  GitBranch,
  Loader2,
  Plug,
  RefreshCw,
  Server,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type {
  PreflightResponse,
  PreflightStep,
  PreflightMetricGroup,
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
import { downloadPreflightReport } from "@/lib/preflight-report";
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

/** Renders a Prometheus target as `host:port`, falling back to url, then a dash. */
function connectivityTarget(
  conn: PreflightResponse["prometheus_connectivity"]
): string | null {
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

function FailureRow({ item, message }: { item: string; message: string }) {
  return (
    <li className="flex items-start gap-3 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2.5">
      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="min-w-0 space-y-0.5">
        <p className="font-mono text-xs font-semibold text-foreground">{item}</p>
        <p className="break-words text-sm text-muted-foreground">{message}</p>
      </div>
    </li>
  );
}

function FailureSection({
  step,
  count,
  children,
}: {
  step: PreflightStep;
  count: number;
  children: ReactNode;
}) {
  const { label, icon: Icon } = STEP_META[step];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-destructive/10 p-1.5 text-destructive">
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        <Badge variant="destructive" className="ml-1">
          {count} {count === 1 ? "issue" : "issues"}
        </Badge>
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
        <code className="ml-auto hidden truncate font-mono text-[11px] text-muted-foreground sm:inline">
          {group.job_matcher}
        </code>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
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
              <div
                key={check.metric}
                className="flex items-center gap-2 px-2 py-1 text-xs"
              >
                <CheckIcon ok={check.present} />
                <code className="font-mono text-foreground">{check.metric}</code>
                {!check.required && (
                  <span className="text-[10px] text-muted-foreground">(optional)</span>
                )}
                <span className="ml-auto font-mono text-muted-foreground">
                  {check.present ? `${check.series} series` : "no series"}
                </span>
                {check.error ? (
                  <span className="max-w-[16rem] truncate text-destructive" title={check.error}>
                    {check.error}
                  </span>
                ) : null}
              </div>
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * The report contents (node versions + metric groups, then the flat failures
 * list) without any page chrome. Shared by the full-page gate view and the
 * Settings tab. Renders nothing extra when the cluster is healthy with no
 * detail to show.
 */
export function PreflightReportBody({ data }: { data: PreflightResponse }) {
  const failures = data.failures ?? [];
  const failuresByStep = STEP_ORDER.map((step) => ({
    step,
    items: failures.filter((f) => f.step === step),
  })).filter((g) => g.items.length > 0);

  const nodes = data.versions?.nodes ?? [];
  const groups = data.metrics?.groups ?? [];
  const showNodeTable = nodes.length > 0;
  const showMetricGroups = groups.length > 0;

  return (
    <>
      {/* Detail: node versions + metric groups (top). */}
      {(showNodeTable || showMetricGroups) && (
        <section className="grid gap-6 lg:grid-cols-2">
          {showNodeTable && (
            <Panel padding="none" className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3">
                <Server className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Nodes</h3>
                <span className="text-xs text-muted-foreground">
                  min kube {data.versions.min_kube_version}
                </span>
              </div>
              {data.versions.node_error ? (
                <p className="px-5 py-4 text-sm text-destructive">
                  {data.versions.node_error}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Node</TableHead>
                      <TableHead>Kubelet</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nodes.map((node) => (
                      <TableRow key={node.name}>
                        <TableCell className="font-mono text-xs">{node.name}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {node.kubelet_version}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex justify-end">
                            <CheckIcon ok={node.meets_minimum} />
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Panel>
          )}

          {showMetricGroups && (
            <Panel padding="none" className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Metric groups</h3>
                <span className="text-xs text-muted-foreground">
                  lookback {data.metrics.lookback}
                </span>
              </div>
              <div className="p-2">
                {groups.map((group) => (
                  <MetricGroupRow key={group.name} group={group} />
                ))}
              </div>
            </Panel>
          )}
        </section>
      )}

      {/* Issues to fix: flat failures grouped by step (bottom). */}
      {failuresByStep.length > 0 ? (
        <section className="space-y-6">
          {failuresByStep.map(({ step, items }) => (
            <FailureSection key={step} step={step} count={items.length}>
              <ul className="space-y-2">
                {items.map((f, i) => (
                  <FailureRow key={`${f.item}-${i}`} item={f.item} message={f.message} />
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

  return (
    <PageShell className="animate-fade-in gap-6">
      <PageHeader
        icon={<AlertTriangle className="h-5 w-5" />}
        title="Setup incomplete"
        description={
          <>
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
            <Button
              variant="outline"
              onClick={() => downloadPreflightReport(data)}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download report
            </Button>
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
