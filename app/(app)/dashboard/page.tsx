import { Prisma } from '@/generated/prisma/client'
import {
  ArrowRight,
  CalendarClock,
  FolderClock,
  Plus,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp
} from 'lucide-react'
import Link from 'next/link'
import type * as React from 'react'

import {
  getDashboardMonthData,
  type DashboardPlannedBillStatus
} from '@/actions/dashboard'
import { PageHeader } from '@/components/app-shell/page-header'
import { MonthCashflowChart } from '@/components/dashboard/month-cashflow-chart'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type DashboardPageProps = {
  searchParams?: Promise<{
    month?: string | string[]
  }>
}

type DashboardData = Awaited<ReturnType<typeof getDashboardMonthData>>
type ForecastData = DashboardData['forecast']
type MetricTone = 'default' | 'success' | 'warning' | 'danger'

function getCurrentMonthKey (): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function normalizeMonthParam (
  monthParam: string | string[] | undefined
): string {
  const raw = Array.isArray(monthParam) ? monthParam[0] : monthParam

  if (!raw) {
    return getCurrentMonthKey()
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) {
    return getCurrentMonthKey()
  }

  return raw
}

function formatMoney (formatter: Intl.NumberFormat, amount: Prisma.Decimal) {
  return formatter.format(Number(amount.toString()))
}

function getNetTone (netLeft: Prisma.Decimal) {
  if (netLeft.gt(0)) {
    return {
      badgeVariant: 'success' as const,
      label: 'Positive month',
      textClassName: 'text-success'
    }
  }

  if (netLeft.lt(0)) {
    return {
      badgeVariant: 'destructive' as const,
      label: 'Overspent',
      textClassName: 'text-destructive'
    }
  }

  return {
    badgeVariant: 'outline' as const,
    label: 'Break-even',
    textClassName: 'text-foreground'
  }
}

function getSourceOrNote (source: string | null, note: string | null) {
  if (source && source.trim().length > 0) {
    return source.trim()
  }

  if (note && note.trim().length > 0) {
    return note.trim()
  }

  return 'No extra note'
}

function formatLocalDate (localDate: string) {
  const [year, month, day] = localDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1))

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(date)
}

function getForecastState (forecast: ForecastData) {
  if (forecast.monthContext.monthRelation === 'past') {
    if (forecast.projectedEndOfMonthNet.gt(0)) {
      return {
        badgeVariant: 'success' as const,
        label: 'Month closed positive',
        tone: 'success' as MetricTone
      }
    }

    if (forecast.projectedEndOfMonthNet.lt(0)) {
      return {
        badgeVariant: 'destructive' as const,
        label: 'Month closed negative',
        tone: 'danger' as MetricTone
      }
    }

    return {
      badgeVariant: 'outline' as const,
      label: 'Month complete',
      tone: 'default' as MetricTone
    }
  }

  if (forecast.safeToSpend.lt(0)) {
    return {
      badgeVariant: 'destructive' as const,
      label: 'Over-limit risk',
      tone: 'danger' as MetricTone
    }
  }

  if (
    forecast.safeToSpend.eq(0) ||
    forecast.variableForecastSource !== 'trailing-history' ||
    forecast.monthContext.monthRelation === 'future'
  ) {
    return {
      badgeVariant: 'warning' as const,
      label: 'Caution',
      tone: 'warning' as MetricTone
    }
  }

  return {
    badgeVariant: 'success' as const,
    label: 'Within range',
    tone: 'success' as MetricTone
  }
}

function getPlannedBillStatusMeta (status: DashboardPlannedBillStatus) {
  switch (status) {
    case 'due-today':
      return {
        label: 'Due today',
        variant: 'warning' as const
      }
    case 'passed':
      return {
        label: 'Passed',
        variant: 'outline' as const
      }
    default:
      return {
        label: 'Upcoming',
        variant: 'accent' as const
      }
  }
}

