import { PlannedSummaryRow } from "@/components/dashboard/planned-summary-row";
import { PlannedHandleForm, PlannedLinkForm } from "@/components/dashboard/planned-handling-forms";
import { MonthControl } from "@/components/ui/month-control";
import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/site/metadata'
import { Prisma } from '@/generated/prisma/client'
import {
  ArrowRight,
  CalendarClock,
  CalendarRange,
  ChartNoAxesCombined,
  CircleDollarSign,
  FolderClock,
  Gauge,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  SkipForward,
  TimerReset,
  TrendingDown,
  TrendingUp
} from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import {
  getDashboardData,
  type DashboardBalanceQueryParams,
  type DashboardPlannedIncomeStatus,
  type DashboardPlannedBillStatus
} from '@/actions/dashboard'
import {
  createBalanceAdjustment,
  deleteBalanceAdjustment,
  updateBalanceAdjustment
} from '@/actions/balance-adjustments'
import {
  linkExistingTransactionToPlannedIncome,
  markPlannedIncomeReceived,
  skipPlannedIncomeForMonth,
  undoPlannedIncomeOccurrence
} from '@/actions/planned-income'
import {
  linkExistingTransactionToPlannedBill,
  markPlannedBillPaid,
  skipPlannedBillForMonth,
  undoPlannedBillOccurrence
} from '@/actions/planned-bills'
import { getForecastState, getForecastConfidenceMeta, getSpendingPaceMeta, getIncomeRealizationMeta } from '@/lib/presentation/dashboard'
import { MetricCard, NeedsAttentionSection } from '@/components/dashboard/dashboard-cards'
import { SummaryValues } from '@/components/dashboard/summary-card'
import { FinancialRow } from '@/components/ui/financial-row'
import { SectionHeading } from '@/components/app-shell/section-heading'
import { MonthCashflowChart } from '@/components/dashboard/month-cashflow-chart'
import { SpendingByCategoryChart } from '@/components/dashboard/spending-by-category-chart'
import { TotalBalanceSection } from '@/components/dashboard/total-balance-section'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ToastFeedback } from '@/components/ui/toast-feedback'
import { getAuthenticatedUserPreferences } from '@/lib/auth/session'
import { getCurrentMonthInTimeZone } from '@/lib/dates/time-zone'
import { cn } from '@/lib/utils'

export const metadata: Metadata = pageMetadata.dashboard

type DashboardPageProps = {
  searchParams?: Promise<{
    month?: string | string[]
    balanceRange?: string | string[]
    balanceMode?: string | string[]
    balanceStart?: string | string[]
    balanceEnd?: string | string[]
    balanceAdjustment?: string | string[]
    error?: string | string[]
    success?: string | string[]
  }>
}


function normalizeMonthParam (
  monthParam: string | string[] | undefined,
  currentMonth: string
): string {
  const raw = Array.isArray(monthParam) ? monthParam[0] : monthParam

  if (!raw) {
    return currentMonth
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) {
    return currentMonth
  }

  return raw
}

function firstSearchParamValue (value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function buildDashboardUrl (params: {
  month: string
  balanceQuery: DashboardBalanceQueryParams
  balanceAdjustment?: string
  error?: string
  success?: string
}) {
  const searchParams = new URLSearchParams({ month: params.month })

  for (const [key, value] of Object.entries(params.balanceQuery)) {
    if (value) {
      searchParams.set(key, value)
    }
  }

  if (params.balanceAdjustment) {
    searchParams.set('balanceAdjustment', params.balanceAdjustment)
  }

  if (params.error) {
    searchParams.set('error', params.error)
  }

  if (params.success) {
    searchParams.set('success', params.success)
  }

  return `/dashboard?${searchParams.toString()}`
}

function DashboardMonthFilter ({
  id,
  selectedMonth,
  balanceQuery
}: {
  id: string
  selectedMonth: string
  balanceQuery: DashboardBalanceQueryParams
}) {
  return <MonthControl id={id} month={selectedMonth} hiddenFields={Object.entries(balanceQuery).filter(([, value]) => value).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)} />
}

