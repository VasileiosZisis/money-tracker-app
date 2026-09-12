"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
  type DotItemDotProps,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";

export type MonthlyResultChartPoint = {
  month: string;
  shortLabel: string;
  fullLabel: string;
  totalIncome: number;
  totalExpenses: number;
  result: number;
  isCurrentMonth: boolean;
};

type MonthlyResultChartProps = {
  currency: string;
  data: MonthlyResultChartPoint[];
};

const chartConfig = {
  totalIncome: {
    label: "Income",
    color: "var(--success)",
  },
  totalExpenses: {
    label: "Expenses",
    color: "var(--destructive)",
  },
} satisfies ChartConfig;

function SeriesDot({ cx, cy, payload, stroke }: DotItemDotProps) {
  const row = payload as MonthlyResultChartPoint | undefined;

  if (!row || cx === undefined || cy === undefined) {
    return null;
  }

  const color = typeof stroke === "string" ? stroke : "var(--foreground)";

  return (
    <circle
      cx={cx}
      cy={cy}
      r={row.isCurrentMonth ? 4 : 2.5}
      fill={row.isCurrentMonth ? "var(--card)" : color}
      stroke={color}
      strokeWidth={row.isCurrentMonth ? 2.5 : 0}
      opacity={row.isCurrentMonth ? 0.68 : 0.9}
    />
  );
}

function formatSignedMoney(formatter: Intl.NumberFormat, value: number) {
  return `${value > 0 ? "+" : ""}${formatter.format(value)}`;
}

function MonthlyResultTooltip({
  active,
  payload,
  valueFormatter,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  valueFormatter: Intl.NumberFormat;
}) {
  const row = payload?.[0]?.payload as MonthlyResultChartPoint | undefined;

  if (!active || !row) {
    return null;
  }

  return (
    <div className="grid min-w-[220px] gap-3 rounded-xl border border-border/80 bg-card/95 p-3 text-card-foreground shadow-surface backdrop-blur-xl">
      <div>
        <p className="text-sm font-semibold text-foreground">{row.fullLabel}</p>
        {row.isCurrentMonth ? (
          <p className="text-sm text-muted-foreground">In progress</p>
        ) : null}
      </div>
      <div className="grid gap-2 border-t border-border/70 pt-2 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Income</span>
          <span className="font-mono font-semibold text-foreground">
            {valueFormatter.format(row.totalIncome)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Expenses</span>
          <span className="font-mono font-semibold text-foreground">
            {valueFormatter.format(row.totalExpenses)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-2">
          <span className="text-muted-foreground">
            {row.isCurrentMonth ? "Current result" : "Month-end result"}
          </span>
          <span className="font-mono font-semibold text-foreground">
            {formatSignedMoney(valueFormatter, row.result)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function MonthlyResultChart({
  currency,
  data,
}: MonthlyResultChartProps) {
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
      <ChartContainer
        config={chartConfig}
        className="h-[200px] min-h-[200px] w-full text-sm"
      >
        <LineChart
          accessibilityLayer
          data={data}
          margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
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
            domain={[0, "auto"]}
            tickFormatter={(value) => axisFormatter.format(Number(value))}
          />
          <ChartTooltip
            cursor={false}
            content={(props) => (
              <MonthlyResultTooltip
                {...props}
                valueFormatter={valueFormatter}
              />
            )}
          />
          <Line
            dataKey="totalIncome"
            type="linear"
            stroke="var(--color-totalIncome)"
            strokeWidth={2.5}
            isAnimationActive={false}
            dot={SeriesDot}
            activeDot={{ r: 4 }}
          />
          <Line
            dataKey="totalExpenses"
            type="linear"
            stroke="var(--color-totalExpenses)"
            strokeWidth={2.5}
            isAnimationActive={false}
            dot={SeriesDot}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ChartContainer>

      <div className="sr-only">
        <h3>Monthly income, expenses, and result history</h3>
        <ul>
          {data.map((month) => (
            <li key={month.month}>
              {month.fullLabel}{month.isCurrentMonth ? " (in progress)" : ""}: {" "}
              income {valueFormatter.format(month.totalIncome)}; expenses {" "}
              {valueFormatter.format(month.totalExpenses)}; result {" "}
              {formatSignedMoney(valueFormatter, month.result)}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
