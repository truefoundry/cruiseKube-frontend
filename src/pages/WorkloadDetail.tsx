import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  ArrowLeft, 
  ChevronRight, 
  ChevronDown,
  Cpu, 
  HardDrive,
  Tag,
  User,
  FileCode,
  Clock,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { containers, workloads, podRecommendations, recommendationHistory } from "@/lib/mock-data";

export default function WorkloadDetail() {
  const { namespace, workloadName } = useParams();
  const [expandedContainers, setExpandedContainers] = useState<string[]>([]);
  const [selectedPods, setSelectedPods] = useState<string[]>([]);
  
  const workload = workloads.find(
    (w) => w.namespace === namespace && w.workload === workloadName
  );

  const getWasteStatus = (percent: number) => {
    if (percent >= 50) return "destructive";
    if (percent >= 30) return "warning";
    return "success";
  };

  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case "applied": return "success";
      case "ignored": return "destructive";
      case "snoozed": return "warning";
      default: return "default";
    }
  };

  const toggleContainer = (name: string) => {
    setExpandedContainers(prev => 
      prev.includes(name) 
        ? prev.filter(c => c !== name)
        : [...prev, name]
    );
  };

  const togglePodSelection = (pod: string) => {
    setSelectedPods(prev =>
      prev.includes(pod)
        ? prev.filter(p => p !== pod)
        : [...prev, pod]
    );
  };

  if (!workload) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Workload not found</p>
        <Link to="/recommendations">
          <Button variant="link" className="mt-2">Back to recommendations</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/recommendations" className="hover:text-foreground transition-colors">
          Recommendations
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-mono">{namespace}</span>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{workloadName}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link to="/recommendations">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{workloadName}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className="font-mono text-sm text-muted-foreground">{namespace}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">{workload.type}</span>
              <span className="text-muted-foreground">•</span>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <User className="h-3 w-3" />
                platform-team
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <div className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                <Tag className="h-3 w-3" />
                app=api-gateway
              </div>
              <div className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                <Tag className="h-3 w-3" />
                env=production
              </div>
            </div>
          </div>
        </div>

        {/* Controls - Mode & Priority */}
        <div className="flex flex-wrap items-center gap-3 lg:shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Mode:</span>
            <Select defaultValue={workload.mode}>
              <SelectTrigger className="w-[160px] bg-muted/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enabled">Enabled</SelectItem>
                <SelectItem value="recommend-only">Recommend Only</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Priority:</span>
            <Select defaultValue={workload.priority}>
              <SelectTrigger className="w-[160px] bg-muted/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="non-evictable">Non-evictable</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Savings Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Cpu className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">CPU Savings Potential</p>
              <p className="font-mono text-xl font-semibold text-foreground">{workload.potentialCpu}</p>
            </div>
          </div>
        </div>
        <div className="metric-card">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <HardDrive className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Memory Savings Potential</p>
              <p className="font-mono text-xl font-semibold text-foreground">{workload.potentialMem}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Containers & Pods Accordion */}
      <div className="metric-card overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Containers & Pods
          </h3>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={selectedPods.length === 0}>
              <FileCode className="h-4 w-4 mr-2" />
              Generate Patch ({selectedPods.length})
            </Button>
            <Button variant="outline" size="sm" disabled={selectedPods.length === 0}>
              Snooze
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {containers.map((container) => (
            <Collapsible 
              key={container.name}
              open={expandedContainers.includes(container.name)}
              onOpenChange={() => toggleContainer(container.name)}
            >
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-4">
                    {expandedContainers.includes(container.name) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">{container.name}</span>
                    <StatusBadge status={getWasteStatus(container.wastePercent)}>
                      {container.wastePercent}% waste
                    </StatusBadge>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span className="text-muted-foreground">CPU: </span>
                      <span className="font-mono text-primary">{container.cpuRecommended}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Memory: </span>
                      <span className="font-mono text-primary">{container.memRecommended}</span>
                    </div>
                  </div>
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="mt-2 ml-8 p-4 rounded-lg bg-background border border-border">
                  <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
                    Per-Pod Recommendations
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th className="w-8">
                            <input 
                              type="checkbox" 
                              className="rounded"
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPods(podRecommendations.map(p => p.pod));
                                } else {
                                  setSelectedPods([]);
                                }
                              }}
                            />
                          </th>
                          <th>Pod</th>
                          <th>CPU Request</th>
                          <th>CPU Rec.</th>
                          <th>Memory Request</th>
                          <th>Memory Rec.</th>
                          <th>Usage (p99/p50)</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {podRecommendations.map((pod) => (
                          <tr key={pod.pod}>
                            <td>
                              <input 
                                type="checkbox"
                                className="rounded"
                                checked={selectedPods.includes(pod.pod)}
                                onChange={() => togglePodSelection(pod.pod)}
                              />
                            </td>
                            <td className="font-mono text-xs">{pod.pod}</td>
                            <td className="font-mono text-sm">{pod.cpuRequest}</td>
                            <td className="font-mono text-sm text-primary">{pod.cpuRecRequest}</td>
                            <td className="font-mono text-sm">{pod.memRequest}</td>
                            <td className="font-mono text-sm text-primary">{pod.memRecRequest}</td>
                            <td className="text-xs text-muted-foreground">
                              {pod.usageP99} / {pod.usageP50}
                            </td>
                            <td>
                              <Button variant="ghost" size="sm" className="h-7 px-2">
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </div>

      {/* History */}
      <div className="metric-card overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recommendation History
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Old Values</th>
                <th>New Values</th>
                <th>Decision</th>
                <th>Actor</th>
              </tr>
            </thead>
            <tbody>
              {recommendationHistory.map((entry, idx) => (
                <tr key={idx}>
                  <td className="font-mono text-xs text-muted-foreground">{entry.timestamp}</td>
                  <td className="font-mono text-xs">
                    CPU: {entry.oldCpu} / Mem: {entry.oldMem}
                  </td>
                  <td className="font-mono text-xs text-primary">
                    CPU: {entry.newCpu} / Mem: {entry.newMem}
                  </td>
                  <td>
                    <StatusBadge status={getDecisionBadge(entry.decision)}>
                      {entry.decision}
                    </StatusBadge>
                  </td>
                  <td className="text-xs text-muted-foreground">{entry.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}