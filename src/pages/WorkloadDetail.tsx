import { useParams, Link, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  ChevronRight, 
  Cpu, 
  HardDrive,
  Tag,
  User,
  Settings
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
import { containers, workloads } from "@/lib/mock-data";

export default function WorkloadDetail() {
  const { namespace, workloadName } = useParams();
  const navigate = useNavigate();
  
  const workload = workloads.find(
    (w) => w.namespace === namespace && w.workload === workloadName
  );

  const getWasteStatus = (percent: number) => {
    if (percent >= 50) return "destructive";
    if (percent >= 30) return "warning";
    return "success";
  };

  if (!workload) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Workload not found</p>
        <Link to="/workloads">
          <Button variant="link" className="mt-2">Back to workloads</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/workloads" className="hover:text-foreground transition-colors">
          Workloads
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-mono">{namespace}</span>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{workloadName}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link to="/workloads">
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

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 lg:shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Mode:</span>
            <Select defaultValue={workload.mode}>
              <SelectTrigger className="w-[140px] bg-muted/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enabled">Enabled</SelectItem>
                <SelectItem value="recommend-only">Recommend Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Priority:</span>
            <Select defaultValue={workload.priority}>
              <SelectTrigger className="w-[140px] bg-muted/50">
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
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
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

      {/* Containers Table */}
      <div className="metric-card overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Containers
          </h3>
          <span className="text-xs text-muted-foreground">{containers.length} containers</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Container</th>
                <th>CPU Request</th>
                <th>CPU Recommended</th>
                <th>Memory Request</th>
                <th>Memory Recommended</th>
                <th>Waste</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {containers.map((container) => (
                <tr 
                  key={container.name} 
                  className="group cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate(`/workloads/${namespace}/${workloadName}/${container.name}`);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/workloads/${namespace}/${workloadName}/${container.name}`);
                    }
                  }}
                >
                  <td className="font-medium">{container.name}</td>
                  <td className="font-mono text-sm">{container.cpuCurrent}</td>
                  <td className="font-mono text-sm text-primary">{container.cpuRecommended}</td>
                  <td className="font-mono text-sm">{container.memCurrent}</td>
                  <td className="font-mono text-sm text-primary">{container.memRecommended}</td>
                  <td>
                    <StatusBadge status={getWasteStatus(container.wastePercent)}>
                      {container.wastePercent}%
                    </StatusBadge>
                  </td>
                  <td>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
