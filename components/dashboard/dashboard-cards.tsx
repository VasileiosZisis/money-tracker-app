import type * as React from "react";
import { CircleAlert, CircleCheckBig } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { DashboardAttentionItem } from "@/lib/dashboard/attention";

export type MetricTone = 'default' | 'success' | 'warning' | 'danger';
export type AttentionItem = DashboardAttentionItem;
type AttentionTone = AttentionItem['tone'];
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

export function MetricCard ({
  title,
  value,
  tone = 'default',
  icon,
  badgeLabel,
  badgeVariant = 'outline',
  badgePlacement = 'below',
  className
}: {
  title: string
  value: string
  tone?: MetricTone
  icon: React.ReactNode
  badgeLabel?: string
  badgeVariant?: 'accent' | 'success' | 'warning' | 'destructive' | 'outline'
  badgePlacement?: 'below' | 'title'
  className?: string
}) {
  const toneStyles = getToneStyles(tone)
  const valueElement = (
    <p
      className={cn(
        'font-mono text-2xl font-semibold tracking-tight',
        toneStyles.textClassName
      )}
    >
      {value}
    </p>
  )
  const iconElement = (
    <div
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg',
        toneStyles.iconClassName
      )}
    >
      {icon}
    </div>
  )
  const badgeElement = badgeLabel ? (
    <Badge
      variant={badgeVariant}
      className={cn(
        badgePlacement === 'below' && 'self-start',
        badgePlacement === 'title' &&
          'shrink-0 whitespace-nowrap px-1.5'
      )}
    >
      {badgeLabel}
    </Badge>
  ) : null

  return (
    <Card className={cn('h-full min-w-0', className)}>
      <CardContent className='flex h-full flex-col gap-4 p-4'>
        <div className='flex items-center justify-between gap-3'>
          <div className='min-w-0 space-y-1.5'>
            {badgePlacement === 'title' ? (
              <div className='flex min-w-0 flex-wrap items-center gap-1.5 sm:flex-nowrap sm:whitespace-nowrap'>
                <p className='shrink-0 text-sm font-medium text-muted-foreground'>
                  {title}
                </p>
                {badgeElement}
              </div>
            ) : (
              <p className='text-sm font-medium text-muted-foreground'>
                {title}
              </p>
            )}
            {valueElement}
          </div>
          {iconElement}
        </div>
        {badgePlacement === 'below' ? badgeElement : null}
      </CardContent>
    </Card>
  )
}

export function NeedsAttentionSection ({
  items
}: {
  items: AttentionItem[]
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
      <CardContent className='grid gap-4 p-3 md:grid-cols-2'>
        {items.length === 0 ? (
          <EmptyState
            className='md:col-span-2'
            icon={CircleCheckBig}
            title='Nothing needs attention'
            description='Your planned items and forecast are currently up to date.'
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

