import * as React from "react";

const titleVariants = {
  default: "text-3xl font-bold tracking-tight",
  small: "text-2xl font-bold tracking-tight",
} as const;

export interface DashboardPageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right-side actions (e.g. primary button). Rendered in flex justify-between. */
  actions?: React.ReactNode;
  /** Title size: default = 3xl (list/section pages), small = 2xl (sub-pages like Edit/Create) */
  variant?: keyof typeof titleVariants;
}

export function DashboardPageHeader({
  title,
  description,
  actions,
  variant = "default",
}: DashboardPageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className={titleVariants[variant]}>{title}</h1>
        {description != null && <p className="text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {actions != null && (
        <div className="flex w-full flex-wrap gap-2 [&>*]:flex-1 sm:w-auto sm:shrink-0 sm:[&>*]:flex-none">
          {actions}
        </div>
      )}
    </div>
  );
}
