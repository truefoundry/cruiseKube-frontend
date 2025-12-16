import { useCluster } from "@/contexts/ClusterContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export function ClusterSelector() {
  const { clusters, selectedClusterId, setSelectedClusterId, isLoading } = useCluster();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading clusters...</span>
      </div>
    );
  }

  if (clusters.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">No clusters available</div>
    );
  }

  const selectedCluster = clusters.find((c) => c.id === selectedClusterId);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">Cluster:</span>
      <div className="flex items-center gap-2">
        <Select
          value={selectedClusterId || undefined}
          onValueChange={(value) => setSelectedClusterId(value)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select a cluster">
              {selectedCluster ? selectedCluster.name : undefined}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {clusters.map((cluster) => (
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
        {selectedCluster?.stats_available && (
          <Badge variant="secondary" className="text-xs">
            Stats Available
          </Badge>
        )}
      </div>
    </div>
  );
}

