import { useState } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  Download, 
  Mail, 
  ExternalLink,
  Cpu,
  HardDrive,
  Zap,
  ArrowRightLeft,
  Calendar,
  Filter
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend,
  ReferenceLine,
} from "recharts";

// Mock data for historical savings
const savingsTrendData = [
  { date: "Dec 1", realized: 1200, potential: 2800, event: null },
  { date: "Dec 2", realized: 1350, potential: 2650, event: "config_change" },
  { date: "Dec 3", realized: 1400, potential: 2500, event: null },
  { date: "Dec 4", realized: 1550, potential: 2400, event: "recommendation" },
  { date: "Dec 5", realized: 1700, potential: 2300, event: null },
  { date: "Dec 6", realized: 1650, potential: 2350, event: "incident" },
  { date: "Dec 7", realized: 1800, potential: 2200, event: null },
];

const compositionData = [
  { name: "CPU", value: 4250, color: "hsl(var(--primary))" },
  { name: "Memory", value: 2800, color: "hsl(var(--success))" },
  { name: "Eviction", value: 890, color: "hsl(var(--warning))" },
  { name: "Reallocation", value: 560, color: "hsl(var(--muted-foreground))" },
];

const leaderboardData = [
  { namespace: "production", realizedSavings: 3420, remainingPotential: 1280 },
  { namespace: "ml-training", realizedSavings: 2150, remainingPotential: 890 },
  { namespace: "staging", realizedSavings: 1680, remainingPotential: 2100 },
  { namespace: "analytics", realizedSavings: 1240, remainingPotential: 560 },
  { namespace: "backend-services", realizedSavings: 980, remainingPotential: 1450 },
];

