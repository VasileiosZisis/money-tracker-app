"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  type BarShapeProps,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";

export type SpendingTrendChartPoint = {
  month: string;
  shortLabel: string;
  fullLabel: string;
  categorySpending: number;
  totalExpenses: number;
  actualNet: number;
  isCurrentMonth: boolean;
};

type SpendingTrendsChartProps = {
  categoryName: string;
  currency: string;
  data: SpendingTrendChartPoint[];
};

const chartConfig = {
  categorySpending: {
    label: "Category spending",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

function SpendingBarShape({
  x,
  y,
  width,
  height,
  payload,
}: BarShapeProps) {
  const row = payload as SpendingTrendChartPoint | undefined;

  if (!row || width <= 0 || height <= 0) {
    return null;
  }

  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={6}
      ry={6}
      fill="var(--color-categorySpending)"
      fillOpacity={row.isCurrentMonth ? 0.42 : 0.9}
      stroke={row.isCurrentMonth ? "var(--color-categorySpending)" : "transparent"}
      strokeDasharray={row.isCurrentMonth ? "4 3" : undefined}
      strokeWidth={row.isCurrentMonth ? 1.5 : 0}
    />
  );
}

function SpendingTrendTooltip({
  active,
  payload,
  valueFormatter,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  valueFormatter: Intl.NumberFormat;
}) {
  const row = payload?.[0]?.payload as SpendingTrendChartPoint | undefined;

  if (!active || !row) {
    return null;
  }

  const netPrefix = row.actualNet > 0 ? "+" : "";

  return (
    <div className="grid min-w-[220px] gap-3 rounded-xl border border-border/80 bg-card/95 p-3 text-card-foreground shadow-surface backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {row.fullLabel}
          </p>
          {row.isCurrentMonth ? (
            <p className="text-xs text-muted-foreground">In progress</p>
          ) : null}
        </div>
        <p className="font-mono text-sm font-semibold text-foreground">
          {valueFormatter.format(row.categorySpending)}
        </p>
      </div>
      <div className="grid gap-2 border-t border-border/70 pt-2 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Total expenses</span>
          <span className="font-mono font-semibold text-foreground">
            {valueFormatter.format(row.totalExpenses)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">
            {row.isCurrentMonth ? "Current net" : "Month-end net"}
          </span>
          <span className="font-mono font-semibold text-foreground">
            {netPrefix}
            {valueFormatter.format(row.actualNet)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function SpendingTrendsChart({
  categoryName,
  currency,
  data,
}: SpendingTrendsChartProps) {
  const axisFormatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  const valueFormatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  });

  return (
    <>
      <ChartContainer config={chartConfig} className="h-[320px] w-full">
        <BarChart
          accessibilityLayer
          data={data}
          margin={{ left: 0, right: 8, top: 12, bottom: 0 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="shortLabel"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={12}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            width={72}
            tickFormatter={(value) => axisFormatter.format(Number(value))}
          />
          <ChartTooltip
            cursor={{ fill: "var(--muted)", fillOpacity: 0.35 }}
            content={(props) => (
              <SpendingTrendTooltip
                {...props}
                valueFormatter={valueFormatter}
              />
            )}
          />
          <Bar
            dataKey="categorySpending"
            fill="var(--color-categorySpending)"
            isAnimationActive={false}
            maxBarSize={52}
            shape={SpendingBarShape}
          />
        </BarChart>
      </ChartContainer>

      <div className="sr-only">
        <h4>{categoryName} spending history</h4>
        <ul>
          {data.map((month) => (
            <li key={month.month}>
              {month.fullLabel}{month.isCurrentMonth ? " (in progress)" : ""}: {" "}
              {valueFormatter.format(month.categorySpending)}; total expenses {" "}
              {valueFormatter.format(month.totalExpenses)}; actual net {" "}
              {month.actualNet > 0 ? "+" : ""}
              {valueFormatter.format(month.actualNet)}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
