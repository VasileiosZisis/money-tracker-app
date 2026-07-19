import { History, PencilLine, Trash2, X } from 'lucide-react'
import Link from 'next/link'

import type {
  DashboardBalanceQueryParams,
  DashboardTotalBalanceData
} from '@/actions/dashboard'
import { BalanceAdjustmentCreateDisclosure } from '@/components/dashboard/balance-adjustment-create-disclosure'
import { BalanceAdjustmentFormFields } from '@/components/dashboard/balance-adjustment-form-fields'
import { TotalBalanceChart } from '@/components/dashboard/total-balance-chart'
import { TotalBalancePeriodControls } from '@/components/dashboard/total-balance-period-controls'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageNotice } from '@/components/ui/page-notice'
import { Separator } from '@/components/ui/separator'
import { formatMonthLabel } from '@/lib/dates/month'
import { cn } from '@/lib/utils'

type TotalBalanceSectionProps = {
  currency: string
  month: string
  data: DashboardTotalBalanceData
  adjustmentState?: string
  adjustmentNotFound: boolean
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
  adjustmentNotFound,
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
    summary?.monthlyBalances.map(point => ({
      month: point.month,
      endingBalance: Number(point.endingBalance.toString())
    })) ?? []
  const endingBalanceClassName = summary?.endingBalance.lt(0)
    ? 'text-destructive'
    : 'text-foreground'
  const netChangeClassName = summary?.netChange.lt(0)
    ? 'text-destructive'
    : summary?.netChange.gt(0)
    ? 'text-success'
    : 'text-foreground'
  const closeAdjustmentHref = buildDashboardHref({
    month,
    balanceQuery: data.queryParams
  })
  const manageAdjustmentsHref = buildDashboardHref({
    month,
    balanceQuery: data.queryParams,
    balanceAdjustment: 'manage'
  })
  const editingAdjustment = data.adjustments.find(
    adjustment => adjustment.id === adjustmentState
  )

  return (
    <section
      aria-labelledby='total-balance-heading'
      className='flex flex-col gap-4'
    >
      <div className='flex flex-col gap-4'>
        <div className='flex flex-col gap-1.5'>
          <h2
            id='total-balance-heading'
            className='text-3xl font-semibold tracking-tight text-foreground md:text-4xl'
          >
            Total Balance
          </h2>
        </div>
      </div>

      <TotalBalancePeriodControls
        month={month}
        query={data.queryParams}
        latestCompletedMonth={data.latestCompletedMonth}
      />

      {data.validationError ? (
        <PageNotice variant='error' title='Invalid Total Balance period'>
          {data.validationError} Showing the current-year range instead.
        </PageNotice>
      ) : null}

      <Card className='overflow-hidden'>
        <CardContent className='flex flex-col gap-5 p-5'>
          {summary ? (
            <div className='flex flex-col gap-5'>
              <div className='flex flex-col gap-5'>
                <div className='flex flex-col gap-3'>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Ending balance
                  </p>
                  <p
                    className={cn(
                      'font-mono text-4xl font-semibold tracking-tight',
                      endingBalanceClassName
                    )}
                  >
                    {formatter.format(Number(summary.endingBalance.toString()))}
                  </p>
                </div>

                <div className='flex flex-row items-start gap-6'>
                  <div className='flex flex-col'>
                    <p className='text-sm font-medium text-muted-foreground'>
                      Starting balance
                    </p>
                    <p className='font-mono text-xl font-semibold tracking-tight text-foreground'>
                      {formatter.format(
                        Number(summary.startingBalance.toString())
                      )}
                    </p>
                  </div>

                  <div className='flex flex-col'>
                    <p className='text-sm font-medium text-muted-foreground'>
                      Net change
                    </p>
                    <p
                      className={cn(
                          'font-mono text-xl font-semibold tracking-tight',
                        netChangeClassName
                      )}
                    >
                      {summary.netChange.gt(0) ? '+' : ''}
                      {formatter.format(Number(summary.netChange.toString()))}
                    </p>
                  </div>
                </div>
              </div>

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
            currency={currency}
            month={month}
            latestCompletedMonth={data.latestCompletedMonth}
            initialOpen={adjustmentState === 'add'}
            manageHref={manageAdjustmentsHref}
            createAdjustmentAction={createAdjustmentAction}
          >

            {adjustmentState && adjustmentState !== 'add' ? (
              <>
                <Separator />

                <div className='flex flex-col gap-4'>
                <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                  <div className='flex flex-col gap-1.5'>
                    <h3 className='text-base font-semibold text-foreground'>
                      Balance adjustments
                    </h3>
                    <p className='max-w-2xl text-sm leading-6 text-muted-foreground'>
                      Review money added directly to historical balance. These
                      entries never become income transactions.
                    </p>
                  </div>
                  <Link
                    href={closeAdjustmentHref}
                    className={buttonVariants({
                      variant: 'ghost',
                      size: 'sm'
                    })}
                  >
                    <X data-icon='inline-start' />
                    Close
                  </Link>
                </div>

                  {adjustmentNotFound ? (
                    <PageNotice variant='error' title='Adjustment unavailable'>
                      Balance adjustment not found.
                    </PageNotice>
                  ) : null}

                  {data.adjustments.length === 0 ? (
                    <EmptyState
                      icon={History}
                      title='No balance adjustments yet'
                      description='Add an opening balance or previously untracked money to include it in completed-month history.'
                    />
                  ) : (
                    <div className='flex flex-col gap-3'>
                      {data.adjustments.map(adjustment => {
                        const isEditing =
                          editingAdjustment?.id === adjustment.id

                        return (
                          <div
                            key={adjustment.id}
                            className='flex flex-col gap-3 rounded-xl border border-border/70 bg-background/60 p-4'
                          >
                            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                              <div className='flex min-w-0 flex-col gap-1.5'>
                                <div className='flex flex-wrap items-center gap-2'>
                                  <p className='font-mono text-lg font-semibold text-foreground'>
                                    {formatter.format(
                                      Number(adjustment.amount)
                                    )}
                                  </p>
                                  <Badge variant='outline'>
                                    {formatMonthLabel(
                                      adjustment.effectiveMonth
                                    )}
                                  </Badge>
                                </div>
                                <p className='whitespace-pre-wrap wrap-break-word text-sm leading-6 text-muted-foreground'>
                                  {adjustment.note ?? 'No note'}
                                </p>
                              </div>
                              <Link
                                href={buildDashboardHref({
                                  month,
                                  balanceQuery: data.queryParams,
                                  balanceAdjustment: isEditing
                                    ? 'manage'
                                    : adjustment.id
                                })}
                                className={buttonVariants({
                                  variant: 'outline',
                                  size: 'sm'
                                })}
                              >
                                <PencilLine data-icon='inline-start' />
                                {isEditing ? 'Close edit' : 'Edit'}
                              </Link>
                            </div>

                            {isEditing ? (
                              <>
                                <Separator />
                                <form
                                  action={updateAdjustmentAction}
                                  className='flex flex-col gap-4'
                                >
                                  <input
                                    type='hidden'
                                    name='month'
                                    value={month}
                                  />
                                  <input
                                    type='hidden'
                                    name='id'
                                    value={adjustment.id}
                                  />
                                  <BalanceAdjustmentFormFields
                                    idPrefix={`edit-balance-adjustment-${adjustment.id}`}
                                    currency={currency}
                                    latestCompletedMonth={
                                      data.latestCompletedMonth
                                    }
                                    defaultValues={{
                                      amount: adjustment.amount,
                                      effectiveMonth: adjustment.effectiveMonth,
                                      note: adjustment.note ?? ''
                                    }}
                                  />
                                  <div className='flex flex-wrap justify-end gap-3'>
                                    <Link
                                      href={manageAdjustmentsHref}
                                      className={buttonVariants({
                                        variant: 'outline'
                                      })}
                                    >
                                      Cancel
                                    </Link>
                                    <Button
                                      type='submit'
                                      formAction={deleteAdjustmentAction}
                                      variant='destructive'
                                    >
                                      <Trash2 data-icon='inline-start' />
                                      Delete adjustment
                                    </Button>
                                    <Button type='submit'>Save changes</Button>
                                  </div>
                                </form>
                              </>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </BalanceAdjustmentCreateDisclosure>
        </CardContent>
      </Card>
    </section>
  )
}
