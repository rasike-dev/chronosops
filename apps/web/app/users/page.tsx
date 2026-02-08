'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { ApiErrorPanel } from '@/components/ApiErrorPanel'
import { FeatureSection } from '@/components/FeatureSection'

type UserActivity = {
  userId: string
  evidenceBundlesCreated: number
  investigationSessionsCreated: number
  totalActivity: number
}

type UsersActivityResponse = {
  totalUsers: number
  users: UserActivity[]
  summary: {
    totalEvidenceBundles: number
    totalInvestigationSessions: number
  }
}

export default function UsersPage() {
  const usersQuery = useQuery({
    queryKey: ['users-activity'],
    queryFn: () => apiGet<UsersActivityResponse>('/v1/users/activity'),
    staleTime: 30_000,
  })

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Users & Activity</h1>
        <p className="text-gray-600 mt-1">
          View all users who have created evidence bundles or investigation sessions.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Note: Users are managed externally via Keycloak. This page shows activity from JWT token subjects (user IDs).
        </p>
      </div>

      {usersQuery.isError && (
        <div className="mb-6">
          <ApiErrorPanel error={usersQuery.error} />
        </div>
      )}

      {usersQuery.isLoading && (
        <div className="text-sm text-gray-600">Loading users activity…</div>
      )}

      {usersQuery.isSuccess && usersQuery.data && (
        <>
          {/* Summary */}
          <FeatureSection
            title="Summary"
            icon="📊"
            description="Overall user activity statistics"
            className="mb-6"
          >
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-xs text-gray-500 mb-1">Total Users</div>
                <div className="text-2xl font-bold text-gray-900">{usersQuery.data.totalUsers}</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="text-xs text-gray-500 mb-1">Evidence Bundles</div>
                <div className="text-2xl font-bold text-gray-900">
                  {usersQuery.data.summary.totalEvidenceBundles}
                </div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="text-xs text-gray-500 mb-1">Investigation Sessions</div>
                <div className="text-2xl font-bold text-gray-900">
                  {usersQuery.data.summary.totalInvestigationSessions}
                </div>
              </div>
            </div>
          </FeatureSection>

          {/* Users List */}
          <FeatureSection
            title="User Activity"
            icon="👥"
            description="Users sorted by total activity"
            className="mb-6"
          >
            {usersQuery.data.users.length === 0 ? (
              <div className="text-sm text-gray-600 text-center py-8">
                No users have created any records yet.
              </div>
            ) : (
              <div className="rounded-xl border bg-white overflow-hidden">
                <div className="grid grid-cols-12 px-4 py-3 text-xs font-medium text-gray-500 border-b bg-gray-50">
                  <div className="col-span-1">#</div>
                  <div className="col-span-5">User ID</div>
                  <div className="col-span-2 text-center">Evidence Bundles</div>
                  <div className="col-span-2 text-center">Investigation Sessions</div>
                  <div className="col-span-2 text-center">Total Activity</div>
                </div>

                <div className="divide-y">
                  {usersQuery.data.users.map((user, idx) => (
                    <div key={user.userId} className="grid grid-cols-12 px-4 py-3 text-sm hover:bg-gray-50">
                      <div className="col-span-1 text-gray-500">{idx + 1}</div>
                      <div className="col-span-5">
                        <div className="font-mono text-xs text-gray-900 break-all">{user.userId}</div>
                      </div>
                      <div className="col-span-2 text-center text-gray-700">
                        {user.evidenceBundlesCreated}
                      </div>
                      <div className="col-span-2 text-center text-gray-700">
                        {user.investigationSessionsCreated}
                      </div>
                      <div className="col-span-2 text-center">
                        <span className="font-semibold text-gray-900">{user.totalActivity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </FeatureSection>

          {/* Info Box */}
          <div className="rounded-xl border bg-blue-50 p-4">
            <div className="text-sm">
              <div className="font-medium mb-2">How Users Work in ChronosOps:</div>
              <ul className="list-disc list-inside space-y-1 text-gray-700 text-xs">
                <li>Users are managed externally via Keycloak (OIDC provider)</li>
                <li>User information comes from JWT tokens (email, name, roles)</li>
                <li>User IDs (sub claim) are stored in <code className="bg-white px-1 rounded">createdBy</code> fields</li>
                <li>Roles: <code className="bg-white px-1 rounded">CHRONOSOPS_VIEWER</code>, <code className="bg-white px-1 rounded">CHRONOSOPS_ANALYST</code>, <code className="bg-white px-1 rounded">CHRONOSOPS_ADMIN</code></li>
                <li>To add users, create accounts in Keycloak and assign appropriate roles</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
