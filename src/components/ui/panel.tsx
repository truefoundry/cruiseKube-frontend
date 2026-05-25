import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const panelVariants = cva("rounded-lg border text-card-foreground", {
  variants: {
    variant: {
      default: "border-border bg-surface shadow-card",
      elevated: "border-border bg-surface-elevated shadow-card",
      subtle: "border-border/80 bg-surface-subtle/70 shadow-sm",
      ghost: "border-transparent bg-transparent shadow-none",
    },
    padding: {
      none: "",
      sm: "p-4",
      md: "p-5",
      lg: "p-6",
    },
  },
  defaultVariants: {
    variant: "default",
    padding: "md",
  },
});

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof panelVariants> {}

const Panel = React.forwardRef<HTMLDivElement, PanelProps>(({ className, variant, padding, ...props }, ref) => (
  <section ref={ref} className={cn(panelVariants({ variant, padding }), className)} {...props} />
));
Panel.displayName = "Panel";

export { Panel, panelVariants };
