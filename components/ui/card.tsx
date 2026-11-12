import * as React from "react";

import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(
  ({ className, inset, ...props }, ref) => (
    <div
      ref={ref}
      data-surface={inset ? undefined : "glass"}
      className={cn(
        "border border-border/80 text-card-foreground",
        inset
          ? "rounded-xl bg-background/60"
          : "rounded-2xl bg-card/90 shadow-surface backdrop-blur-xl",
        className,
      )}
      {...props}
    />
  ),
);

Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-1.5 px-4 pt-4", className)}
    {...props}
  />
));

CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-base font-semibold tracking-tight text-foreground", className)}
    {...props}
  />
));

CardTitle.displayName = "CardTitle";

function WorkspaceCardHeader({
  id,
  title,
  level = 2,
  stackBelowXl = false,
  className,
  children,
}: {
  id?: string;
  title: string;
  level?: 2 | 3;
  stackBelowXl?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const Heading = level === 2 ? "h2" : "h3";

  return (
    <CardHeader className={cn(
      "flex-row flex-wrap items-center justify-between gap-3",
      stackBelowXl && "max-xl:flex-col max-xl:items-start",
      className,
    )}>
      <Heading id={id} className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        {title}
      </Heading>
      {children}
    </CardHeader>
  );
}

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm leading-5 text-muted-foreground", className)}
    {...props}
  />
));

CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-4 pb-4", className)} {...props} />
));

CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-3 px-4 pb-4", className)}
    {...props}
  />
));

CardFooter.displayName = "CardFooter";

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, WorkspaceCardHeader };
