import { cn } from "@/lib/utils";

type ProgressProps = {
  className?: string;
  indicatorClassName?: string;
  value: number;
};

export function Progress({
  className,
  indicatorClassName,
  value,
}: ProgressProps) {
  const clampedValue = Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : 0;

  return (
    <div
      className={cn(
        "h-2 overflow-hidden rounded-full bg-secondary/85",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full bg-primary transition-[width]",
          indicatorClassName,
        )}
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );
}
