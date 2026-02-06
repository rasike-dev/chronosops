'use client'

import React from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { ApiErrorPanel } from '@/components/ApiErrorPanel'

type IncidentListItem = {
  id: string
  scenarioId: string
  title?: string | null
  status: string
  createdAt: string
}

export default function IncidentsPage() {
  const q = useQuery({
    queryKey: ['incidents'],
    queryFn: () => apiGet<IncidentListItem[]>('/v1/incidents'),
    staleTime: 10_000,
  })

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Incidents</h1>
          <p className="text-gray-600 mt-1">
            Browse persisted incidents and open details (analyses + postmortems).
          </p>
        </div>

        <Link
          className="text-sm underline"
          href="/analyze"
        >
          Analyze new →
        </Link>
      </div>

      {q.isError && <div className="mt-4"><ApiErrorPanel error={q.error} /></div>}

      <div className="mt-6">
        {q.isLoading && <div className="text-sm text-gray-600">Loading incidents…</div>}

        {q.isSuccess && q.data.length === 0 && (
          <div className="text-sm text-gray-600">
            No incidents yet. Run an analysis to create one.
          </div>
        )}

        {q.isSuccess && q.data.length > 0 && (
          <div className="rounded-xl border bg-white overflow-hidden">
            <div className="grid grid-cols-12 px-4 py-2 text-xs font-medium text-gray-500 border-b">
              <div className="col-span-4">Incident</div>
              <div className="col-span-3">Scenario</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-3">Created</div>
            </div>

            {q.data.map((i) => (
              <Link
                key={i.id}
                href={`/incidents/${i.id}`}
                className="grid grid-cols-12 px-4 py-3 text-sm hover:bg-gray-50 border-b last:border-b-0"
              >
                <div className="col-span-4 font-medium">
                  {i.title?.trim() ? i.title : i.id.slice(0, 10)}
                </div>
                <div className="col-span-3 text-gray-700">{i.scenarioId}</div>
                <div className="col-span-2 text-gray-700">{i.status}</div>
                <div className="col-span-3 text-gray-600">
                  {new Date(i.createdAt).toLocaleString()}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
