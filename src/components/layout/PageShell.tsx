import * as React from "react";

import { cn } from "@/lib/utils";

export interface PageShellProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Controls the outer dashboard width. The default matches the existing wide
   * dashboard canvas used by the app pages.
   */
  maxWidthClassName?: string;
}

const PageShell = React.forwardRef<HTMLDivElement, PageShellProps>(
  ({ className, maxWidthClassName = "max-w-[1600px]", ...props }, ref) => (
    <div
      ref={ref}
      className={cn("mx-auto flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8", maxWidthClassName, className)}
      {...props}
    />
  ),
);
PageShell.displayName = "PageShell";

export { PageShell };