export default function HistoricalSavings() {
  const [timeRange, setTimeRange] = useState("7d");
  const [clusterFilter, setClusterFilter] = useState("all");
  const [namespaceFilter, setNamespaceFilter] = useState("all");
  const [breakdownBy, setBreakdownBy] = useState("namespace");

  const totalComposition = compositionData.reduce((acc, item) => acc + item.value, 0);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Historical Savings</h1>
          <p className="text-sm text-muted-foreground">Track realized and potential savings over time</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Mail className="h-4 w-4" />
            Schedule Report
          </Button>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Time Range:</span>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
          {["24h", "7d", "30d", "90d"].map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setTimeRange(range)}
            >
              {range}
            </Button>
          ))}
          <Button
            variant={timeRange === "custom" ? "default" : "ghost"}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => setTimeRange("custom")}
          >
            Custom
          </Button>
        </div>

        <div className="h-6 w-px bg-border mx-2" />

        <Select value={clusterFilter} onValueChange={setClusterFilter}>
          <SelectTrigger className="w-[140px] h-8 bg-background text-xs">
            <SelectValue placeholder="Cluster" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clusters</SelectItem>
            <SelectItem value="prod-us">prod-us</SelectItem>
            <SelectItem value="prod-eu">prod-eu</SelectItem>
            <SelectItem value="staging">staging</SelectItem>
          </SelectContent>
        </Select>

        <Select value={namespaceFilter} onValueChange={setNamespaceFilter}>
          <SelectTrigger className="w-[140px] h-8 bg-background text-xs">
            <SelectValue placeholder="Namespace" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Namespaces</SelectItem>
            <SelectItem value="production">production</SelectItem>
            <SelectItem value="staging">staging</SelectItem>
            <SelectItem value="ml-training">ml-training</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Realized Savings"
          value="$8,470"
          subtitle="This period"
          icon={TrendingUp}
          variant="success"
          trend={{ value: 12.4, isPositive: true }}
        />
        <MetricCard
          title="Potential Remaining"
          value="$6,280"
          subtitle="Unrealized opportunities"
          icon={TrendingDown}
          variant="warning"
        />
        <MetricCard
          title="Top Contributor"
          value="production"
          subtitle="Namespace with most savings"
          icon={Zap}
          variant="default"
        />
        <MetricCard
          title="Highest Optimization"
          value="$1,240"
          subtitle="ml-pipeline resize"
          icon={TrendingUp}
          variant="success"
        />
      </div>

      {/* Savings Trend Graph */}
      <div className="metric-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Savings Trend
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-muted-foreground">Realized</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                <span className="text-muted-foreground">Potential</span>
              </div>
            </div>
            <Select value={breakdownBy} onValueChange={setBreakdownBy}>
              <SelectTrigger className="w-[130px] h-7 text-xs bg-muted/50">
                <SelectValue placeholder="Breakdown" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="namespace">By Namespace</SelectItem>
                <SelectItem value="team">By Team</SelectItem>
                <SelectItem value="workload">By Workload</SelectItem>
                <SelectItem value="cluster">By Cluster</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={savingsTrendData}>
              <defs>
                <linearGradient id="realizedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(160, 84%, 45%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(160, 84%, 45%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="potentialGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(215, 20%, 55%)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(215, 20%, 55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(217, 33%, 17%)" />
              <XAxis 
                dataKey="date" 
                tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 11 }}
                axisLine={{ stroke: 'hsl(217, 33%, 17%)' }}
                tickLine={{ stroke: 'hsl(217, 33%, 17%)' }}
              />
              <YAxis 
                tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 11 }}
                axisLine={{ stroke: 'hsl(217, 33%, 17%)' }}
                tickLine={{ stroke: 'hsl(217, 33%, 17%)' }}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(222, 47%, 10%)', 
                  border: '1px solid hsl(217, 33%, 17%)',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
                labelStyle={{ color: 'hsl(210, 40%, 96%)' }}
                formatter={(value: number) => [`$${value}`, '']}
              />
              {/* Event annotations */}
              {savingsTrendData.map((entry, index) => 
                entry.event && (
                  <ReferenceLine
                    key={index}
                    x={entry.date}
                    stroke={
                      entry.event === "recommendation" ? "hsl(160, 84%, 45%)" :
                      entry.event === "config_change" ? "hsl(215, 20%, 55%)" :
                      "hsl(0, 84%, 60%)"
                    }
                    strokeDasharray="3 3"
                    strokeWidth={1}
                  />
                )
              )}
              <Area 
                type="monotone" 
                dataKey="potential" 
                stroke="hsl(215, 20%, 55%)" 
                strokeWidth={2}
                fill="url(#potentialGradient)" 
              />
              <Area 
                type="monotone" 
                dataKey="realized" 
                stroke="hsl(160, 84%, 45%)" 
                strokeWidth={2}
                fill="url(#realizedGradient)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-success" style={{ borderStyle: 'dashed' }} />
            <span>Recommendation applied</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-muted-foreground" style={{ borderStyle: 'dashed' }} />
            <span>Config change</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-destructive" style={{ borderStyle: 'dashed' }} />
            <span>Incident</span>
          </div>
        </div>
      </div>

      {/* Composition and Leaderboard */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Savings Composition Breakdown */}
        <div className="metric-card">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
            Savings Composition Breakdown
          </h3>
          <div className="space-y-4">
            {compositionData.map((item) => (
              <div key={item.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {item.name === "CPU" && <Cpu className="h-4 w-4 text-primary" />}
                    {item.name === "Memory" && <HardDrive className="h-4 w-4 text-success" />}
                    {item.name === "Eviction" && <Zap className="h-4 w-4 text-warning" />}
                    {item.name === "Reallocation" && <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />}
                    <span className="text-sm text-foreground">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-foreground">${item.value.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">
                      ({((item.value / totalComposition) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${(item.value / totalComposition) * 100}%`,
                      backgroundColor: item.color
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Total Savings</span>
            <span className="font-mono text-lg text-primary">${totalComposition.toLocaleString()}</span>
          </div>
        </div>

        {/* Savings Leaderboard */}
        <div className="metric-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Savings Leaderboard
            </h3>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {leaderboardData.map((item, i) => (
              <div key={item.namespace} className="flex items-center gap-3">
                <span className={`
                  flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium
                  ${i === 0 ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}
                `}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm truncate">{item.namespace}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-primary">${item.realizedSavings.toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground">
                        +${item.remainingPotential.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-primary/50 rounded-full"
                      style={{ 
                        width: `${(item.realizedSavings / (item.realizedSavings + item.remainingPotential)) * 100}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <Link to="/workloads">
          <Button variant="outline" className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Jump to Optimization Opportunities
          </Button>
        </Link>
      </div>
    </div>
  );
}
