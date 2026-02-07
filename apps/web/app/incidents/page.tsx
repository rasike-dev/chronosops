'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { ApiErrorPanel } from '@/components/ApiErrorPanel'
import { SourceBadge } from '@/components/SourceBadge'
import { StatusBadge } from '@/components/StatusBadge'

type IncidentListItem = {
  id: string
  scenarioId?: string | null
  title?: string | null
  status: string
  createdAt: string
  sourceType?: string | null
  sourceRef?: string | null
}

export default function IncidentsPage() {
  const [filterSource, setFilterSource] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const q = useQuery({
    queryKey: ['incidents'],
    queryFn: () => apiGet<IncidentListItem[]>('/v1/incidents'),
    staleTime: 10_000,
  })

  const filteredIncidents = q.data?.filter((incident) => {
    if (filterSource !== 'all' && incident.sourceType !== filterSource) return false
    if (filterStatus !== 'all' && incident.status !== filterStatus) return false
    return true
  }) || []

  const sourceTypes = Array.from(new Set(q.data?.map((i) => i.sourceType).filter(Boolean) || []))

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Incidents</h1>
          <p className="text-gray-600 mt-1">
            Browse persisted incidents with full traceability and source attribution.
          </p>
        </div>

        <Link
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          href="/analyze"
        >
          Create New Incident →
        </Link>
      </div>

      {/* Filters */}
      {q.isSuccess && q.data && q.data.length > 0 && (
        <div className="mb-6 flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Source:</label>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm"
            >
              <option value="all">All Sources</option>
              {sourceTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Status:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="analyzed">Analyzed</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <div className="text-sm text-gray-500">
            Showing {filteredIncidents.length} of {q.data.length} incidents
          </div>
        </div>
      )}

      {q.isError && (
        <div className="mt-4">
          <ApiErrorPanel error={q.error} />
        </div>
      )}

      <div className="mt-6">
        {q.isLoading && <div className="text-sm text-gray-600">Loading incidents…</div>}

        {q.isSuccess && q.data.length === 0 && (
          <div className="text-center py-12 border rounded-xl bg-gray-50">
            <div className="text-gray-600 mb-2">No incidents yet.</div>
            <Link href="/analyze" className="text-blue-600 hover:underline text-sm">
              Create your first incident →
            </Link>
          </div>
        )}

        {q.isSuccess && filteredIncidents.length === 0 && q.data.length > 0 && (
          <div className="text-center py-12 border rounded-xl bg-gray-50">
            <div className="text-gray-600">No incidents match the selected filters.</div>
          </div>
        )}

        {q.isSuccess && filteredIncidents.length > 0 && (
          <div className="rounded-xl border bg-white overflow-hidden">
            <div className="grid grid-cols-12 px-4 py-3 text-xs font-medium text-gray-500 border-b bg-gray-50">
              <div className="col-span-1">Source</div>
              <div className="col-span-4">Incident</div>
              <div className="col-span-2">Scenario</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-3">Created</div>
            </div>

            {filteredIncidents.map((i) => (
              <Link
                key={i.id}
                href={`/incidents/${i.id}`}
                className="grid grid-cols-12 px-4 py-4 text-sm hover:bg-gray-50 border-b last:border-b-0 transition-colors"
              >
                <div className="col-span-1 flex items-center">
                  {i.sourceType && (
                    <SourceBadge
                      type={i.sourceType as 'SCENARIO' | 'GOOGLE_CLOUD'}
                      className="text-xs"
                    />
                  )}
                </div>
                <div className="col-span-4">
                  <div className="font-medium text-gray-900">
                    {i.title?.trim() ? i.title : `Incident ${i.id.slice(0, 10)}`}
                  </div>
                  {i.sourceRef && (
                    <div className="text-xs text-gray-500 mt-0.5">Ref: {i.sourceRef.slice(0, 20)}...</div>
                  )}
                </div>
                <div className="col-span-2 text-gray-700">
                  {i.scenarioId || '-'}
                </div>
                <div className="col-span-2">
                  <StatusBadge status={i.status as any} />
                </div>
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
