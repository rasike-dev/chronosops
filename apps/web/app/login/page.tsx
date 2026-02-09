'use client'

import React from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useWhoAmI } from '@/hooks/useWhoAmI'
import { StatusBadge } from '@/components/StatusBadge'

export default function LoginPage() {
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const whoAmI = useWhoAmI()

  const isAuthenticated = sessionStatus === 'authenticated'
  const isLoading = sessionStatus === 'loading' || whoAmI.isLoading

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated && whoAmI.data?.authenticated) {
      router.push('/')
    }
  }, [isAuthenticated, whoAmI.data?.authenticated, router])

  const handleSignIn = () => {
    signIn('keycloak', { callbackUrl: '/' })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">ChronosOps</h1>
            <p className="text-gray-600">Enterprise Autonomous SRE Platform</p>
            <p className="text-sm text-gray-500 mt-2">
              Powered by Gemini 3 Flash Preview
            </p>
          </div>

          {/* Status */}
          {isLoading && (
            <div className="text-center py-4">
              <div className="text-sm text-gray-600">Checking authentication...</div>
            </div>
          )}

          {!isLoading && isAuthenticated && whoAmI.data?.authenticated && (
            <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-sm font-medium text-green-900 mb-2">✓ Already Signed In</div>
              <div className="text-xs text-green-700">
                Redirecting to dashboard...
              </div>
            </div>
          )}

          {!isLoading && !isAuthenticated && (
            <>
              {/* Login Form */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Sign In</h2>
                  <p className="text-sm text-gray-600 mb-4">
                    Choose your authentication method
                  </p>
                </div>

                {/* SSO Login Panel */}
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">Single Sign-On (SSO)</h3>
                    <p className="text-xs text-gray-600">Sign in with Keycloak</p>
                  </div>
                  <button
                    onClick={handleSignIn}
                    disabled={isLoading}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Sign in with Keycloak
                  </button>
                </div>

                {/* Login Credentials Panel */}
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">Login Credentials</h3>
                    <p className="text-xs text-gray-600">Quick access for development</p>
                  </div>
                  <div className="bg-white p-3 rounded border border-gray-200">
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600 font-medium">Username:</span>
                        <span className="font-mono text-gray-900 font-semibold">dev-admin</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600 font-medium">Password:</span>
                        <span className="font-mono text-gray-900 font-semibold">devpass</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>For production access:</div>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Use Keycloak SSO</li>
                      <li>Create a test user account</li>
                      <li>Assign appropriate roles (Viewer, Analyst, Admin)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* User Info (if authenticated) */}
          {!isLoading && isAuthenticated && whoAmI.data?.authenticated && whoAmI.data.user && (
            <div className="mt-6 pt-6 border-t">
              <div className="text-sm font-medium text-gray-900 mb-3">User Information</div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium text-gray-900">
                    {whoAmI.data.user.email || whoAmI.data.user.sub}
                  </span>
                </div>
                {whoAmI.data.user.name && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Name:</span>
                    <span className="font-medium text-gray-900">{whoAmI.data.user.name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">User ID:</span>
                  <span className="font-mono text-xs text-gray-700">{whoAmI.data.user.sub}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Roles:</span>
                  <div className="flex gap-1">
                    {whoAmI.data.user.roles.map((role) => (
                      <StatusBadge
                        key={role}
                        status={role.replace('CHRONOSOPS_', '').toLowerCase() as any}
                        className="text-xs"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <div>ChronosOps — Enterprise Autonomous SRE</div>
          <div className="mt-1">Evidence-first incident investigation with explainable AI reasoning</div>
        </div>
      </div>
    </div>
  )
}
