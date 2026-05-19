import type { TooltipRenderProps } from "react-joyride";
import { Button } from "@/components/ui/button";

export function TourTooltip({
  backProps,
  index,
  isLastStep,
  primaryProps,
  skipProps,
  size,
  step,
  tooltipProps,
}: TooltipRenderProps) {
  return (
    <div
      {...tooltipProps}
      className="z-[10001] max-w-md rounded-lg border border-border bg-card p-5 shadow-xl"
    >
      {step.title && (
        <h2 className="mb-2 text-base font-semibold text-foreground">
          {step.title}
        </h2>
      )}
      <div className="text-sm text-muted-foreground">{step.content}</div>
      <div className="mt-4 flex items-center justify-between">
        <div>
          {!isLastStep && (
            <button
              {...skipProps}
              className="rounded text-xs text-muted-foreground/70 transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Skip tour
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground/60">
            {index + 1} / {size}
          </span>
          {index > 0 && (
            <Button variant="outline" size="sm" {...backProps}>
              Back
            </Button>
          )}
          <Button size="sm" {...primaryProps}>
            {isLastStep ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
