"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/utils";

export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode;
    color?: string;
  };
};

type ChartContextValue = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextValue | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error("Chart components must be used inside a ChartContainer.");
  }

  return context;
}

export const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig;
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
  }
>(({ id, className, children, config, style, ...props }, ref) => {
  const chartId = React.useId().replace(/:/g, "");

  const chartStyle = React.useMemo(() => {
    return Object.entries(config).reduce((styles, [key, item]) => {
      if (item.color) {
        (styles as Record<string, string>)[`--color-${key}`] = item.color;
      }

      return styles;
    }, {} as React.CSSProperties);
  }, [config]);

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        ref={ref}
        data-chart={id ?? chartId}
        className={cn(
          "flex min-h-[220px] w-full items-center justify-center text-xs",
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
          "[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-[color-mix(in_srgb,var(--foreground)_18%,transparent)]",
          "dark:[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/70",
          "[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border",
          "[&_.recharts-dot[stroke='#fff']]:stroke-transparent",
          "[&_.recharts-layer]:outline-none",
          className,
        )}
        style={{ ...chartStyle, ...style }}
        {...props}
      >
        <RechartsPrimitive.ResponsiveContainer
          initialDimension={{ width: 0, height: 0 }}
          minWidth={0}
          minHeight={0}
        >
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});

ChartContainer.displayName = "ChartContainer";

export const ChartTooltip = RechartsPrimitive.Tooltip;

type ChartTooltipContentProps = React.ComponentProps<typeof RechartsPrimitive.Tooltip> & {
  hideLabel?: boolean;
  labelFormatter?: (label: string | number) => React.ReactNode;
  valueFormatter?: (value: number, dataKey: string) => string;
  active?: boolean;
  payload?: Array<{
    dataKey?: string | number;
    value?: number | string | null;
    color?: string;
  }>;
  label?: string | number;
};

export function ChartTooltipContent({
  active,
  payload,
  label,
  hideLabel = false,
  labelFormatter,
  valueFormatter,
}: ChartTooltipContentProps) {
  const { config } = useChart();

  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div className="grid min-w-[180px] gap-2 rounded-2xl border border-border/80 bg-card/95 p-3 text-card-foreground shadow-surface backdrop-blur-xl">
      {!hideLabel ? (
        <p className="text-xs font-medium text-muted-foreground">
          {labelFormatter && label !== undefined
            ? labelFormatter(label)
            : `Day ${label}`}
        </p>
      ) : null}
      <div className="grid gap-2">
        {payload.map((entry: NonNullable<ChartTooltipContentProps["payload"]>[number]) => {
          if (typeof entry.dataKey !== "string") {
            return null;
          }

          const itemConfig = config[entry.dataKey];
          const entryValue = typeof entry.value === "number" ? entry.value : Number(entry.value ?? 0);

          return (
            <div key={entry.dataKey} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: entry.color ?? itemConfig?.color }}
                />
                <span className="text-xs font-medium text-muted-foreground">
                  {itemConfig?.label ?? entry.dataKey}
                </span>
              </div>
              <span className="font-mono text-xs font-semibold text-foreground">
                {valueFormatter ? valueFormatter(entryValue, entry.dataKey) : entryValue}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
