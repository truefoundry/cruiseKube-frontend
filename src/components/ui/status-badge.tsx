import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "success" | "warning" | "destructive" | "default";
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  const statusStyles = {
    success: "status-badge-success",
    warning: "status-badge-warning",
    destructive: "status-badge-destructive",
    default: "bg-muted text-muted-foreground",
  };

  return (
    <span className={cn("status-badge", statusStyles[status], className)}>
      <span className={cn(
        "h-1.5 w-1.5 rounded-full",
        status === "success" && "bg-success",
        status === "warning" && "bg-warning",
        status === "destructive" && "bg-destructive",
        status === "default" && "bg-muted-foreground"
      )} />
      {children}
    </span>
  );
}
