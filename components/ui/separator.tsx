import { cn } from "@/lib/utils";

type SeparatorProps = {
  className?: string;
  orientation?: "horizontal" | "vertical";
};

export function Separator({
  className,
  orientation = "horizontal",
}: SeparatorProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        "bg-border",
        className,
      )}
    />
  );
}
