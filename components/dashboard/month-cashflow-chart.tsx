"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

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
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });

  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <LineChart accessibilityLayer data={data} margin={{ left: 12, right: 12, top: 12 }}>
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
          tickMargin={10}
          width={72}
          domain={[0, yAxisMax]}
          tickFormatter={(value) => formatter.format(value)}
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
