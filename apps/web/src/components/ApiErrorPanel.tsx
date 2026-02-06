'use client'
import React from 'react'

export function ApiErrorPanel({ error }: { error: any }) {
  const status = error?.status
  const requiredRoles = error?.body?.requiredRoles

  if (status === 401) {
    return (
      <div className="p-3 rounded-lg border bg-amber-50">
        <div className="font-medium">Not signed in (401)</div>
        <div className="text-sm text-gray-700">Please sign in via Keycloak.</div>
      </div>
    )
  }

  if (status === 403) {
    return (
      <div className="p-3 rounded-lg border bg-red-50">
        <div className="font-medium">Access denied (403)</div>
        <div className="text-sm text-gray-700">Your role doesn't permit this action.</div>
        {requiredRoles && (
          <div className="text-xs text-gray-600 mt-2">
            Required roles: {Array.isArray(requiredRoles) ? requiredRoles.join(', ') : String(requiredRoles)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-3 rounded-lg border bg-white">
      <div className="font-medium">Request failed</div>
      <div className="text-sm text-gray-700">{error?.message ?? 'Unknown error'}</div>
    </div>
  )
}
