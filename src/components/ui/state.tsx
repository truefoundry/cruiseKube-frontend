import * as React from "react";
import { AlertCircle, Inbox, Loader2, type LucideIcon } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StateAction extends Omit<ButtonProps, "children"> {
  label: React.ReactNode;
}

interface BaseStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: StateAction;
  children?: React.ReactNode;
}

const toneStyles = {
  neutral: "border-border bg-surface text-muted-foreground",
  info: "border-info/20 bg-info/5 text-info",
  destructive: "border-destructive/20 bg-destructive/5 text-destructive",
};

function StateActionButton({ action }: { action: StateAction }) {
  const { label, variant, size, ...actionProps } = action;
  return (
    <Button className="mt-5" variant={variant ?? "outline"} size={size ?? "sm"} {...actionProps}>
      {label}
    </Button>
  );
}

function DashboardState({
  className,
  icon: Icon,
  title,
  description,
  action,
  children,
  tone = "neutral",
  ...props
}: BaseStateProps & { tone?: "neutral" | "info" | "destructive" }) {
  return (
    <div
      className={cn(
        "flex min-h-[180px] flex-col items-center justify-center rounded-lg border px-6 py-10 text-center shadow-sm",
        toneStyles[tone],
        className,
      )}
      {...props}
    >
      {Icon ? (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-current/15 bg-current/10">
          <Icon className="h-5 w-5" />
        </div>
      ) : null}
      <div className="max-w-md space-y-2 text-foreground">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {children ? <div className="mt-4 max-w-md text-sm text-muted-foreground">{children}</div> : null}
      {action ? <StateActionButton action={action} /> : null}
    </div>
  );
}

export function EmptyState({ icon = Inbox, ...props }: BaseStateProps) {
  return <DashboardState icon={icon} tone="neutral" {...props} />;
}

export interface LoadingStateProps extends Omit<BaseStateProps, "icon" | "action" | "title"> {
  icon?: LucideIcon;
  title?: React.ReactNode;
}

export function LoadingState({ icon = Loader2, title = "Loading", description, className, ...props }: LoadingStateProps) {
  return (
    <DashboardState
      icon={icon}
      title={title}
      description={description}
      tone="info"
      className={cn("[&_svg]:animate-spin", className)}
      {...props}
    />
  );
}

export function ErrorState({ icon = AlertCircle, title = "Something went wrong", ...props }: BaseStateProps) {
  return <DashboardState icon={icon} title={title} tone="destructive" {...props} />;
}
