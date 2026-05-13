import { useCluster } from "@/contexts/ClusterContext";
import { asArray, cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

type ClusterSelectorProps = {
  className?: string;
  /** Passed to SelectTrigger (e.g. full width in sidebar). */
  triggerClassName?: string;
  labelClassName?: string;
  /** `stacked`: label above select (sidebar). `inline`: label and select in one row. */
  variant?: "inline" | "stacked";
  /** When false, the "Cluster" label is omitted (e.g. when using SidebarGroupLabel). */
  showLabel?: boolean;
};

export function ClusterSelector({
  className,
  triggerClassName,
  labelClassName,
  variant = "inline",
  showLabel = true,
}: ClusterSelectorProps = {}) {
  const { clusters, selectedClusterId, setSelectedClusterId, isLoading } = useCluster();
  const clusterList = asArray(clusters);

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        <span className={cn("text-sm text-muted-foreground", labelClassName)}>Loading clusters...</span>
      </div>
    );
  }

  if (clusterList.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground", className, labelClassName)}>No clusters available</div>
    );
  }

  const selectedCluster = clusterList.find((c) => c.id === selectedClusterId);

  const label = showLabel ? (
    <span className={cn("text-sm font-medium shrink-0", labelClassName)}>Cluster</span>
  ) : null;

  const select = (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <Select value={selectedClusterId || undefined} onValueChange={(value) => setSelectedClusterId(value)}>
        <SelectTrigger className={cn("w-[200px] max-w-full", triggerClassName)}>
          <SelectValue placeholder="Select a cluster">
            {selectedCluster ? selectedCluster.name : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {clusterList.map((cluster) => (
            <SelectItem key={cluster.id} value={cluster.id}>
              <div className="flex items-center gap-2">
                <span>{cluster.name}</span>
                {cluster.stats_available && (
                  <Badge variant="secondary" className="text-xs">
                    Stats
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  if (variant === "stacked") {
    return (
      <div className={cn("flex w-full min-w-0 flex-col", showLabel ? "gap-2" : "gap-0", className)}>
        {label}
        {select}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label}
      {select}
    </div>
  );
}
