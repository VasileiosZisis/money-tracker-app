import { redirect } from 'next/navigation'

import { AppSidebar } from '@/components/app-shell/app-sidebar'
import { PageContextBar } from '@/components/app-shell/page-context-bar'
import { getSession } from '@/lib/auth/session'
import { SidebarProvider } from '@/components/ui/sidebar'
import { db } from '@/lib/db'

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

  return 'Money Tracker'
}

function getInitials (name: string) {
  const parts = name
    .split(' ')
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, 2)

  if (parts.length === 0) {
    return 'MT'
  }

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

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      hasCompletedSetup: true,
      currency: true
    }
  })

  if (!user) {
    redirect('/login')
  }

  if (!user.hasCompletedSetup) {
    redirect('/setup')
  }

  const displayName = getDisplayName(session?.user?.name, session?.user?.email)
  const initials = getInitials(displayName)
  const userImage = session?.user?.image ?? null

  return (
    <div className='min-h-screen'>
      <SidebarProvider>
        <div className='mx-auto flex min-h-screen gap-3 px-3 py-3 sm:px-5 lg:gap-5 lg:py-0 lg:pr-5 lg:pl-0'>
          <AppSidebar
            displayName={displayName}
            initials={initials}
            userImage={userImage}
          />

          <main className='flex min-w-0 flex-1 flex-col gap-3 pb-5 lg:gap-5'>
            <PageContextBar />

            <div className='mx-auto flex w-full flex-col gap-5'>
              {children}
            </div>
          </main>
        </div>
      </SidebarProvider>
    </div>
  )
}