function sumPlannedBillAmounts (data: DashboardData['plannedBills']) {
  return data.reduce(
    (total, plannedBill) => total.plus(plannedBill.amount),
    new Prisma.Decimal(0)
  )
}

function getToneStyles (tone: MetricTone) {
  if (tone === 'success') {
    return {
      textClassName: 'text-success',
      iconClassName: 'bg-success/10 text-success'
    }
  }

  if (tone === 'warning') {
    return {
      textClassName: 'text-warning',
      iconClassName: 'bg-warning/10 text-warning'
    }
  }

  if (tone === 'danger') {
    return {
      textClassName: 'text-destructive',
      iconClassName: 'bg-destructive/10 text-destructive'
    }
  }

  return {
    textClassName: 'text-foreground',
    iconClassName: 'bg-accent text-accent-foreground'
  }
}

function MetricCard ({
  title,
  value,
  helper,
  tone = 'default',
  icon,
  badgeLabel,
  badgeVariant = 'outline'
}: {
  title: string
  value: string
  helper?: string
  tone?: MetricTone
  icon: React.ReactNode
  badgeLabel?: string
  badgeVariant?: 'accent' | 'success' | 'warning' | 'destructive' | 'outline'
}) {
  const toneStyles = getToneStyles(tone)

  return (
    <Card className='h-full'>
      <CardContent className='flex h-full flex-col gap-5 p-6'>
        <div className='flex items-start justify-between gap-3'>
          <div className='space-y-1.5'>
            <p className='text-sm font-medium text-muted-foreground'>{title}</p>
            <p
              className={cn(
                'font-mono text-2xl font-semibold tracking-tight',
                toneStyles.textClassName
              )}
            >
              {value}
            </p>
          </div>
          <div
            className={cn(
              'flex size-11 items-center justify-center rounded-2xl',
              toneStyles.iconClassName
            )}
          >
            {icon}
          </div>
        </div>
        {badgeLabel ? <Badge variant={badgeVariant}>{badgeLabel}</Badge> : null}
        {helper ? (
          <p className='mt-auto text-sm leading-6 text-muted-foreground'>
            {helper}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default async function DashboardPage ({
  searchParams
}: DashboardPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const selectedMonth = normalizeMonthParam(resolvedSearchParams?.month)
  const data = await getDashboardMonthData(selectedMonth)

  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: data.currency
  })

  const forecastState = getForecastState(data.forecast)
  const netTone = getNetTone(data.netLeft)
  const displayedPlannedBills =
    data.forecast.monthContext.monthRelation === 'current'
      ? data.plannedBills.filter(plannedBill => plannedBill.status !== 'passed')
      : data.plannedBills
  const displayedPlannedBillsTotal = sumPlannedBillAmounts(
    displayedPlannedBills
  )

  return (
    <div className='space-y-6'>
      <PageHeader title='Monthly snapshot' />

      <form className='flex flex-wrap items-end gap-3' method='get'>
        <div className='space-y-1.5'>
          <Input
            id='month'
            type='month'
            name='month'
            defaultValue={selectedMonth}
          />
        </div>
        <button className={buttonVariants({ size: 'default' })} type='submit'>
          Apply
        </button>
      </form>

      <section className='grid gap-5 md:grid-cols-2'>
        <MetricCard
          title='Income total'
          value={formatMoney(formatter, data.incomeSum)}
          tone='success'
          icon={<TrendingUp className='size-5' />}
        />
        <MetricCard
          title='Expense total'
          value={formatMoney(formatter, data.expenseSum)}
          tone='danger'
          icon={<TrendingDown className='size-5' />}
        />
      </section>

      <section>
        <Card className='overflow-hidden'>
          <CardContent className='p-6 md:p-7'>
            <div className='flex flex-col gap-6'>
              <div className='flex flex-col gap-3'>
                <p className='text-sm font-medium text-muted-foreground'>
                  Net left now
                </p>
                <p
                  className={cn(
                    'font-mono text-4xl font-semibold tracking-tight sm:text-5xl',
                    netTone.textClassName
                  )}
                >
                  {formatMoney(formatter, data.netLeft)}
                </p>
              </div>

              <MonthCashflowChart
                currency={data.currency}
                data={data.chartSeries}
                yAxisMax={data.chartYAxisMax}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className='grid gap-5 md:grid-cols-3'>
        <MetricCard
          title='Safe to spend'
          value={formatMoney(formatter, data.forecast.safeToSpend)}
          helper='Estimated room left before expected spending would move the month beyond recorded income. Not an account balance.'
          tone={forecastState.tone}
          badgeLabel='Estimated'
          badgeVariant={forecastState.badgeVariant}
          icon={
            forecastState.tone === 'danger' ? (
              <ShieldAlert className='size-5' />
            ) : (
              <ShieldCheck className='size-5' />
            )
          }
        />
        <MetricCard
          title='Forecast remaining spend'
          value={formatMoney(formatter, data.forecast.forecastRemainingSpend)}
          helper='Upcoming planned bills plus the variable-spending estimate for the rest of the selected month.'
          tone={
            data.forecast.forecastRemainingSpend.gt(0) ? 'warning' : 'default'
          }
          badgeLabel='Estimate'
          badgeVariant='warning'
          icon={<TrendingDown className='size-5' />}
        />
        <MetricCard
          title='Projected end-of-month net'
          value={formatMoney(formatter, data.forecast.projectedEndOfMonthNet)}
          helper='Where the selected month would likely land if the estimate holds through month-end.'
          tone={forecastState.tone}
          badgeLabel={
            data.forecast.monthContext.monthRelation === 'past'
              ? 'Final result'
              : 'Estimate'
          }
          badgeVariant={
            data.forecast.monthContext.monthRelation === 'past'
              ? 'outline'
              : forecastState.badgeVariant
          }
          icon={<TrendingUp className='size-5' />}
        />
      </section>

      <section className='grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]'>
        <Card className='overflow-hidden'>
          <CardHeader className='flex flex-row items-end justify-between gap-4 pb-0'>
            <CardTitle>Recent transactions</CardTitle>
            <Link
              href='/transactions'
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'sm' }),
                'rounded-xl px-0 text-primary hover:bg-transparent'
              )}
            >
              View all
              <ArrowRight />
            </Link>
          </CardHeader>
          <CardContent className='pt-6'>
            {data.recentTransactions.length === 0 ? (
              <EmptyState
                icon={FolderClock}
                title='No transactions for this month'
                description="Once you record income or expenses, they'll appear here in reverse chronological order."
                action={
                  <Link
                    href='/transactions'
                    className={buttonVariants({ size: 'sm' })}
                  >
                    <Plus />
                    Add transaction
                  </Link>
                }
              />
            ) : (
              <div className='space-y-3'>
                {data.recentTransactions.map(transaction => {
                  const amountTone =
                    transaction.type === 'INCOME'
                      ? 'text-success'
                      : 'text-destructive'

                  return (
                    <div
                      key={transaction.id}
                      className='flex flex-col gap-4 rounded-[24px] border border-border/80 bg-background/60 p-4 md:flex-row md:items-center md:justify-between'
                    >
                      <div className='flex min-w-0 items-start gap-3'>
                        <div
                          className={cn(
                            'mt-1 flex size-10 items-center justify-center rounded-2xl',
                            transaction.type === 'INCOME'
                              ? 'bg-success/10 text-success'
                              : 'bg-destructive/10 text-destructive'
                          )}
                        >
                          {transaction.type === 'INCOME' ? (
                            <TrendingUp className='size-[18px]' />
                          ) : (
                            <TrendingDown className='size-[18px]' />
                          )}
                        </div>
                        <div className='min-w-0 space-y-1'>
                          <div className='flex flex-wrap items-center gap-2'>
                            <p className='text-sm font-semibold text-foreground'>
                              {transaction.category.name}
                            </p>
                            <Badge
                              variant={
                                transaction.type === 'INCOME'
                                  ? 'success'
                                  : 'destructive'
                              }
                            >
                              {transaction.type === 'INCOME'
                                ? 'Income'
                                : 'Expense'}
                            </Badge>
                          </div>
                          <p className='truncate text-sm leading-6 text-muted-foreground'>
                            {getSourceOrNote(
                              transaction.source,
                              transaction.note
                            )}
                          </p>
                        </div>
                      </div>

                      <div className='flex items-center justify-between gap-3 md:flex-col md:items-end'>
                        <p className='text-sm font-medium text-muted-foreground'>
                          {formatLocalDate(transaction.localDate)}
                        </p>
                        <p
                          className={cn(
                            'font-mono text-base font-semibold',
                            amountTone
                          )}
                        >
                          {formatMoney(formatter, transaction.amount)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className='overflow-hidden'>
          <CardHeader className='border-b border-border/70 pb-5'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div className='space-y-3'>
                <CardTitle>Planned bills</CardTitle>
                <div className='flex flex-wrap gap-2'>
                  <Badge variant='outline'>{displayedPlannedBills.length}</Badge>
                  <Badge variant='outline'>
                    {formatMoney(formatter, displayedPlannedBillsTotal)}
                  </Badge>
                </div>
              </div>
              <Link
                href='/planned'
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  'rounded-xl px-0 text-primary hover:bg-transparent'
                )}
              >
                View all
                <ArrowRight />
              </Link>
            </div>
          </CardHeader>
          <CardContent className='grid gap-4 p-6'>
            {displayedPlannedBills.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title={
                  data.forecast.monthContext.monthRelation === 'current' &&
                  data.plannedBills.length > 0
                    ? 'No upcoming planned bills left'
                    : 'No active planned bills'
                }
                description={
                  data.forecast.monthContext.monthRelation === 'current' &&
                  data.plannedBills.length > 0
                    ? 'The remaining estimate is currently driven by recorded spending patterns because all active monthly bill templates have already passed for this month.'
                    : 'Add expected monthly bills to make the forecast more grounded.'
                }
                action={
                  <Link
                    href='/planned'
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      'rounded-xl'
                    )}
                  >
                    <Plus />
                    Add planned bill
                  </Link>
                }
              />
            ) : (
              displayedPlannedBills.map(plannedBill => {
                const statusMeta = getPlannedBillStatusMeta(plannedBill.status)

                return (
                  <div
                    key={plannedBill.id}
                    className='flex flex-col gap-4 rounded-[24px] border border-border/80 bg-background/60 p-4 md:flex-row md:items-center md:justify-between'
                  >
                    <div className='flex min-w-0 items-start gap-3'>
                      <div className='mt-1 flex size-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground'>
                        <CalendarClock className='size-[18px]' />
                      </div>
                      <div className='min-w-0 space-y-2'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <h3 className='text-sm font-semibold text-foreground'>
                            {plannedBill.category.name}
                          </h3>
                          <Badge variant={statusMeta.variant}>
                            {statusMeta.label}
                          </Badge>
                          {plannedBill.category.isArchived ? (
                            <Badge variant='outline'>Archived category</Badge>
                          ) : null}
                        </div>
                        <p className='text-sm leading-6 text-muted-foreground'>
                          {plannedBill.name}
                        </p>
                      </div>
                    </div>

                    <div className='flex items-center justify-between gap-3 md:flex-col md:items-end'>
                      <p className='text-sm font-medium text-muted-foreground'>
                        Due day {plannedBill.dueDayOfMonth}
                      </p>
                      <p className='font-mono text-base font-semibold tracking-tight text-foreground'>
                        {formatMoney(formatter, plannedBill.amount)}
                      </p>
                    </div>
                  </div>
                )
              })
            )}

          </CardContent>
        </Card>
      </section>
    </div>
  )
}
