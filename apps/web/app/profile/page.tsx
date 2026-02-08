'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { useWhoAmI } from '@/hooks/useWhoAmI'
import { StatusBadge } from '@/components/StatusBadge'
import { ApiErrorPanel } from '@/components/ApiErrorPanel'
import { FeatureSection } from '@/components/FeatureSection'

export default function ProfilePage() {
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const whoAmI = useWhoAmI()

  const isAuthenticated = sessionStatus === 'authenticated' && whoAmI.data?.authenticated
  const user = whoAmI.data?.user

  const getRoleTier = (roles: string[]) => {
    if (roles.includes('CHRONOSOPS_ADMIN')) return { label: 'Admin', color: 'bg-red-100 text-red-800 border-red-300' }
    if (roles.includes('CHRONOSOPS_ANALYST')) return { label: 'Analyst', color: 'bg-blue-100 text-blue-800 border-blue-300' }
    if (roles.includes('CHRONOSOPS_VIEWER')) return { label: 'Viewer', color: 'bg-green-100 text-green-800 border-green-300' }
    return { label: 'None', color: 'bg-gray-100 text-gray-800 border-gray-300' }
  }

  const roleTier = user ? getRoleTier(user.roles) : null

  if (!isAuthenticated) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="rounded-xl border bg-white p-6 text-center">
          <div className="text-lg font-medium text-gray-900 mb-2">Not Authenticated</div>
          <div className="text-sm text-gray-600 mb-4">
            Please sign in to view your profile
          </div>
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">User Profile</h1>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
        >
          Sign Out
        </button>
      </div>

      {whoAmI.isError && (
        <div className="mb-6">
          <ApiErrorPanel error={whoAmI.error} />
        </div>
      )}

      {user && (
        <div className="space-y-6">
          {/* User Information */}
          <FeatureSection
            title="User Information"
            icon="👤"
            description="Your account details and authentication status"
          >
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">Email</div>
                <div className="text-sm font-medium text-gray-900">
                  {user.email || 'Not provided'}
                </div>
              </div>
              {user.name && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Name</div>
                  <div className="text-sm font-medium text-gray-900">{user.name}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-gray-500 mb-1">User ID</div>
                <div className="text-xs font-mono text-gray-700 break-all">{user.sub}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Authentication Status</div>
                <StatusBadge status="analyzed" className="text-xs" />
              </div>
            </div>
          </FeatureSection>

          {/* Role Information */}
          <FeatureSection
            title="Role & Permissions"
            icon="🔐"
            description="Your assigned roles and access level"
          >
            <div className="space-y-4">
              <div>
                <div className="text-xs text-gray-500 mb-2">Primary Role</div>
                {roleTier && (
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${roleTier.color}`}>
                    {roleTier.label}
                  </span>
                )}
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-2">All Roles</div>
                <div className="flex flex-wrap gap-2">
                  {user.roles.map((role) => (
                    <span
                      key={role}
                      className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-mono"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>
              <div className="pt-4 border-t">
                <div className="text-xs text-gray-500 mb-2">Access Permissions</div>
                <ul className="space-y-1 text-xs text-gray-700">
                  {user.roles.includes('CHRONOSOPS_VIEWER') && (
                    <li className="flex items-center gap-2">
                      <span className="text-green-600">✓</span>
                      <span>View incidents, analyses, and postmortems</span>
                    </li>
                  )}
                  {user.roles.includes('CHRONOSOPS_ANALYST') && (
                    <li className="flex items-center gap-2">
                      <span className="text-green-600">✓</span>
                      <span>Start investigations and create analyses</span>
                    </li>
                  )}
                  {user.roles.includes('CHRONOSOPS_ADMIN') && (
                    <li className="flex items-center gap-2">
                      <span className="text-green-600">✓</span>
                      <span>Full access including sensitive data and audit logs</span>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </FeatureSection>

          {/* Session Information */}
          {session && (
            <FeatureSection
              title="Session Information"
              icon="🔑"
              description="Current authentication session details"
            >
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Session Status:</span>
                  <StatusBadge status="analyzed" />
                </div>
                {session.user?.email && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Session Email:</span>
                    <span className="font-medium text-gray-900">{session.user.email}</span>
                  </div>
                )}
                {session.user?.name && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Session Name:</span>
                    <span className="font-medium text-gray-900">{session.user.name}</span>
                  </div>
                )}
              </div>
            </FeatureSection>
          )}

          {/* Quick Actions */}
          <FeatureSection
            title="Quick Actions"
            icon="⚡"
            description="Common actions and navigation"
          >
            <div className="grid md:grid-cols-2 gap-3">
              <button
                onClick={() => router.push('/incidents')}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 text-left"
              >
                <div className="font-medium">View Incidents</div>
                <div className="text-xs text-gray-500">Browse all incidents</div>
              </button>
              <button
                onClick={() => router.push('/analyze')}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 text-left"
              >
                <div className="font-medium">Create Incident</div>
                <div className="text-xs text-gray-500">Start new analysis</div>
              </button>
              <button
                onClick={() => router.push('/exports')}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 text-left"
              >
                <div className="font-medium">Exports</div>
                <div className="text-xs text-gray-500">Download postmortems</div>
              </button>
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 text-left"
              >
                <div className="font-medium">Home</div>
                <div className="text-xs text-gray-500">Return to dashboard</div>
              </button>
            </div>
          </FeatureSection>
        </div>
      )}
    </div>
  )
}
