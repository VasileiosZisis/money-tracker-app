import { Prisma } from '@/generated/prisma/client'
import {
  ArrowRight,
  CalendarClock,
  ChartNoAxesCombined,
  CircleAlert,
  CircleCheckBig,
  FolderClock,
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
import type * as React from 'react'

import {
  getDashboardData,
  type DashboardBalanceQueryParams,
  type DashboardMonthData,
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
import { Input } from '@/components/ui/input'
import { PageNotice } from '@/components/ui/page-notice'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

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

type DashboardData = DashboardMonthData
type ForecastData = DashboardData['forecast']
type MetricTone = 'default' | 'success' | 'warning' | 'danger'
type AttentionTone = DashboardData['attentionItems'][number]['tone']

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
  return (
    <form className='flex flex-wrap items-end gap-3' method='get'>
      <input
        type='hidden'
        name='balanceRange'
        value={balanceQuery.balanceRange}
      />
      {balanceQuery.balanceMode ? (
        <input
          type='hidden'
          name='balanceMode'
          value={balanceQuery.balanceMode}
        />
      ) : null}
      {balanceQuery.balanceStart ? (
        <input
          type='hidden'
          name='balanceStart'
          value={balanceQuery.balanceStart}
        />
      ) : null}
      {balanceQuery.balanceEnd ? (
        <input
          type='hidden'
          name='balanceEnd'
          value={balanceQuery.balanceEnd}
        />
      ) : null}
      <div className='space-y-1.5'>
        <Input
          id={id}
          type='month'
          name='month'
          defaultValue={selectedMonth}
        />
      </div>
      <button className={buttonVariants({ size: 'default' })} type='submit'>
        Apply
      </button>
    </form>
  )
}

function formatMoney (formatter: Intl.NumberFormat, amount: Prisma.Decimal) {
  return formatter.format(Number(amount.toString()))
}

function formatDailyMoney (formatter: Intl.NumberFormat, amount: Prisma.Decimal) {
  return `${formatMoney(formatter, amount)}/day`
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

function getForecastState (forecast: ForecastData) {
  if (forecast.monthContext.monthRelation === 'past') {
    if (forecast.safeToSpend.gt(0)) {
      return {
        badgeVariant: 'success' as const,
        label: 'Month closed positive',
        tone: 'success' as MetricTone
      }
    }

    if (forecast.safeToSpend.lt(0)) {
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

function getAttentionToneStyles (tone: AttentionTone) {
  if (tone === 'success') {
    return {
      iconClassName: 'bg-success/10 text-success',
      badgeVariant: 'success' as const,
      badgeLabel: 'Clear'
    }
  }

  if (tone === 'warning') {
    return {
      iconClassName: 'bg-warning/10 text-warning',
      badgeVariant: 'warning' as const,
      badgeLabel: 'Check'
    }
  }

  if (tone === 'danger') {
    return {
      iconClassName: 'bg-destructive/10 text-destructive',
      badgeVariant: 'destructive' as const,
      badgeLabel: 'Urgent'
    }
  }

  return {
    iconClassName: 'bg-accent text-accent-foreground',
    badgeVariant: 'accent' as const,
    badgeLabel: 'Info'
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
  helper?: React.ReactNode
  tone?: MetricTone
  icon: React.ReactNode
  badgeLabel?: string
  badgeVariant?: 'accent' | 'success' | 'warning' | 'destructive' | 'outline'
}) {
  const toneStyles = getToneStyles(tone)

  return (
    <Card className='h-full'>
      <CardContent className='flex h-full flex-col gap-4 p-4'>
        <div className='flex items-center justify-between gap-3'>
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
              'flex size-10 items-center justify-center rounded-lg',
              toneStyles.iconClassName
            )}
          >
            {icon}
          </div>
        </div>
        {badgeLabel ? <Badge variant={badgeVariant}>{badgeLabel}</Badge> : null}
        {helper ? (
          <div className='mt-auto text-sm leading-6 text-muted-foreground'>
            {helper}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function NeedsAttentionSection ({
  items
}: {
  items: DashboardData['attentionItems']
}) {
  return (
    <Card className='overflow-hidden'>
      <CardHeader className='border-b border-border/70 pb-4'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='space-y-1.5'>
            <CardTitle>Needs attention</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className='grid gap-4 p-3'>
        {items.length === 0 ? (
          <EmptyState
            icon={CircleCheckBig}
            title='Nothing needs attention'
            description='No overdue bills or forecast warnings for this month.'
          />
        ) : (
          items.map((item, index) => {
            const toneStyles = getAttentionToneStyles(item.tone)

            return (
              <div
                key={`${item.type}-${index}`}
                className='flex gap-3 rounded-xl border border-border/80 bg-background/60 p-3'
              >
                <div
                  className={cn(
                    'mt-1 flex size-9 shrink-0 items-center justify-center rounded-lg',
                    toneStyles.iconClassName
                  )}
                >
                  <CircleAlert className='size-4.5' />
                </div>
                <div className='min-w-0 space-y-2'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <h3 className='text-sm font-semibold text-foreground'>
                      {item.title}
                    </h3>
                    <Badge variant={toneStyles.badgeVariant}>
                      {toneStyles.badgeLabel}
                    </Badge>
                  </div>
                  <p className='text-sm leading-6 text-muted-foreground'>
                    {item.description}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

export default async function DashboardPage ({
  searchParams
}: DashboardPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {}
  const selectedMonth = normalizeMonthParam(resolvedSearchParams?.month)
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
  const selectedBalanceAdjustment = dashboardData.totalBalance.adjustments.find(
    adjustment => adjustment.id === requestedBalanceAdjustment
  )
  const balanceAdjustmentState =
    requestedBalanceAdjustment === 'add' ||
    requestedBalanceAdjustment === 'manage' ||
    selectedBalanceAdjustment
      ? requestedBalanceAdjustment
      : requestedBalanceAdjustment
        ? 'manage'
        : undefined
  const balanceAdjustmentNotFound =
    Boolean(requestedBalanceAdjustment) &&
    requestedBalanceAdjustment !== 'add' &&
    requestedBalanceAdjustment !== 'manage' &&
    !selectedBalanceAdjustment

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
  const netTone = getNetTone(data.netLeft)
  const projectedNetTone = getNetTone(data.forecast.projectedEndOfMonthNet)
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
      {errorMessage ? (
        <PageNotice variant='error' title='Something needs attention'>
          {errorMessage}
        </PageNotice>
      ) : null}

      {!errorMessage && successMessage ? (
        <PageNotice variant='success' title='Saved'>
          {successMessage}
        </PageNotice>
      ) : null}

      <div className='grid items-start gap-4 md:grid-cols-2'>
        <div className='min-w-0'>
          <TotalBalanceSection
            currency={data.currency}
            month={selectedMonth}
            data={dashboardData.totalBalance}
            adjustmentState={balanceAdjustmentState}
            adjustmentNotFound={balanceAdjustmentNotFound}
            createAdjustmentAction={createBalanceAdjustmentAction}
            updateAdjustmentAction={updateBalanceAdjustmentAction}
            deleteAdjustmentAction={deleteBalanceAdjustmentAction}
          />
        </div>

        <section
          aria-labelledby='monthly-snapshot-heading'
          className='flex min-w-0 flex-col gap-4'
        >
        <h2
          id='monthly-snapshot-heading'
          className='text-3xl font-semibold tracking-tight text-foreground md:text-4xl'
        >
          Monthly Snapshot
        </h2>

      <DashboardMonthFilter
        id='monthly-snapshot-month'
        selectedMonth={selectedMonth}
        balanceQuery={balanceQuery}
      />

      <section>
        <Card className='overflow-hidden'>
          <CardContent className='p-4'>
            <div className='flex flex-col gap-5'>
              <div className='flex flex-col gap-5'>
                <div className='flex flex-col gap-3'>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Net left now
                  </p>
                  <p
                    className={cn(
                      'font-mono text-4xl font-semibold tracking-tight',
                      netTone.textClassName
                    )}
                  >
                    {formatMoney(formatter, data.netLeft)}
                  </p>
                </div>
                <div className='flex flex-row items-start gap-6'>
                  <div className='flex flex-col'>
                    <p className='text-sm font-medium text-muted-foreground'>
                      Income total
                    </p>
                    <p className='font-mono text-xl font-semibold tracking-tight text-success'>
                      {formatMoney(formatter, data.incomeSum)}
                    </p>
                  </div>
                  <div className='flex flex-col'>
                    <p className='text-sm font-medium text-muted-foreground'>
                      Expense total
                    </p>
                    <p className='font-mono text-xl font-semibold tracking-tight text-destructive'>
                      {formatMoney(formatter, data.expenseSum)}
                    </p>
                  </div>
                  <div className='flex flex-col'>
                    <p className='text-sm font-medium text-muted-foreground'>
                      Projected net left
                    </p>
                    <p
                      className={cn(
                        'font-mono text-xl font-semibold tracking-tight',
                        projectedNetTone.textClassName
                      )}
                    >
                      {formatMoney(
                        formatter,
                        data.forecast.projectedEndOfMonthNet
                      )}
                    </p>
                  </div>
                </div>
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
        </section>
      </div>

      <section
        aria-labelledby='spending-by-category-heading'
        className='flex flex-col gap-4'
      >
        <h2
          id='spending-by-category-heading'
          className='text-3xl font-semibold tracking-tight text-foreground md:text-4xl'
        >
          Monthly Spendings
        </h2>
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
        <h2
          id='planning-forecast-heading'
          className='text-3xl font-semibold tracking-tight text-foreground md:text-4xl'
        >
          Planning &amp; Forecast
        </h2>

        <div className='grid gap-4 md:grid-cols-3'>
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
            title='Forecast remaining spend'
            value={formatMoney(formatter, data.forecast.forecastRemainingSpend)}
            tone={
              data.forecast.forecastRemainingSpend.gt(0) ? 'warning' : 'default'
            }
            icon={<TrendingDown className='size-5' />}
          />
        </div>

        <NeedsAttentionSection items={data.attentionItems} />
      </section>

      <section
        aria-labelledby='transactions-plans-heading'
        className='flex flex-col gap-4'
      >
        <h2
          id='transactions-plans-heading'
          className='text-3xl font-semibold tracking-tight text-foreground md:text-4xl'
        >
          Transactions &amp; Plans
        </h2>

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
                  const amountTone =
                    transaction.type === 'INCOME'
                      ? 'text-success'
                      : 'text-destructive'

                  return (
                    <div
                      key={transaction.id}
                      className='flex flex-col gap-3 rounded-xl border border-border/80 bg-background/60 p-3 md:flex-row md:items-center md:justify-between'
                    >
                      <div className='flex min-w-0 items-start gap-3'>
                        <div
                          className={cn(
                            'mt-1 flex size-9 items-center justify-center rounded-lg',
                            transaction.type === 'INCOME'
                              ? 'bg-success/10 text-success'
                              : 'bg-destructive/10 text-destructive'
                          )}
                        >
                          {transaction.type === 'INCOME' ? (
                            <TrendingUp className='size-4.5' />
                          ) : (
                            <TrendingDown className='size-4.5' />
                          )}
                        </div>
                        <div className='flex min-w-0 flex-col'>
                          <p className='text-sm font-semibold text-foreground'>
                            {transaction.category.name}
                          </p>
                          {transaction.subcategory ? (
                            <p className='truncate text-sm leading-6 text-muted-foreground'>
                              {transaction.subcategory.name}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className='flex items-center justify-between md:flex-col md:items-end'>
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
              <div className='flex flex-wrap gap-2'>
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
                    <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
                      <div className='flex min-w-0 items-start gap-3'>
                        <div className='mt-1 flex size-9 items-center justify-center rounded-lg bg-success/10 text-success'>
                          <TrendingUp className='size-4.5' />
                        </div>
                        <div className='flex min-w-0 flex-col'>
                          <div className='flex flex-wrap items-center gap-2'>
                            <h3 className='text-sm font-semibold text-foreground'>
                              {plannedIncome.category.name}
                            </h3>
                            {plannedIncome.subcategory ? (
                              <Badge variant='outline'>{plannedIncome.subcategory.name}</Badge>
                            ) : null}
                            <Badge variant={statusMeta.variant}>
                              {statusMeta.label}
                            </Badge>
                            {plannedIncome.category.isArchived ? (
                              <Badge variant='outline'>Archived category</Badge>
                            ) : null}
                          </div>
                          <p className='text-sm leading-6 text-muted-foreground'>
                            {plannedIncome.name}
                          </p>
                          {plannedIncome.occurrence?.receivedAtLocalDate ? (
                            <div className='flex flex-wrap items-center gap-2'>
                              <p className='text-xs font-medium text-muted-foreground'>
                                Received {formatLocalDate(plannedIncome.occurrence.receivedAtLocalDate)}
                              </p>
                              {plannedIncome.occurrence.paymentSource ? (
                                <Badge variant='outline'>
                                  {plannedIncome.occurrence.paymentSource === 'LINKED'
                                    ? 'Linked existing transaction'
                                    : 'Created transaction'}
                                </Badge>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className='flex items-center justify-between md:flex-col md:items-end'>
                        <p className='text-sm font-medium text-muted-foreground'>
                          Expected day {plannedIncome.expectedDayOfMonth}
                        </p>
                        <p className='font-mono text-base font-semibold tracking-tight text-success'>
                          {formatMoney(formatter, plannedIncome.amount)}
                        </p>
                      </div>
                    </div>

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
                        <form
                          action={markIncomeReceivedAction}
                          className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] min-[1280px]:max-[1479px]:grid-cols-2!'
                        >
                          <input
                            type='hidden'
                            name='plannedIncomeId'
                            value={plannedIncome.id}
                          />
                          <input type='hidden' name='month' value={selectedMonth} />
                          <div className='space-y-1.5'>
                            <label
                              className='text-xs font-medium text-muted-foreground'
                              htmlFor={`received-date-${plannedIncome.id}`}
                            >
                              Received date
                            </label>
                            <Input
                              id={`received-date-${plannedIncome.id}`}
                              name='localDate'
                              type='date'
                              defaultValue={plannedIncome.defaultReceivedLocalDate}
                              required
                            />
                          </div>
                          <div className='space-y-1.5'>
                            <label
                              className='text-xs font-medium text-muted-foreground'
                              htmlFor={`received-amount-${plannedIncome.id}`}
                            >
                              Amount
                            </label>
                            <Input
                              id={`received-amount-${plannedIncome.id}`}
                              name='amount'
                              type='text'
                              inputMode='decimal'
                              defaultValue={plannedIncome.amount.toString()}
                              required
                            />
                          </div>
                          <button
                            className={cn(
                              buttonVariants({ size: 'default' }),
                              'self-end min-[1280px]:max-[1479px]:col-span-2!'
                            )}
                            type='submit'
                          >
                            Mark received
                          </button>
                        </form>
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
                          <form
                            action={linkExistingIncomeTransactionAction}
                            className='grid gap-3 border-t border-border/70 sm:grid-cols-[minmax(0,1fr)_auto]'
                          >
                            <input
                              type='hidden'
                              name='plannedIncomeId'
                              value={plannedIncome.id}
                            />
                            <input type='hidden' name='month' value={selectedMonth} />
                            <div className='space-y-1.5'>
                              <label
                                className='text-xs font-medium text-muted-foreground'
                                htmlFor={`link-income-transaction-${plannedIncome.id}`}
                              >
                                Link existing transaction
                              </label>
                              <Select
                                id={`link-income-transaction-${plannedIncome.id}`}
                                name='transactionId'
                                defaultValue={plannedIncome.linkCandidates[0]?.id ?? ''}
                                required
                              >
                                {plannedIncome.linkCandidates.map(candidate => (
                                  <option key={candidate.id} value={candidate.id}>
                                    {getLinkCandidateLabel(formatter, candidate, plannedIncome)}
                                  </option>
                                ))}
                              </Select>
                            </div>
                            <button
                              className={cn(
                                buttonVariants({ variant: 'outline', size: 'sm' }),
                                'self-end'
                              )}
                              type='submit'
                            >
                              Link transaction
                            </button>
                          </form>
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
              <div className='flex flex-wrap gap-2'>
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
                    <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
                      <div className='flex min-w-0 items-start gap-3'>
                        <div className='mt-1 flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground'>
                          <CalendarClock className='size-4.5' />
                        </div>
                        <div className='flex min-w-0 flex-col'>
                          <div className='flex flex-wrap items-center gap-2'>
                            <h3 className='text-sm font-semibold text-foreground'>
                              {plannedBill.category.name}
                            </h3>
                            {plannedBill.status !== 'upcoming' ? (
                              <Badge variant={statusMeta.variant}>
                                {statusMeta.label}
                              </Badge>
                            ) : null}
                            {plannedBill.category.isArchived ? (
                              <Badge variant='outline'>Archived category</Badge>
                            ) : null}
                          </div>
                          {plannedBill.subcategory ? (
                            <p className='truncate text-sm leading-6 text-muted-foreground'>
                              {plannedBill.subcategory.name}
                            </p>
                          ) : null}
                          {plannedBill.occurrence?.paidAtLocalDate ? (
                            <div className='flex flex-wrap items-center gap-2'>
                              <p className='text-xs font-medium text-muted-foreground'>
                                Paid {formatLocalDate(plannedBill.occurrence.paidAtLocalDate)}
                              </p>
                              {plannedBill.occurrence.paymentSource ? (
                                <Badge variant='outline'>
                                  {plannedBill.occurrence.paymentSource === 'LINKED'
                                    ? 'Linked existing transaction'
                                    : 'Created transaction'}
                                </Badge>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className='flex items-center justify-between md:flex-col md:items-end'>
                        <p className='text-sm font-medium text-muted-foreground'>
                          {formatLocalDate(
                            `${selectedMonth}-${String(
                              plannedBill.dueDayOfMonth
                            ).padStart(2, '0')}`
                          )}
                        </p>
                        <p className='font-mono text-base font-semibold tracking-tight text-foreground'>
                          {formatMoney(formatter, plannedBill.amount)}
                        </p>
                      </div>
                    </div>

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
                      <div className='grid gap-3 border-t border-border/70 pt-4'>
                        <form
                          action={markPaidAction}
                           className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] min-[1280px]:max-[1479px]:grid-cols-2!'
                        >
                          <input
                            type='hidden'
                            name='plannedBillId'
                            value={plannedBill.id}
                          />
                          <input type='hidden' name='month' value={selectedMonth} />
                          <div className='space-y-1.5'>
                            <label
                              className='text-xs font-medium text-muted-foreground'
                              htmlFor={`paid-date-${plannedBill.id}`}
                            >
                              Payment date
                            </label>
                            <Input
                              id={`paid-date-${plannedBill.id}`}
                              name='localDate'
                              type='date'
                              defaultValue={plannedBill.defaultPaymentLocalDate}
                              required
                            />
                          </div>
                          <div className='space-y-1.5'>
                            <label
                              className='text-xs font-medium text-muted-foreground'
                              htmlFor={`paid-amount-${plannedBill.id}`}
                            >
                              Amount
                            </label>
                            <Input
                              id={`paid-amount-${plannedBill.id}`}
                              name='amount'
                              type='text'
                              inputMode='decimal'
                              defaultValue={plannedBill.amount.toString()}
                              required
                            />
                          </div>
                          <button
                            className={cn(
                              buttonVariants({ size: 'default' }),
                               'self-end min-[1280px]:max-[1479px]:col-span-2!'
                            )}
                            type='submit'
                          >
                            Mark paid
                          </button>
                        </form>
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
                          <form
                            action={linkExistingTransactionAction}
                            className='grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-[minmax(0,1fr)_auto]'
                          >
                            <input
                              type='hidden'
                              name='plannedBillId'
                              value={plannedBill.id}
                            />
                            <input type='hidden' name='month' value={selectedMonth} />
                            <div className='space-y-1.5'>
                              <label
                                className='text-xs font-medium text-muted-foreground'
                                htmlFor={`link-transaction-${plannedBill.id}`}
                              >
                                Link existing transaction
                              </label>
                              <Select
                                id={`link-transaction-${plannedBill.id}`}
                                name='transactionId'
                                defaultValue={plannedBill.linkCandidates[0]?.id ?? ''}
                                required
                              >
                                {plannedBill.linkCandidates.map(candidate => (
                                  <option key={candidate.id} value={candidate.id}>
                                    {getLinkCandidateLabel(formatter, candidate, plannedBill)}
                                  </option>
                                ))}
                              </Select>
                            </div>
                            <button
                              className={cn(
                                buttonVariants({ variant: 'outline', size: 'sm' }),
                                'self-end'
                              )}
                              type='submit'
                            >
                              Link transaction
                            </button>
                          </form>
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
