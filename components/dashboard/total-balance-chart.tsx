"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type TotalBalanceChartProps = {
  currency: string;
  data: Array<{
    month: string;
    endingBalance: number;
  }>;
};

const chartConfig = {
  endingBalance: {
    label: "Ending balance",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

function formatMonth(month: string, format: "short" | "long") {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, (monthNumber ?? 1) - 1, 1));

  return new Intl.DateTimeFormat(undefined, {
    month: format,
    year: format === "short" ? "2-digit" : "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function TotalBalanceChart({
  currency,
  data,
}: TotalBalanceChartProps) {
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
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <LineChart
        accessibilityLayer
        data={data}
        margin={{ left: 12, right: 12, top: 12 }}
      >
        <CartesianGrid vertical={false} />
        <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="4 4" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={24}
          tickFormatter={(value) => formatMonth(String(value), "short")}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          width={76}
          domain={([dataMin, dataMax]) => {
            const minimum = Math.min(0, dataMin);
            const maximum = Math.max(0, dataMax);

            return minimum === maximum ? [-1, 1] : [minimum, maximum];
          }}
          tickFormatter={(value) => axisFormatter.format(value)}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(label) => formatMonth(String(label), "long")}
              valueFormatter={(value) => valueFormatter.format(value)}
            />
          }
        />
        <Line
          dataKey="endingBalance"
          type="linear"
          stroke="var(--color-endingBalance)"
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartContainer>
  );
}
