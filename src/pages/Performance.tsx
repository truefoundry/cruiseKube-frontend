import { ExternalLink, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import grafanaDashboard1 from "@/assets/grafana-dashboard-1.png";
import grafanaDashboard2 from "@/assets/grafana-dashboard-2.png";

export default function Performance() {
  const grafanaUrl = "https://your-grafana-instance.com/d/dashboard-id/dashboard-name";

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Performance</h1>
          <p className="text-sm text-muted-foreground">Grafana metrics dashboard</p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          className="gap-2"
          onClick={() => window.open(grafanaUrl, '_blank')}
        >
          <ExternalLink className="h-4 w-4" />
          Open in Grafana
        </Button>
      </div>

      {/* Dashboard Images */}
      <div className="flex-1 overflow-auto bg-[#181b1f]">
        <img 
          src={grafanaDashboard1} 
          alt="Grafana Dashboard - Overview, CPU, Memory Performance" 
          className="w-full"
        />
        <img 
          src={grafanaDashboard2} 
          alt="Grafana Dashboard - Pod Statistics, Evictions, Task Performance" 
          className="w-full"
        />
      </div>
    </div>
  );
}
