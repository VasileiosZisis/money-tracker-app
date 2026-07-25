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
import type { DashboardSpendingCategory } from "@/lib/dashboard/spending-by-category";

type SpendingByCategoryChartProps = {
  currency: string;
  data: DashboardSpendingCategory[];
};

type SpendingChartRow = DashboardSpendingCategory;

const chartConfig = {
  spending: {
    label: "Spending",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function getSegmentStyle(index: number) {
  return {
    color: chartColors[index % chartColors.length],
    opacity: Math.max(0.55, 1 - Math.floor(index / chartColors.length) * 0.18),
  };
}

function truncateLabel(value: string) {
  return value.length > 18 ? `${value.slice(0, 17)}…` : value;
}

function StackedSpendingBar({
  x,
  y,
  width,
  height,
  payload,
  isActive,
  valueFormatter,
}: BarShapeProps & {
  valueFormatter: Intl.NumberFormat;
}) {
  const row = payload as SpendingChartRow | undefined;

  if (!row || width <= 0 || height <= 0 || row.total <= 0) {
    return null;
  }

  const clipPathId = `spending-category-${row.categoryId}`;

  return (
    <g>
      <defs>
        <clipPath id={clipPathId}>
          <rect x={x} y={y} width={width} height={height} rx={6} ry={6} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipPathId})`}>
        {row.subcategories.map((subcategory, index) => {
          const segmentOffset = row.subcategories
            .slice(0, index)
            .reduce(
              (offset, item) =>
                offset + width * (item.total / row.total),
              0,
            );
          const isLast = index === row.subcategories.length - 1;
          const segmentWidth = isLast
            ? width - segmentOffset
            : width * (subcategory.total / row.total);
          const segmentStyle = getSegmentStyle(index);
          const segmentX = x + segmentOffset;

          return (
            <rect
              key={subcategory.subcategoryId ?? "no-subcategory"}
              x={segmentX}
              y={y}
              width={Math.max(0, segmentWidth)}
              height={height}
              fill={segmentStyle.color}
              fillOpacity={segmentStyle.opacity}
              stroke="var(--card)"
              strokeWidth={1}
            />
          );
        })}
      </g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        ry={6}
        fill="none"
        stroke={isActive ? "var(--foreground)" : "transparent"}
        strokeWidth={isActive ? 1.5 : 0}
      />
      <text
        x={x + width + 8}
        y={y + height / 2}
        className="fill-foreground font-mono text-[11px] font-semibold"
        dominantBaseline="central"
      >
        {valueFormatter.format(row.total)}
      </text>
    </g>
  );
}

function SpendingTooltip({
  active,
  payload,
  valueFormatter,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    payload?: unknown;
  }>;
  valueFormatter: Intl.NumberFormat;
}) {
  const row = payload?.[0]?.payload as SpendingChartRow | undefined;

  if (!active || !row) {
    return null;
  }

  return (
    <div className="grid min-w-[220px] gap-3 rounded-xl border border-border/80 bg-card/95 p-3 text-card-foreground shadow-surface backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-semibold text-foreground">
          {row.categoryName}
        </p>
        <p className="font-mono text-sm font-semibold text-foreground">
          {valueFormatter.format(row.total)}
        </p>
      </div>
      <div className="grid gap-2">
        {row.subcategories.map((subcategory, index) => {
          const segmentStyle = getSegmentStyle(index);
          const percentage = (subcategory.total / row.total) * 100;

          return (
            <div
              key={subcategory.subcategoryId ?? "no-subcategory"}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: segmentStyle.color,
                    opacity: segmentStyle.opacity,
                  }}
                />
                <span className="truncate text-xs font-medium text-muted-foreground">
                  {subcategory.subcategoryName}
                </span>
              </div>
              <div className="flex shrink-0 items-baseline gap-2">
                <span className="font-mono text-xs font-semibold text-foreground">
                  {valueFormatter.format(subcategory.total)}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SpendingByCategoryChart({
  currency,
  data,
}: SpendingByCategoryChartProps) {
  const axisFormatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  const valueFormatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  });
  const chartHeight = Math.max(240, data.length * 52 + 48);

  return (
    <>
      <ChartContainer
        config={chartConfig}
        className="w-full"
        style={{ height: chartHeight }}
      >
        <BarChart
          accessibilityLayer
          data={data}
          layout="vertical"
          margin={{ left: 0, right: 104, top: 8, bottom: 8 }}
        >
          <CartesianGrid horizontal={false} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            domain={[0, "dataMax"]}
            tickFormatter={(value) => axisFormatter.format(Number(value))}
          />
          <YAxis
            type="category"
            dataKey="categoryName"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            tick={{ fill: "var(--muted-foreground)", fontSize: 14 }}
            width={116}
            interval={0}
            tickFormatter={(value) => truncateLabel(String(value))}
          />
          <ChartTooltip
            cursor={{ fill: "var(--muted)", fillOpacity: 0.35 }}
            content={(props) => (
              <SpendingTooltip
                {...props}
                valueFormatter={valueFormatter}
              />
            )}
          />
          <Bar
            dataKey="total"
            barSize={24}
            fill="var(--color-spending)"
            isAnimationActive={false}
            shape={(props: BarShapeProps) => (
              <StackedSpendingBar
                {...props}
                valueFormatter={valueFormatter}
              />
            )}
          />
        </BarChart>
      </ChartContainer>

      <div className="sr-only">
        <h4>Spending breakdown details</h4>
        <ul>
          {data.map((category) => (
            <li key={category.categoryId}>
              {category.categoryName}: {valueFormatter.format(category.total)}
              <ul>
                {category.subcategories.map((subcategory) => (
                  <li
                    key={
                      subcategory.subcategoryId ??
                      `${category.categoryId}-no-subcategory`
                    }
                  >
                    {subcategory.subcategoryName}:{" "}
                    {valueFormatter.format(subcategory.total)}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
