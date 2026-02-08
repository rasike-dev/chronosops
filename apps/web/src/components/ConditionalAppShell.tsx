'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { AppShell } from './AppShell'

export function ConditionalAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isStandalonePage = pathname === '/login' || pathname === '/profile'

  if (isStandalonePage) {
    return <>{children}</>
  }

  return <AppShell>{children}</AppShell>
}
