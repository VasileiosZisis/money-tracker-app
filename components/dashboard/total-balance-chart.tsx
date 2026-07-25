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
    balanceChange: number;
  }>;
};

const chartConfig = {
  endingBalance: {
    label: "Ending balance",
    color: "var(--primary)",
  },
  balanceChange: {
    label: "Monthly change",
    color: "var(--muted-foreground)",
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
        <YAxis yAxisId="balanceChange" hide />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(label) => formatMonth(String(label), "long")}
              valueFormatter={(value, dataKey) => {
                const formattedValue = valueFormatter.format(value);

                return dataKey === "balanceChange" && value > 0
                  ? `+${formattedValue}`
                  : formattedValue;
              }}
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
        <Line
          dataKey="balanceChange"
          yAxisId="balanceChange"
          stroke="var(--color-balanceChange)"
          strokeOpacity={0}
          dot={false}
          activeDot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