function formatMoney (formatter: Intl.NumberFormat, amount: Prisma.Decimal) {
  return formatter.format(Number(amount.toString()))
}

function formatDailyMoney (formatter: Intl.NumberFormat, amount: Prisma.Decimal) {
  return `${formatMoney(formatter, amount)}/day`
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

function getLinkCandidateLabel (
  formatter: Intl.NumberFormat,
  candidate: {
    localDate: string
    amount: Prisma.Decimal
    source: string | null
    note: string | null
    categoryId: string
    subcategoryId: string | null
    category: { name: string }
    subcategory: { name: string } | null
  },
  matchAgainst?: {
    amount: Prisma.Decimal
    categoryId: string
    subcategoryId: string | null
  }
) {
  const subcategoryLabel = candidate.subcategory ? ` / ${candidate.subcategory.name}` : ''
  const detail = getSourceOrNote(candidate.source, candidate.note)
  const hints = matchAgainst
    ? [
        candidate.amount.eq(matchAgainst.amount) ? 'Exact amount' : null,
        candidate.categoryId === matchAgainst.categoryId ? 'Same category' : null,
        matchAgainst.subcategoryId && candidate.subcategoryId === matchAgainst.subcategoryId
          ? 'Same subcategory'
          : null
      ].filter(Boolean)
    : []
  const hintLabel = hints.length > 0 ? ` - ${hints.join(', ')}` : ''

  return `${formatLocalDate(candidate.localDate)} - ${candidate.category.name}${subcategoryLabel} - ${detail} - ${formatMoney(formatter, candidate.amount)}${hintLabel}`
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

function getPlannedBillStatusMeta (status: DashboardPlannedBillStatus) {
  switch (status) {
    case 'paid':
      return {
        label: 'Paid',
        variant: 'success' as const
      }
    case 'skipped':
      return {
        label: 'Skipped',
        variant: 'outline' as const
      }
    case 'due-today':
      return {
        label: 'Due today',
        variant: 'warning' as const
      }
    case 'overdue':
      return {
        label: 'Overdue',
        variant: 'destructive' as const
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

function getPlannedIncomeStatusMeta (status: DashboardPlannedIncomeStatus) {
  switch (status) {
    case 'received':
      return {
        label: 'Received',
        variant: 'success' as const
      }
    case 'skipped':
      return {
        label: 'Skipped',
        variant: 'outline' as const
      }
    case 'due-today':
      return {
        label: 'Due today',
        variant: 'warning' as const
      }
    case 'overdue':
      return {
        label: 'Overdue',
        variant: 'destructive' as const
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

export default async function DashboardPage ({
  searchParams
}: DashboardPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const user = await getAuthenticatedUserPreferences()

  if (!user.timeZone) {
    redirect('/setup')
  }

  const selectedMonth = normalizeMonthParam(
    resolvedSearchParams?.month,
    getCurrentMonthInTimeZone(user.timeZone)
  )
  const errorMessage = firstSearchParamValue(resolvedSearchParams?.error)
  const successMessage = firstSearchParamValue(resolvedSearchParams?.success)
  const dashboardData = await getDashboardData(
    selectedMonth,
    resolvedSearchParams
  )
  const data = dashboardData.monthData
  const balanceQuery = dashboardData.totalBalance.queryParams
  const requestedBalanceAdjustment = firstSearchParamValue(
    resolvedSearchParams.balanceAdjustment
  )

  async function createBalanceAdjustmentAction (formData: FormData) {
    'use server'

    const month = String(formData.get('month') ?? '')
    const result = await createBalanceAdjustment({
      amount: String(formData.get('amount') ?? ''),
      effectiveMonth: String(formData.get('effectiveMonth') ?? ''),
      note: String(formData.get('note') ?? '')
    })

    if (!result.ok) {
      redirect(
        buildDashboardUrl({
          month,
          balanceQuery,
          balanceAdjustment: 'add',
          error: result.error
        })
      )
    }

    redirect(
      buildDashboardUrl({
        month,
        balanceQuery,
        success: 'Balance adjustment added.'
      })
    )
  }

  async function updateBalanceAdjustmentAction (formData: FormData) {
    'use server'

    const month = String(formData.get('month') ?? '')
    const id = String(formData.get('id') ?? '')
    const result = await updateBalanceAdjustment({
      id,
      amount: String(formData.get('amount') ?? ''),
      effectiveMonth: String(formData.get('effectiveMonth') ?? ''),
      note: String(formData.get('note') ?? '')
    })

    if (!result.ok) {
      redirect(
        buildDashboardUrl({
          month,
          balanceQuery,
          balanceAdjustment: id,
          error: result.error
        })
      )
    }

    redirect(
      buildDashboardUrl({
        month,
        balanceQuery,
        success: 'Balance adjustment updated.'
      })
    )
  }

  async function deleteBalanceAdjustmentAction (formData: FormData) {
    'use server'

    const month = String(formData.get('month') ?? '')
    const id = String(formData.get('id') ?? '')
    const result = await deleteBalanceAdjustment({ id })

    if (!result.ok) {
      redirect(
        buildDashboardUrl({
          month,
          balanceQuery,
          balanceAdjustment: id,
          error: result.error
        })
      )
    }

    redirect(
      buildDashboardUrl({
        month,
        balanceQuery,
        success: 'Balance adjustment deleted.'
      })
    )
  }

  async function markPaidAction (formData: FormData) {
    'use server'

    const month = String(formData.get('month') ?? '')
    const result = await markPlannedBillPaid({
      plannedBillId: String(formData.get('plannedBillId') ?? ''),
      month,
      amount: String(formData.get('amount') ?? ''),
      localDate: String(formData.get('localDate') ?? '')
    })

    if (!result.ok) {
      redirect(buildDashboardUrl({ month, balanceQuery, error: result.error }))
    }

    redirect(buildDashboardUrl({ month, balanceQuery, success: 'Planned bill marked paid.' }))
  }

  async function skipBillAction (formData: FormData) {
    'use server'

    const month = String(formData.get('month') ?? '')
    const result = await skipPlannedBillForMonth({
      plannedBillId: String(formData.get('plannedBillId') ?? ''),
      month
    })

    if (!result.ok) {
      redirect(buildDashboardUrl({ month, balanceQuery, error: result.error }))
    }

    redirect(buildDashboardUrl({ month, balanceQuery, success: 'Planned bill skipped for this month.' }))
  }

  async function undoOccurrenceAction (formData: FormData) {
    'use server'

    const month = String(formData.get('month') ?? '')
    const result = await undoPlannedBillOccurrence({
      plannedBillId: String(formData.get('plannedBillId') ?? ''),
      month
    })

    if (!result.ok) {
      redirect(buildDashboardUrl({ month, balanceQuery, error: result.error }))
    }

    redirect(buildDashboardUrl({ month, balanceQuery, success: 'Planned bill status undone.' }))
  }

  async function linkExistingTransactionAction (formData: FormData) {
    'use server'

    const month = String(formData.get('month') ?? '')
    const result = await linkExistingTransactionToPlannedBill({
      plannedBillId: String(formData.get('plannedBillId') ?? ''),
      transactionId: String(formData.get('transactionId') ?? ''),
      month
    })

    if (!result.ok) {
      redirect(buildDashboardUrl({ month, balanceQuery, error: result.error }))
    }

    redirect(buildDashboardUrl({ month, balanceQuery, success: 'Transaction linked to planned bill.' }))
  }

  async function markIncomeReceivedAction (formData: FormData) {
    'use server'

    const month = String(formData.get('month') ?? '')
    const result = await markPlannedIncomeReceived({
      plannedIncomeId: String(formData.get('plannedIncomeId') ?? ''),
      month,
      amount: String(formData.get('amount') ?? ''),
      localDate: String(formData.get('localDate') ?? '')
    })

    if (!result.ok) {
      redirect(buildDashboardUrl({ month, balanceQuery, error: result.error }))
    }

    redirect(buildDashboardUrl({ month, balanceQuery, success: 'Planned income marked received.' }))
  }

  async function skipIncomeAction (formData: FormData) {
    'use server'

    const month = String(formData.get('month') ?? '')
    const result = await skipPlannedIncomeForMonth({
      plannedIncomeId: String(formData.get('plannedIncomeId') ?? ''),
      month
    })

    if (!result.ok) {
      redirect(buildDashboardUrl({ month, balanceQuery, error: result.error }))
    }

    redirect(buildDashboardUrl({ month, balanceQuery, success: 'Planned income skipped for this month.' }))
  }

  async function undoIncomeOccurrenceAction (formData: FormData) {
    'use server'

    const month = String(formData.get('month') ?? '')
    const result = await undoPlannedIncomeOccurrence({
      plannedIncomeId: String(formData.get('plannedIncomeId') ?? ''),
      month
    })

    if (!result.ok) {
      redirect(buildDashboardUrl({ month, balanceQuery, error: result.error }))
    }

    redirect(buildDashboardUrl({ month, balanceQuery, success: 'Planned income status undone.' }))
  }

  async function linkExistingIncomeTransactionAction (formData: FormData) {
    'use server'

    const month = String(formData.get('month') ?? '')
    const result = await linkExistingTransactionToPlannedIncome({
      plannedIncomeId: String(formData.get('plannedIncomeId') ?? ''),
      transactionId: String(formData.get('transactionId') ?? ''),
      month
    })

    if (!result.ok) {
      redirect(buildDashboardUrl({ month, balanceQuery, error: result.error }))
    }

    redirect(buildDashboardUrl({ month, balanceQuery, success: 'Transaction linked to planned income.' }))
  }

  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: data.currency
  })

  const forecastState = getForecastState(data.forecast)
  const forecastConfidenceMeta = getForecastConfidenceMeta(
    data.forecast.forecastConfidence
  )
  const spendingPaceMeta = getSpendingPaceMeta(data.forecast)
  const incomeRealization = data.plannedIncomeRealization
  const incomeRealizationMeta = getIncomeRealizationMeta(incomeRealization)
  const incomeRealizationValue =
    incomeRealization.percentage !== null
      ? `${incomeRealization.percentage.toFixed(1)}%`
      : incomeRealization.status === 'not-started'
        ? 'Not started'
        : 'Unavailable'
  const incomeRealizationBadge =
    incomeRealization.status === 'unavailable'
      ? 'No planned income'
      : incomeRealization.status === 'not-started'
        ? `${formatMoney(formatter, incomeRealization.totalPlannedAmount)} planned`
        : `${formatMoney(formatter, incomeRealization.actualReceivedAmount)} of ${formatMoney(formatter, incomeRealization.totalPlannedAmount)} received`
  const displayedPlannedBills = data.plannedBills.filter(
    plannedBill =>
      plannedBill.status !== 'paid' && plannedBill.status !== 'skipped'
  )
  const hasActivePlannedBills = data.plannedBills.length > 0
  const displayedPlannedBillsTotal = data.forecast.unpaidPlannedBills
  const displayedPlannedIncomes = data.plannedIncomes.filter(
    plannedIncome =>
      plannedIncome.status !== 'received' && plannedIncome.status !== 'skipped'
  )
  const hasActivePlannedIncomes = data.plannedIncomes.length > 0
  const plannedIncomeSummary = data.plannedIncomeSummary

  return (
    <div className='flex flex-col gap-5'>
      <ToastFeedback error={errorMessage} success={successMessage} />

      <div className='grid items-start gap-4 md:grid-cols-2'>
        <div className='min-w-0'>
          <TotalBalanceSection
            currency={data.currency}
            month={selectedMonth}
            data={dashboardData.totalBalance}
            adjustmentState={requestedBalanceAdjustment}
            createAdjustmentAction={createBalanceAdjustmentAction}
            updateAdjustmentAction={updateBalanceAdjustmentAction}
            deleteAdjustmentAction={deleteBalanceAdjustmentAction}
          />
        </div>

        <section
          aria-labelledby='monthly-snapshot-heading'
          className='flex min-w-0 flex-col gap-4'
        >
        <SectionHeading id="monthly-snapshot-heading" title="Monthly Snapshot" />

      <DashboardMonthFilter
        id='monthly-snapshot-month'
        selectedMonth={selectedMonth}
        balanceQuery={balanceQuery}
      />

      <section>
        <Card className='overflow-hidden'>
          <CardContent className='p-4'>
            <div className='flex flex-col gap-5'>
              <SummaryValues primary={{ label: 'Net left now', value: formatMoney(formatter, data.netLeft), tone: data.netLeft.lt(0) ? 'danger' : data.netLeft.gt(0) ? 'success' : 'default' }} secondary={[
                { label: 'Income total', value: formatMoney(formatter, data.incomeSum), tone: 'success' },
                { label: 'Expense total', value: formatMoney(formatter, data.expenseSum), tone: 'danger' },
                { label: 'Projected net left', value: formatMoney(formatter, data.forecast.projectedEndOfMonthNet), tone: data.forecast.projectedEndOfMonthNet.lt(0) ? 'danger' : data.forecast.projectedEndOfMonthNet.gt(0) ? 'success' : 'default' }
              ]} />

              <MonthCashflowChart
                currency={data.currency}
                data={data.chartSeries}
                yAxisMax={data.chartYAxisMax}
              />
            </div>
          </CardContent>
        </Card>
      </section>
        </section>
      </div>

      <section
        aria-labelledby='spending-by-category-heading'
        className='flex flex-col gap-4'
      >
        <SectionHeading id="spending-by-category-heading" title="Monthly Spendings" />
        <DashboardMonthFilter
          id='monthly-spendings-month'
          selectedMonth={selectedMonth}
          balanceQuery={balanceQuery}
        />
        <Card>
          <CardContent className='p-4'>
            {data.spendingByCategory.length > 0 ? (
              <SpendingByCategoryChart
                currency={data.currency}
                data={data.spendingByCategory}
              />
            ) : (
              <EmptyState
                icon={ChartNoAxesCombined}
                title='No spending to break down'
                description='Add an expense transaction for this month to see category and subcategory spending here.'
              />
            )}
          </CardContent>
        </Card>
      </section>

      <section
        aria-labelledby='planning-forecast-heading'
        className='flex flex-col gap-4'
      >
        <SectionHeading id="planning-forecast-heading" title="Planning & Forecast" />

        <div className='grid gap-4 min-[1280px]:grid-cols-2'>
          <MetricCard
            title='Forecast remaining spend'
            value={formatMoney(formatter, data.forecast.forecastRemainingSpend)}
            tone={
              data.forecast.forecastRemainingSpend.gt(0) ? 'warning' : 'default'
            }
            badgeLabel={
              data.forecast.monthContext.monthRelation === 'current'
                ? forecastConfidenceMeta.label
                : undefined
            }
            badgeVariant={forecastConfidenceMeta.badgeVariant}
            badgePlacement='title'
            icon={<TrendingDown className='size-5' />}
          />
          <MetricCard
            title='Safe to spend'
            value={formatMoney(formatter, data.forecast.safeToSpend)}
            tone={forecastState.tone}
            icon={
              forecastState.tone === 'danger' ? (
                <ShieldAlert className='size-5' />
              ) : (
                <ShieldCheck className='size-5' />
              )
            }
          />
          <MetricCard
            title='Daily safe spend'
            value={formatDailyMoney(formatter, data.forecast.dailySafeSpend)}
            tone={forecastState.tone}
            badgeLabel={
              data.forecast.monthContext.monthRelation === 'past'
                ? 'Month complete'
                : undefined
            }
            badgeVariant='outline'
            icon={<TimerReset className='size-5' />}
          />
          <MetricCard
            title='Weekly safe spend'
            value={formatMoney(formatter, data.forecast.weeklySafeSpend)}
            tone={forecastState.tone}
            badgeLabel={
              data.forecast.monthContext.monthRelation === 'past'
                ? 'Month complete'
                : data.forecast.weeklySafeSpendDays < 7
                  ? 'Rest of month'
                  : undefined
            }
            badgeVariant='outline'
            badgePlacement='title'
            icon={<CalendarRange className='size-5' />}
          />
          <MetricCard
            title='Spending pace'
            value={
              data.forecast.monthContext.monthRelation === 'future'
                ? 'Unavailable'
                : formatDailyMoney(
                    formatter,
                    data.forecast.spendingPace.currentDailyExpense
                  )
            }
            tone={spendingPaceMeta.tone}
            badgeLabel={spendingPaceMeta.label}
            badgeVariant={spendingPaceMeta.badgeVariant}
            badgePlacement='title'
            icon={<Gauge className='size-5' />}
          />
          <MetricCard
            title='Income realization'
            value={incomeRealizationValue}
            tone={incomeRealizationMeta.tone}
            badgeLabel={incomeRealizationBadge}
            badgeVariant={incomeRealizationMeta.badgeVariant}
            badgePlacement='title'
            icon={<CircleDollarSign className='size-5' />}
          />
        </div>

        <NeedsAttentionSection items={data.attentionItems} />
      </section>

      <section
        aria-labelledby='transactions-plans-heading'
        className='flex flex-col gap-4'
      >
        <SectionHeading id="transactions-plans-heading" title="Transactions & Plans" />

        <div className='grid items-start gap-4 min-[1280px]:grid-cols-3'>
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
          <CardContent className='px-3 pt-6'>
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
                  return (
                    <div
                      key={transaction.id}
                      className='rounded-xl border border-border/80 bg-background/60 p-3'
                    >
                      <FinancialRow truncateSecondary type={transaction.type} category={transaction.category.name} secondary={transaction.subcategory?.name} dateLabel={formatLocalDate(transaction.localDate)} amount={formatMoney(formatter, transaction.amount)} />

                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className='overflow-hidden min-[1280px]:col-span-2'>
          <CardHeader className='flex flex-row items-end justify-between gap-4 border-b border-border/70 pb-4'>
            <CardTitle>Planned items</CardTitle>
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
          </CardHeader>
          <CardContent className='grid p-0 min-[868px]:grid-cols-2'>
            <section
              aria-labelledby='planned-income-heading'
              className='order-2 flex min-w-0 flex-col border-t border-border/70 min-[868px]:border-l min-[868px]:border-t-0'
            >
              <div className='p-4'>
                <CardTitle id='planned-income-heading'>Planned income</CardTitle>
              <div className='flex flex-wrap gap-2 pt-1'>
                <Badge variant='outline' className='text-base'>
                  {displayedPlannedIncomes.length}
                </Badge>
                <Badge variant='outline' className='border-0 text-base'>
                  Pending {formatMoney(formatter, plannedIncomeSummary.pendingTotal)}
                </Badge>
              </div>
              </div>
              <div className='grid gap-4 p-3'>
            {displayedPlannedIncomes.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title={
                  hasActivePlannedIncomes
                    ? 'All planned income handled'
                    : 'No active planned income'
                }
                description={
                  hasActivePlannedIncomes
                    ? undefined
                    : 'Add salary or other expected repeat income so projected month-end net can account for money that has not arrived yet.'
                }
                action={
                  hasActivePlannedIncomes ? undefined : (
                    <Link
                      href='/planned?type=INCOME'
                      className={cn(
                        buttonVariants({ variant: 'outline', size: 'sm' }),
                        'rounded-xl'
                      )}
                    >
                      <Plus />
                      Add planned income
                    </Link>
                  )
                }
              />
            ) : (
              displayedPlannedIncomes.map(plannedIncome => {
                const statusMeta = getPlannedIncomeStatusMeta(plannedIncome.status)
                const isHandled =
                  plannedIncome.status === 'received' ||
                  plannedIncome.status === 'skipped'

                return (
                  <div
                    key={plannedIncome.id}
                    className='grid gap-3 rounded-xl border border-border/80 bg-background/60 p-3'
                  >
                    <PlannedSummaryRow type="INCOME" category={plannedIncome.category.name} subcategory={plannedIncome.subcategory?.name} name={plannedIncome.name} amount={formatMoney(formatter, plannedIncome.amount)} dateLabel={`Expected day ${plannedIncome.expectedDayOfMonth}`} statusLabel={statusMeta.label} statusVariant={statusMeta.variant} archived={plannedIncome.category.isArchived} handledLabel={plannedIncome.occurrence?.receivedAtLocalDate ? `Received ${formatLocalDate(plannedIncome.occurrence.receivedAtLocalDate)}` : undefined} paymentSource={plannedIncome.occurrence?.paymentSource} />

                    {isHandled ? (
                      <form action={undoIncomeOccurrenceAction} className='flex justify-end'>
                        <input
                          type='hidden'
                          name='plannedIncomeId'
                          value={plannedIncome.id}
                        />
                        <input type='hidden' name='month' value={selectedMonth} />
                        <button
                          className={buttonVariants({ variant: 'outline', size: 'sm' })}
                          type='submit'
                        >
                          <RotateCcw />
                          Undo
                        </button>
                      </form>
                    ) : (
                      <div className='grid gap-3 border-t border-border/70'>
                        <PlannedHandleForm id={plannedIncome.id} type="INCOME" amount={plannedIncome.amount.toString()} localDate={plannedIncome.defaultReceivedLocalDate} action={markIncomeReceivedAction} hiddenFields={<><input type="hidden" name="plannedIncomeId" value={plannedIncome.id} /><input type="hidden" name="month" value={selectedMonth} /></>} />
                        <form action={skipIncomeAction} className='flex justify-end'>
                          <input
                            type='hidden'
                            name='plannedIncomeId'
                            value={plannedIncome.id}
                          />
                          <input type='hidden' name='month' value={selectedMonth} />
                          <button
                            className={buttonVariants({
                              variant: 'outline',
                              size: 'sm'
                            })}
                            type='submit'
                          >
                            <SkipForward />
                            Skip this month
                          </button>
                        </form>
                        {plannedIncome.linkCandidates.length > 0 ? (
                          <PlannedLinkForm id={plannedIncome.id} candidates={plannedIncome.linkCandidates.map(candidate => ({ id: candidate.id, label: getLinkCandidateLabel(formatter, candidate, plannedIncome) }))} action={linkExistingIncomeTransactionAction} className="grid gap-3 border-t border-border/70 sm:grid-cols-[minmax(0,1fr)_auto]" hiddenFields={<><input type="hidden" name="plannedIncomeId" value={plannedIncome.id} /><input type="hidden" name="month" value={selectedMonth} /></>} />
                        ) : null}
                      </div>
                    )}
                  </div>
                )
              })
              )}
              </div>
            </section>

            <section
              aria-labelledby='planned-bills-heading'
              className='order-1 flex min-w-0 flex-col'
            >
              <div className='p-4'>
                <CardTitle id='planned-bills-heading'>Planned bills</CardTitle>
              <div className='flex flex-wrap gap-2 pt-1'>
                <Badge variant='outline' className='text-base'>
                  {displayedPlannedBills.length}
                </Badge>
                <Badge variant='outline' className='border-0 text-base'>
                  Reserved {formatMoney(formatter, displayedPlannedBillsTotal)}
                </Badge>
              </div>
              </div>
              <div className='grid gap-4 p-3'>
            {displayedPlannedBills.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title={
                  hasActivePlannedBills
                    ? 'All planned bills handled'
                    : 'No active planned bills'
                }
                description={
                  hasActivePlannedBills
                    ? undefined
                    : 'Add expected monthly bills to make the forecast more grounded.'
                }
                action={
                  hasActivePlannedBills ? undefined : (
                    <Link
                      href='/planned?type=BILL'
                      className={cn(
                        buttonVariants({ variant: 'outline', size: 'sm' }),
                        'rounded-xl'
                      )}
                    >
                      <Plus />
                      Add planned bill
                    </Link>
                  )
                }
              />
            ) : (
              displayedPlannedBills.map(plannedBill => {
                const statusMeta = getPlannedBillStatusMeta(plannedBill.status)
                const isHandled =
                  plannedBill.status === 'paid' ||
                  plannedBill.status === 'skipped'

                return (
                  <div
                    key={plannedBill.id}
                    className='grid gap-3 rounded-xl border border-border/80 bg-background/60 p-3'
                  >
                    <PlannedSummaryRow type="EXPENSE" category={plannedBill.category.name} subcategory={plannedBill.subcategory?.name} name={plannedBill.name} amount={formatMoney(formatter, plannedBill.amount)} dateLabel={formatLocalDate(`${selectedMonth}-${String(plannedBill.dueDayOfMonth).padStart(2, '0')}`)} statusLabel={plannedBill.status !== 'upcoming' ? statusMeta.label : undefined} statusVariant={statusMeta.variant} archived={plannedBill.category.isArchived} handledLabel={plannedBill.occurrence?.paidAtLocalDate ? `Paid ${formatLocalDate(plannedBill.occurrence.paidAtLocalDate)}` : undefined} paymentSource={plannedBill.occurrence?.paymentSource} />

                    {isHandled ? (
                      <form action={undoOccurrenceAction} className='flex justify-end'>
                        <input
                          type='hidden'
                          name='plannedBillId'
                          value={plannedBill.id}
                        />
                        <input type='hidden' name='month' value={selectedMonth} />
                        <button
                          className={buttonVariants({ variant: 'outline', size: 'sm' })}
                          type='submit'
                        >
                          <RotateCcw />
                          Undo
                        </button>
                      </form>
                    ) : (
                      <div className='grid gap-3 border-t border-border/70'>
                        <PlannedHandleForm id={plannedBill.id} type="EXPENSE" amount={plannedBill.amount.toString()} localDate={plannedBill.defaultPaymentLocalDate} action={markPaidAction} hiddenFields={<><input type="hidden" name="plannedBillId" value={plannedBill.id} /><input type="hidden" name="month" value={selectedMonth} /></>} />
                        <form action={skipBillAction} className='flex justify-end'>
                          <input
                            type='hidden'
                            name='plannedBillId'
                            value={plannedBill.id}
                          />
                          <input type='hidden' name='month' value={selectedMonth} />
                          <button
                            className={buttonVariants({
                              variant: 'outline',
                              size: 'sm'
                            })}
                            type='submit'
                          >
                            <SkipForward />
                            Skip this month
                          </button>
                        </form>
                        {plannedBill.linkCandidates.length > 0 ? (
                          <PlannedLinkForm id={plannedBill.id} candidates={plannedBill.linkCandidates.map(candidate => ({ id: candidate.id, label: getLinkCandidateLabel(formatter, candidate, plannedBill) }))} action={linkExistingTransactionAction} className="grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-[minmax(0,1fr)_auto]" hiddenFields={<><input type="hidden" name="plannedBillId" value={plannedBill.id} /><input type="hidden" name="month" value={selectedMonth} /></>} />
                        ) : (
                          <p className='border-t border-border/70 text-sm leading-6 text-muted-foreground'>
                            No unlinked expense transactions found for this month.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}

              </div>
            </section>
          </CardContent>
        </Card>
        </div>
      </section>
    </div>
  )
}
