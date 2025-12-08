import { useState } from "react";
import { 
  Search, 
  Filter, 
  CheckCircle,
  XCircle,
  AlertCircle,
  PauseCircle,
  ArrowUpRight
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { auditEvents } from "@/lib/mock-data";
import { Link } from "react-router-dom";

export default function Audit() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const filteredEvents = auditEvents.filter((e) => {
    const matchesSearch = 
      e.workload.toLowerCase().includes(search.toLowerCase()) ||
      e.container.toLowerCase().includes(search.toLowerCase()) ||
      e.pod.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || e.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const getEventIcon = (type: string) => {
    switch (type) {
      case "applied": return <CheckCircle className="h-4 w-4 text-success" />;
      case "recommendation": return <AlertCircle className="h-4 w-4 text-primary" />;
      case "ignored": return <XCircle className="h-4 w-4 text-destructive" />;
      case "snoozed": return <PauseCircle className="h-4 w-4 text-warning" />;
      case "evicted": return <ArrowUpRight className="h-4 w-4 text-warning" />;
      default: return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getEventStyle = (type: string) => {
    switch (type) {
      case "applied": return "bg-success/10 text-success";
      case "recommendation": return "bg-primary/10 text-primary";
      case "ignored": return "bg-destructive/10 text-destructive";
      case "snoozed": return "bg-warning/10 text-warning";
      case "evicted": return "bg-warning/10 text-warning";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Audit & Events</h1>
        <p className="text-sm text-muted-foreground">Track all optimization events and decisions</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workloads, containers, pods..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-muted/50 border-border"
          />
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px] bg-muted/50 border-border">
            <SelectValue placeholder="Event Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="recommendation">Recommendation</SelectItem>
            <SelectItem value="applied">Applied</SelectItem>
            <SelectItem value="ignored">Ignored</SelectItem>
            <SelectItem value="snoozed">Snoozed</SelectItem>
            <SelectItem value="evicted">Evicted</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="all">
          <SelectTrigger className="w-[160px] bg-muted/50 border-border">
            <SelectValue placeholder="Namespace" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Namespaces</SelectItem>
            <SelectItem value="production">production</SelectItem>
            <SelectItem value="staging">staging</SelectItem>
            <SelectItem value="development">development</SelectItem>
          </SelectContent>
        </Select>

        <Select defaultValue="24h">
          <SelectTrigger className="w-[140px] bg-muted/50 border-border">
            <SelectValue placeholder="Time Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">Last hour</SelectItem>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="icon" className="shrink-0">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Events Table */}
      <div className="metric-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Event</th>
                <th>Workload</th>
                <th>Container</th>
                <th>Delta</th>
                <th>Pod</th>
                <th>Node</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event, i) => (
                <tr key={i} className="group">
                  <td className="font-mono text-xs text-muted-foreground">{event.timestamp}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      {getEventIcon(event.type)}
                      <span className={`text-xs font-medium capitalize px-2 py-0.5 rounded-full ${getEventStyle(event.type)}`}>
                        {event.type}
                      </span>
                    </div>
                  </td>
                  <td className="font-medium">{event.workload}</td>
                  <td className="text-sm text-muted-foreground">{event.container}</td>
                  <td className="font-mono text-xs">
                    <span className="text-primary">{event.deltaCpu}</span>
                    <span className="text-muted-foreground mx-1">/</span>
                    <span className="text-primary">{event.deltaMem}</span>
                  </td>
                  <td className="font-mono text-xs text-muted-foreground">{event.pod}</td>
                  <td className="text-xs text-muted-foreground">{event.node}</td>
                  <td>
                    <Link to={`/workloads/production/${event.workload}`}>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                      >
                        View
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredEvents.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No events match your filters
        </div>
      )}
    </div>
  );
}
