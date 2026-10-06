import { SummaryValues } from '@/components/dashboard/summary-card'
import { SectionHeading } from '@/components/app-shell/section-heading'
import { History } from 'lucide-react'

import type {
  DashboardBalanceQueryParams,
  DashboardTotalBalanceData
} from '@/actions/dashboard'
import { BalanceAdjustmentCreateDisclosure } from '@/components/dashboard/balance-adjustment-create-disclosure'
import { TotalBalanceChart } from '@/components/dashboard/total-balance-chart'
import { TotalBalancePeriodControls } from '@/components/dashboard/total-balance-period-controls'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageNotice } from '@/components/ui/page-notice'
import { formatMonthLabel } from '@/lib/dates/month'

type TotalBalanceSectionProps = {
  currency: string
  month: string
  data: DashboardTotalBalanceData
  adjustmentState?: string
  createAdjustmentAction: (formData: FormData) => Promise<void>
  updateAdjustmentAction: (formData: FormData) => Promise<void>
  deleteAdjustmentAction: (formData: FormData) => Promise<void>
}

function buildDashboardHref (params: {
  month: string
  balanceQuery: DashboardBalanceQueryParams
  balanceAdjustment?: string
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

  return `/dashboard?${searchParams.toString()}`
}

export function TotalBalanceSection ({
  currency,
  month,
  data,
  adjustmentState,
  createAdjustmentAction,
  updateAdjustmentAction,
  deleteAdjustmentAction
}: TotalBalanceSectionProps) {
  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency
  })
  const summary = data.summary
  const chartData =
    summary?.monthlyBalances.map((point, index) => {
      const previousEndingBalance =
        index === 0
          ? summary.startingBalance
          : summary.monthlyBalances[index - 1].endingBalance

      return {
        month: point.month,
        endingBalance: Number(point.endingBalance.toString()),
        balanceChange: Number(
          point.endingBalance.minus(previousEndingBalance).toString()
        )
      }
    }) ?? []
  const closeAdjustmentHref = buildDashboardHref({
    month,
    balanceQuery: data.queryParams
  })
  const manageAdjustmentsHref = buildDashboardHref({
    month,
    balanceQuery: data.queryParams,
    balanceAdjustment: 'manage'
  })
  const addAdjustmentHref = buildDashboardHref({
    month,
    balanceQuery: data.queryParams,
    balanceAdjustment: 'add'
  })

  return (
    <section
      aria-labelledby='total-balance-heading'
      className='flex flex-col gap-4'
    >
      <div className='flex flex-col gap-4'>
        <div className='flex flex-col gap-1.5'>
          <SectionHeading id="total-balance-heading" title="Total Balance" />
        </div>
      </div>

      <TotalBalancePeriodControls
        month={month}
        query={data.queryParams}
        latestCompletedMonth={data.latestCompletedMonth}
      />

      {data.validationError ? (
        <PageNotice variant='error' title='Invalid Total Balance period'>
          {data.validationError} Showing the all-time range instead.
        </PageNotice>
      ) : null}

      <Card className='overflow-hidden'>
        <CardContent className='flex flex-col gap-5 p-4'>
          {summary ? (
            <div className='flex flex-col gap-5'>
              <SummaryValues primary={{ label: 'Ending balance', value: formatter.format(Number(summary.endingBalance.toString())), tone: summary.endingBalance.lt(0) ? 'danger' : 'default' }} secondary={[
                { label: 'Starting balance', value: formatter.format(Number(summary.startingBalance.toString())) },
                { label: 'Net change', value: `${summary.netChange.gt(0) ? '+' : ''}${formatter.format(Number(summary.netChange.toString()))}`, tone: summary.netChange.lt(0) ? 'danger' : summary.netChange.gt(0) ? 'success' : 'default' }
              ]} />

              <TotalBalanceChart currency={currency} data={chartData} />
            </div>
          ) : data.emptyReason === 'NO_COMPLETED_HISTORY' ? (
            <EmptyState
              icon={History}
              title='No completed balance history yet'
              description='Completed transactions or an opening balance will create the first monthly balance point.'
            />
          ) : (
            <EmptyState
              icon={History}
              title='No completed months in this range'
              description='The current-year view becomes available after the first month of the year closes.'
            />
          )}

          <BalanceAdjustmentCreateDisclosure
            addHref={addAdjustmentHref}
            adjustments={data.adjustments.map(adjustment => ({
              id: adjustment.id,
              amount: adjustment.amount,
              effectiveMonth: adjustment.effectiveMonth,
              editHref: buildDashboardHref({
                month,
                balanceQuery: data.queryParams,
                balanceAdjustment: adjustment.id
              }),
              formattedAmount: formatter.format(Number(adjustment.amount)),
              formattedMonth: formatMonthLabel(adjustment.effectiveMonth),
              note: adjustment.note
            }))}
            closeHref={closeAdjustmentHref}
            createAdjustmentAction={createAdjustmentAction}
            currency={currency}
            deleteAdjustmentAction={deleteAdjustmentAction}
            initialState={adjustmentState}
            latestCompletedMonth={data.latestCompletedMonth}
            manageHref={manageAdjustmentsHref}
            month={month}
            updateAdjustmentAction={updateAdjustmentAction}
          />
        </CardContent>
      </Card>
    </section>
  )
}
