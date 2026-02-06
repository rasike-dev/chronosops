'use client'

import React from 'react'
import { signIn, signOut, useSession } from "next-auth/react"
import { useWhoAmI } from '@/hooks/useWhoAmI'

function roleTier(roles: string[]) {
  if (roles.includes('CHRONOSOPS_ADMIN')) return 'Admin'
  if (roles.includes('CHRONOSOPS_ANALYST')) return 'Analyst'
  if (roles.includes('CHRONOSOPS_VIEWER')) return 'Viewer'
  return 'None'
}

export function AuthStatusBar() {
  const { status: sessionStatus, data: sessionData } = useSession()
  const q = useWhoAmI()
  
  const authed = sessionStatus === "authenticated"
  const roles = q.data?.user?.roles ?? []
  const tier = roleTier(roles)

  const status =
    sessionStatus === "loading" ? 'Checking…' :
    authed ? 'Signed in' : 'Not signed in'

  return (
    <div className="w-full border-b bg-white/70 backdrop-blur px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Auth:</span>
        <span className="text-sm">{status}</span>

        {authed && (
          <>
            {q.data?.authenticated && (
              <>
                <span className="text-xs px-2 py-1 rounded-full border">{tier}</span>
                <span className="text-xs text-gray-600">
                  {q.data.user?.email ?? q.data.user?.sub ?? sessionData?.user?.email ?? sessionData?.user?.name}
                </span>
              </>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {authed ? (
          <button className="text-xs underline text-gray-600" onClick={() => signOut({ callbackUrl: "/" })}>
            Sign out
          </button>
        ) : (
          <button className="text-xs underline text-gray-600" onClick={() => signIn("keycloak")}>
            Sign in
          </button>
        )}
        <a className="text-xs underline text-gray-600" href="http://localhost:8088" target="_blank" rel="noreferrer">
          Keycloak
        </a>
      </div>
    </div>
  )
}
