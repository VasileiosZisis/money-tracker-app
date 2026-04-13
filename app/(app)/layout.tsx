import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AppSidebar } from '@/components/app-shell/app-sidebar'
import { getSession } from '@/lib/auth/session'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
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
        <div className='mx-auto flex min-h-screen gap-4 px-4 py-4 sm:px-6 lg:gap-6 lg:px-6 lg:py-6'>
          <AppSidebar
            displayName={displayName}
            initials={initials}
            userImage={userImage}
          />

          <SidebarInset className='flex min-w-0 flex-1 flex-col gap-4 lg:gap-6'>
            <main className='flex-1 pb-6'>
              <div className='mb-4 flex items-center gap-3 lg:hidden'>
                <SidebarTrigger />
                <Link
                  href='/dashboard'
                  className='text-base font-semibold tracking-tight text-foreground'
                >
                  Money Tracker
                </Link>
              </div>

              <div className='mx-auto w-full space-y-8'>
                {children}
              </div>
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  )
}
