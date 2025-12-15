import { useState } from "react";
import { 
  Search, 
  Filter, 
  ChevronRight,
  Layers,
  Clock
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { workloads } from "@/lib/mock-data";

export default function Workloads() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [namespaceFilter, setNamespaceFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [hasRecommendations, setHasRecommendations] = useState("all");

  const filteredWorkloads = workloads.filter((w) => {
    const matchesSearch = 
      w.workload.toLowerCase().includes(search.toLowerCase()) ||
      w.namespace.toLowerCase().includes(search.toLowerCase());
    const matchesNamespace = namespaceFilter === "all" || w.namespace === namespaceFilter;
    const matchesMode = modeFilter === "all" || w.mode === modeFilter;
    const matchesPriority = priorityFilter === "all" || w.priority === priorityFilter;
    const matchesRecommendations = hasRecommendations === "all" || 
      (hasRecommendations === "yes" && w.hasRecommendations) ||
      (hasRecommendations === "no" && !w.hasRecommendations);
    return matchesSearch && matchesNamespace && matchesMode && matchesPriority && matchesRecommendations;
  });

  const namespaces = [...new Set(workloads.map((w) => w.namespace))];

  const getWasteStatus = (percent: number) => {
    if (percent >= 50) return "destructive";
    if (percent >= 30) return "warning";
    return "success";
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "text-destructive";
      case "medium": return "text-warning";
      case "low": return "text-muted-foreground";
      case "non-evictable": return "text-primary";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Workloads & Recommendations</h1>
          <p className="text-sm text-muted-foreground">Container-aware workload list with optimization recommendations</p>
        </div>
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{workloads.length} workloads</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workloads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted/50 border-border"
          />
        </div>

        <Select value={namespaceFilter} onValueChange={setNamespaceFilter}>
          <SelectTrigger className="w-[160px] bg-muted/50 border-border">
            <SelectValue placeholder="Namespace" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Namespaces</SelectItem>
            {namespaces.map((ns) => (
              <SelectItem key={ns} value={ns}>{ns}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={hasRecommendations} onValueChange={setHasRecommendations}>
          <SelectTrigger className="w-[180px] bg-muted/50 border-border">
            <SelectValue placeholder="Has Recommendations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="yes">Has Recommendations</SelectItem>
            <SelectItem value="no">No Recommendations</SelectItem>
          </SelectContent>
        </Select>

        <Select value={modeFilter} onValueChange={setModeFilter}>
          <SelectTrigger className="w-[160px] bg-muted/50 border-border">
            <SelectValue placeholder="Mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modes</SelectItem>
            <SelectItem value="enabled">Enabled</SelectItem>
            <SelectItem value="recommend-only">Recommend Only</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[160px] bg-muted/50 border-border">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="non-evictable">Non-evictable</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="icon" className="shrink-0">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      <div className="metric-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Namespace</th>
                <th>Workload</th>
                <th>Type</th>
                <th>Waste</th>
                <th>CPU Savings/hr</th>
                <th>Memory Savings/hr</th>
                <th>$/hr</th>
                <th>Updated</th>
                <th>Mode</th>
                <th>Priority</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkloads.map((workload) => (
                <tr 
                  key={workload.id} 
                  className="group cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate(`/workloads/${workload.namespace}/${workload.workload}`);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/workloads/${workload.namespace}/${workload.workload}`);
                    }
                  }}
                >
                  <td className="font-mono text-xs">{workload.namespace}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{workload.workload}</span>
                      {workload.hasRecommendations && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                      )}
                    </div>
                  </td>
                  <td className="text-muted-foreground text-xs">{workload.type}</td>
                  <td>
                    <StatusBadge status={getWasteStatus(workload.wastePercent)}>
                      {workload.wastePercent}%
                    </StatusBadge>
                  </td>
                  <td className="font-mono text-sm">{workload.potentialCpu}</td>
                  <td className="font-mono text-sm">{workload.potentialMem}</td>
                  <td className="font-mono text-sm text-primary">${workload.potentialDollars}</td>
                  <td className="text-muted-foreground text-xs">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {workload.lastUpdated}
                    </div>
                  </td>
                  <td>
                    <span className={`text-xs font-medium ${
                      workload.mode === "enabled" ? "text-success" : "text-muted-foreground"
                    }`}>
                      {workload.mode === "enabled" ? "Enabled" : "Recommend"}
                    </span>
                  </td>
                  <td>
                    <span className={`text-xs font-medium capitalize ${getPriorityColor(workload.priority)}`}>
                      {workload.priority}
                    </span>
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

      {filteredWorkloads.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No workloads match your filters
        </div>
      )}
    </div>
  );
}