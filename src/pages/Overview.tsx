import { 
  Gauge, 
  Layers, 
  DollarSign, 
  AlertTriangle, 
  TrendingUp,
  Cpu,
  HardDrive,
  ExternalLink
} from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { 
  overviewMetrics, 
  wastefulWorkloads, 
  leaderboard, 
  historicSavings 
} from "@/lib/mock-data";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Link } from "react-router-dom";

export default function Overview() {
  const getWasteStatus = (percent: number) => {
    if (percent >= 50) return "destructive";
    if (percent >= 30) return "warning";
    return "success";
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Overview</h1>
          <p className="text-sm text-muted-foreground">Cluster optimization at a glance</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <span>Last sync: 2 min ago</span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Optimization Score"
          value={`${overviewMetrics.optimizationScore}%`}
          subtitle="Cluster health"
          icon={Gauge}
          variant="success"
          trend={{ value: 5.2, isPositive: true }}
        />
        <MetricCard
          title="Coverage"
          value={`${overviewMetrics.coverage}%`}
          subtitle="Workloads optimized"
          icon={Layers}
          variant="default"
          trend={{ value: 2.8, isPositive: true }}
        />
        <MetricCard
          title="Total Saved"
          value={`$${overviewMetrics.totalSaved.toLocaleString()}`}
          subtitle="All time"
          icon={DollarSign}
          variant="success"
          trend={{ value: 12.4, isPositive: true }}
        />
        <MetricCard
          title="Reliability Issues"
          value={overviewMetrics.reliabilityIssues}
          subtitle="Workloads at risk"
          icon={AlertTriangle}
          variant={overviewMetrics.reliabilityIssues > 10 ? "warning" : "default"}
        />
      </div>

      {/* Savings Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="metric-card col-span-1">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
            Potential vs Realized
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">CPU Cores</span>
              </div>
              <div className="text-right">
                <span className="font-mono text-sm text-foreground">
                  {overviewMetrics.realizedSavings.cpu}
                </span>
                <span className="text-muted-foreground text-sm"> / </span>
                <span className="font-mono text-sm text-muted-foreground">
                  {overviewMetrics.potentialSavings.cpu}
                </span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${(overviewMetrics.realizedSavings.cpu / overviewMetrics.potentialSavings.cpu) * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Memory (GB)</span>
              </div>
              <div className="text-right">
                <span className="font-mono text-sm text-foreground">
                  {overviewMetrics.realizedSavings.memory}
                </span>
                <span className="text-muted-foreground text-sm"> / </span>
                <span className="font-mono text-sm text-muted-foreground">
                  {overviewMetrics.potentialSavings.memory}
                </span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${(overviewMetrics.realizedSavings.memory / overviewMetrics.potentialSavings.memory) * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Cost ($)</span>
              </div>
              <div className="text-right">
                <span className="font-mono text-sm text-foreground">
                  ${overviewMetrics.realizedSavings.dollars}
                </span>
                <span className="text-muted-foreground text-sm"> / </span>
                <span className="font-mono text-sm text-muted-foreground">
                  ${overviewMetrics.potentialSavings.dollars}
                </span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${(overviewMetrics.realizedSavings.dollars / overviewMetrics.potentialSavings.dollars) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Historic Savings Chart */}
        <div className="metric-card col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Daily Savings Trend
            </h3>
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
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicSavings}>
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
                />
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
        </div>
      </div>

      {/* Tables */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top Wasteful Workloads */}
        <div className="metric-card lg:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Top 10 Wasteful Workloads
            </h3>
            <Link to="/workloads">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
                View all
                <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Namespace</th>
                  <th>Workload</th>
                  <th>Containers</th>
                  <th>Waste</th>
                  <th>Savings</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {wastefulWorkloads.map((workload, i) => (
                  <tr key={i} className="group cursor-pointer">
                    <td className="font-mono text-xs">{workload.namespace}</td>
                    <td className="font-medium">{workload.workload}</td>
                    <td className="text-muted-foreground">{workload.containers}</td>
                    <td>
                      <StatusBadge status={getWasteStatus(workload.wastePercent)}>
                        {workload.wastePercent}%
                      </StatusBadge>
                    </td>
                    <td className="font-mono text-primary">${workload.potentialSavings}</td>
                    <td>
                      <Link to={`/workloads/${workload.namespace}/${workload.workload}`}>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity text-xs">
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

        {/* Leaderboard */}
        <div className="metric-card overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Namespace Leaderboard
            </h3>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {leaderboard.map((item, i) => (
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
                    <span className="font-mono text-sm text-primary">${item.realizedSavings}</span>
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
    </div>
  );
}
