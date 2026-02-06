'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AuthStatusBar } from './AuthStatusBar'
import { useWhoAmI } from '@/hooks/useWhoAmI'

type Role = 'CHRONOSOPS_VIEWER' | 'CHRONOSOPS_ANALYST' | 'CHRONOSOPS_ADMIN'

function hasAccess(userRoles: string[], required: Role[]) {
  if (userRoles.includes('CHRONOSOPS_ADMIN')) return true
  return required.some((r) => userRoles.includes(r))
}

const NAV = [
  { label: 'Home', href: '/', requires: [] as Role[] },
  { label: 'Incidents', href: '/incidents', requires: ['CHRONOSOPS_VIEWER'] as Role[] },
  { label: 'Analyze', href: '/analyze', requires: ['CHRONOSOPS_ANALYST'] as Role[] },
  { label: 'Scenarios', href: '/scenarios', requires: ['CHRONOSOPS_VIEWER'] as Role[] },
  { label: 'Exports', href: '/exports', requires: ['CHRONOSOPS_VIEWER'] as Role[] },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const q = useWhoAmI()
  const authed = !!q.data?.authenticated
  const roles = q.data?.user?.roles ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <AuthStatusBar />

      <div className="flex">
        <aside className="w-64 border-r bg-white min-h-[calc(100vh-44px)] p-4">
          <div className="text-sm font-semibold text-gray-800 mb-3">ChronosOps</div>

          <nav className="flex flex-col gap-1">
            {NAV.map((item) => {
              const active = pathname === item.href
              const allowed = item.requires.length === 0 || (authed && hasAccess(roles, item.requires))
              return allowed ? (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-lg text-sm ${
                    active ? 'bg-gray-100 font-medium' : 'hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </Link>
              ) : (
                <div
                  key={item.href}
                  className="px-3 py-2 rounded-lg text-sm text-gray-400 cursor-not-allowed"
                  title={`Requires ${item.requires.includes('CHRONOSOPS_ANALYST') ? 'Analyst+' : 'Viewer+'}`}
                >
                  {item.label}
                </div>
              )
            })}
          </nav>

          {!authed && !q.isLoading && (
            <div className="mt-4 text-xs text-gray-500">
              Not signed in. Use Keycloak token flow for now.
            </div>
          )}
        </aside>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
