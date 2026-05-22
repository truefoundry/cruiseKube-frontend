import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted/80 bg-[linear-gradient(110deg,hsl(var(--muted))_8%,hsl(var(--surface-subtle))_18%,hsl(var(--muted))_33%)] bg-[length:200%_100%] shadow-sm", className)} {...props} />;
}

export { Skeleton };
