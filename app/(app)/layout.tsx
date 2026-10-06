import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AppSidebar } from '@/components/app-shell/app-sidebar'
import { PageContextBar } from '@/components/app-shell/page-context-bar'
import {
  getAuthenticatedUserPreferences,
  getSession
} from '@/lib/auth/session'
import { WorkspaceShell } from '@/components/app-shell/workspace-shell'
import { getAccountDateContext } from '@/lib/dates/time-zone'
import { privateRobots } from '@/lib/site/metadata'

export const metadata: Metadata = { robots: privateRobots }

function getDisplayName (
  name: string | null | undefined,
  email: string | null | undefined
) {
  if (name && name.trim().length > 0) {
    return name.trim()
  }

  if (email && email.trim().length > 0) {
    return email.trim()
  }

  return 'CashContour'
}

function getInitials (name: string) {
  const parts = name
    .split(' ')
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 2)

  if (parts.length === 0) {
    return 'CC'
  }

  if (name === 'CashContour') return 'CC'

  return parts.map(part => part[0]?.toUpperCase() ?? '').join('')
}

export default async function AppLayout ({
  children
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  const userId = session?.user?.id

  if (!userId) {
    redirect('/login')
  }

  const user = await getAuthenticatedUserPreferences()

  if (!user.hasCompletedSetup || !user.timeZone) {
    redirect('/setup')
  }

  const displayName = getDisplayName(session?.user?.name, session?.user?.email)
  const initials = getInitials(displayName)
  const userImage = session?.user?.image ?? null
  const dateContext = getAccountDateContext(user.timeZone)

  return (
    <WorkspaceShell
      sidebar={<AppSidebar displayName={displayName} initials={initials} userImage={userImage} />}
      contextBar={<PageContextBar key={`${user.timeZone}:${dateContext.localDate}`} initialDateContext={dateContext} timeZone={user.timeZone} />}
    >
      {children}
    </WorkspaceShell>
  )
}
