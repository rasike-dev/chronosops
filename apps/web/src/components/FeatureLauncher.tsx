'use client'

import React from 'react'
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
  const q = useWhoAmI()
  const roles = q.data?.user?.roles ?? []
  const authed = !!q.data?.authenticated

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">ChronosOps Console</h1>
      <p className="text-gray-600 mt-1">
        Evidence-first incident investigation with replayable analyses and shareable postmortems.
      </p>

      {!authed && !q.isLoading && (
        <div className="mt-4 p-3 rounded-lg border bg-amber-50">
          <div className="font-medium">Login required</div>
          <div className="text-sm text-gray-700">
            You're not signed in yet. For now, obtain a token from Keycloak and use your API tools. UI login can be added next.
          </div>
        </div>
      )}

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

      <div className="mt-8 text-sm text-gray-500">
        Suggested flow: <span className="font-medium">Analyze</span> → Evidence/Explainability → <span className="font-medium">Reanalyze</span> → Exports → Workspace
      </div>
    </div>
  )
}
