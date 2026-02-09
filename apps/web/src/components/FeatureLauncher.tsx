'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useWhoAmI } from '@/hooks/useWhoAmI'

type Role = 'CHRONOSOPS_VIEWER' | 'CHRONOSOPS_ANALYST' | 'CHRONOSOPS_ADMIN'

type Feature = {
  title: string
  desc: string
  href: string
  requires: Role[]
  cta: string
}

const FEATURES: Feature[] = [
  { title: 'Incident Workspace', desc: 'Browse incidents, analyses, postmortems.', href: '/incidents', requires: ['CHRONOSOPS_VIEWER'], cta: 'Browse incidents' },
  { title: 'Analyze Scenario', desc: 'Run a fresh investigation with explainable evidence.', href: '/analyze', requires: ['CHRONOSOPS_ANALYST'], cta: 'Start analysis' },
  { title: 'Scenarios', desc: 'Inspect scenario timelines and telemetry.', href: '/scenarios', requires: ['CHRONOSOPS_VIEWER'], cta: 'View scenarios' },
  { title: 'Exports', desc: 'Copy postmortem Markdown + incident JSON bundles.', href: '/exports', requires: ['CHRONOSOPS_VIEWER'], cta: 'Open exports' },
]

function hasAccess(userRoles: string[], required: Role[]) {
  if (userRoles.includes('CHRONOSOPS_ADMIN')) return true
  return required.some((r) => userRoles.includes(r))
}

function reqLabel(required: Role[]) {
  if (required.includes('CHRONOSOPS_ANALYST')) return 'Analyst+'
  if (required.includes('CHRONOSOPS_VIEWER')) return 'Viewer+'
  return 'Public'
}

export function FeatureLauncher() {
  const router = useRouter()
  const q = useWhoAmI()
  const roles = q.data?.user?.roles ?? []
  const authed = !!q.data?.authenticated

  // Auto-redirect to login if not authenticated
  useEffect(() => {
    if (!q.isLoading && !authed) {
      router.push('/login')
    }
  }, [q.isLoading, authed, router])

  // Show loading state while checking auth
  if (q.isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="text-gray-600 mb-2">Checking authentication...</div>
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    )
  }

  // If not authenticated, show nothing (redirect is happening)
  if (!authed) {
    return null
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">ChronosOps Console</h1>
      <p className="text-gray-600 mt-1">
        Evidence-first incident investigation with replayable analyses and shareable postmortems.
      </p>


      <div className="grid md:grid-cols-2 gap-4 mt-6">
        {FEATURES.map((f) => {
          const ok = authed && hasAccess(roles, f.requires)
          return (
            <div key={f.title} className="rounded-xl border p-4 bg-white shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-medium">{f.title}</div>
                  <div className="text-sm text-gray-600 mt-1">{f.desc}</div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full border text-gray-600">
                  {reqLabel(f.requires)}
                </span>
              </div>

              <div className="mt-4">
                {ok ? (
                  <Link className="text-sm underline" href={f.href}>
                    {f.cta} →
                  </Link>
                ) : (
                  <div className="text-sm text-gray-400">
                    Locked (requires {reqLabel(f.requires)})
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Visual Workflow Path */}
      <div className="mt-12">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Suggested Workflow</h2>
          <p className="text-sm text-gray-600 mt-1">Follow this path to get the most out of ChronosOps</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 md:gap-4 justify-center md:justify-start">
          {/* Step 1: Analyze */}
          <div className="flex flex-col items-center">
            <Link
              href="/analyze"
              className="flex flex-col items-center p-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 transition-all min-w-[120px]"
            >
              <div className="text-2xl mb-2">🔍</div>
              <div className="font-semibold text-blue-900 text-sm">Analyze</div>
              <div className="text-xs text-blue-700 mt-1">Create Incident</div>
            </Link>
          </div>

          {/* Arrow */}
          <div className="hidden md:block text-gray-400 text-xl">→</div>
          <div className="md:hidden text-gray-400 text-xl">↓</div>

          {/* Step 2: Evidence/Explainability */}
          <div className="flex flex-col items-center">
            <div className="flex flex-col items-center p-4 rounded-xl border-2 border-purple-200 bg-purple-50 min-w-[120px]">
              <div className="text-2xl mb-2">📊</div>
              <div className="font-semibold text-purple-900 text-sm">Evidence</div>
              <div className="text-xs text-purple-700 mt-1">View Results</div>
            </div>
          </div>

          {/* Arrow */}
          <div className="hidden md:block text-gray-400 text-xl">→</div>
          <div className="md:hidden text-gray-400 text-xl">↓</div>

          {/* Step 3: Reanalyze */}
          <div className="flex flex-col items-center">
            <div className="flex flex-col items-center p-4 rounded-xl border-2 border-green-200 bg-green-50 min-w-[120px]">
              <div className="text-2xl mb-2">🔄</div>
              <div className="font-semibold text-green-900 text-sm">Reanalyze</div>
              <div className="text-xs text-green-700 mt-1">Improve Analysis</div>
            </div>
          </div>

          {/* Arrow */}
          <div className="hidden md:block text-gray-400 text-xl">→</div>
          <div className="md:hidden text-gray-400 text-xl">↓</div>

          {/* Step 4: Exports */}
          <div className="flex flex-col items-center">
            <Link
              href="/exports"
              className="flex flex-col items-center p-4 rounded-xl border-2 border-orange-200 bg-orange-50 hover:bg-orange-100 hover:border-orange-300 transition-all min-w-[120px]"
            >
              <div className="text-2xl mb-2">📥</div>
              <div className="font-semibold text-orange-900 text-sm">Exports</div>
              <div className="text-xs text-orange-700 mt-1">Get Postmortem</div>
            </Link>
          </div>

          {/* Arrow */}
          <div className="hidden md:block text-gray-400 text-xl">→</div>
          <div className="md:hidden text-gray-400 text-xl">↓</div>

          {/* Step 5: Workspace */}
          <div className="flex flex-col items-center">
            <Link
              href="/incidents"
              className="flex flex-col items-center p-4 rounded-xl border-2 border-indigo-200 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-300 transition-all min-w-[120px]"
            >
              <div className="text-2xl mb-2">🏢</div>
              <div className="font-semibold text-indigo-900 text-sm">Workspace</div>
              <div className="text-xs text-indigo-700 mt-1">Browse All</div>
            </Link>
          </div>
        </div>

        {/* Quick Tips */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-700">
            <div className="font-medium mb-2">💡 Quick Tips:</div>
            <ul className="list-disc list-inside space-y-1 text-xs text-gray-600">
              <li>Start by analyzing a scenario or importing a Google Cloud incident</li>
              <li>Review evidence completeness and Gemini 3 reasoning results</li>
              <li>Use "Reanalyze" to improve confidence with additional evidence</li>
              <li>Export postmortems for documentation and sharing</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
