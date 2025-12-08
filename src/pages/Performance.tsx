import { ExternalLink, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Performance() {
  // Replace with your actual Grafana dashboard URL
  const grafanaUrl = "https://your-grafana-instance.com/d/dashboard-id/dashboard-name?orgId=1&kiosk";

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Performance</h1>
          <p className="text-sm text-muted-foreground">Grafana metrics dashboard</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            className="gap-2"
            onClick={() => window.open(grafanaUrl.replace('&kiosk', ''), '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            Open in Grafana
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              const iframe = document.querySelector('iframe');
              if (iframe) {
                iframe.requestFullscreen?.();
              }
            }}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Grafana Embed */}
      <div className="flex-1 min-h-0">
        <iframe
          src={grafanaUrl}
          title="Grafana Dashboard"
          className="w-full h-full border-0"
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
