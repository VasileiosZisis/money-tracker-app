"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { useNarrowChartLayout } from "@/components/dashboard/use-narrow-chart-layout";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type MonthCashflowChartProps = {
  currency: string;
  data: Array<{
    day: number;
    label: string;
    income: number;
    expense: number | null;
  }>;
  yAxisMax: number;
};

const chartConfig = {
  income: {
    label: "Income",
    color: "var(--success)",
  },
  expense: {
    label: "Expenses",
    color: "var(--destructive)",
  },
} satisfies ChartConfig;

export function MonthCashflowChart({
  currency,
  data,
  yAxisMax,
}: MonthCashflowChartProps) {
  const isNarrow = useNarrowChartLayout();
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  const compactFormatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  });

  return (
    <ChartContainer
      config={chartConfig}
      className="-mx-3 h-[280px] w-[calc(100%+1.5rem)] sm:mx-0 sm:w-full"
    >
      <LineChart
        accessibilityLayer
        data={data}
        margin={
          isNarrow
            ? { left: 0, right: 0, top: 12 }
            : { left: 12, right: 12, top: 12 }
        }
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={18}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={isNarrow ? 6 : 10}
          width={isNarrow ? 56 : 72}
          domain={[0, yAxisMax]}
          tickFormatter={(value) =>
            isNarrow ? compactFormatter.format(value) : formatter.format(value)
          }
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              valueFormatter={(value) => formatter.format(value)}
            />
          }
        />
        <Line
          dataKey="income"
          type="linear"
          stroke="var(--color-income)"
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          dataKey="expense"
          type="linear"
          stroke="var(--color-expense)"
          strokeWidth={3}
          dot={false}
          connectNulls={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartContainer>
  );
}
