'use client'

import React, { useState } from 'react'
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

type Postmortem = {
  id: string
  createdAt: string
  markdown: string
  json: any
}

type Analysis = {
  id: string
  createdAt: string
  requestJson: any
  resultJson: any
}

type IncidentDetail = {
  id: string
  scenarioId: string
  title?: string | null
  status: string
  createdAt: string
  analyses: Analysis[]
  postmortems: Postmortem[]
}

export default function ExportsPage() {
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const incidentsQuery = useQuery({
    queryKey: ['incidents'],
    queryFn: () => apiGet<IncidentListItem[]>('/v1/incidents'),
    staleTime: 10_000,
  })

  const incidentQuery = useQuery({
    queryKey: ['incident', selectedIncidentId],
    queryFn: () => apiGet<IncidentDetail>(`/v1/incidents/${selectedIncidentId}`),
    enabled: !!selectedIncidentId,
    staleTime: 5_000,
  })

  const showToast = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 2000)
  }

  const copyPostmortemMarkdown = (postmortem: Postmortem) => {
    navigator.clipboard.writeText(postmortem.markdown)
    showToast('Postmortem Markdown copied!')
  }

  const copyPostmortemJson = (postmortem: Postmortem) => {
    navigator.clipboard.writeText(JSON.stringify(postmortem.json, null, 2))
    showToast('Postmortem JSON copied!')
  }

  const copyIncidentJson = (incident: IncidentDetail) => {
    const bundle = {
      incident: {
        id: incident.id,
        scenarioId: incident.scenarioId,
        title: incident.title,
        status: incident.status,
        createdAt: incident.createdAt,
      },
      latestAnalysis: incident.analyses[0]?.resultJson || null,
      latestPostmortem: incident.postmortems[0]?.json || null,
      allAnalyses: incident.analyses.map(a => ({
        id: a.id,
        createdAt: a.createdAt,
        resultJson: a.resultJson,
      })),
      allPostmortems: incident.postmortems.map(p => ({
        id: p.id,
        createdAt: p.createdAt,
        json: p.json,
      })),
    }
    navigator.clipboard.writeText(JSON.stringify(bundle, null, 2))
    showToast('Incident JSON bundle copied!')
  }

  const downloadPostmortemMarkdown = (postmortem: Postmortem, incidentId: string) => {
    const blob = new Blob([postmortem.markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `postmortem-${incidentId}-${postmortem.id}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast('Postmortem Markdown downloaded!')
  }

  const downloadIncidentJson = (incident: IncidentDetail) => {
    const bundle = {
      incident: {
        id: incident.id,
        scenarioId: incident.scenarioId,
        title: incident.title,
        status: incident.status,
        createdAt: incident.createdAt,
      },
      latestAnalysis: incident.analyses[0]?.resultJson || null,
      latestPostmortem: incident.postmortems[0]?.json || null,
      allAnalyses: incident.analyses.map(a => ({
        id: a.id,
        createdAt: a.createdAt,
        resultJson: a.resultJson,
      })),
      allPostmortems: incident.postmortems.map(p => ({
        id: p.id,
        createdAt: p.createdAt,
        json: p.json,
      })),
    }
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `incident-${incident.id}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast('Incident JSON bundle downloaded!')
  }

  const latestPostmortem = incidentQuery.data?.postmortems?.[0]
  const latestAnalysis = incidentQuery.data?.analyses?.[0]

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Exports</h1>
          <p className="text-gray-600 mt-1">
            Copy postmortem Markdown + incident JSON bundles for sharing and integration.
          </p>
        </div>
      </div>

      {incidentsQuery.isError && (
        <div className="mt-4">
          <ApiErrorPanel error={incidentsQuery.error} />
        </div>
      )}

      <div className="mt-6 grid lg:grid-cols-2 gap-6">
        {/* Left: Incident List */}
        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <div className="font-medium text-sm">Incidents</div>
          </div>

          {incidentsQuery.isLoading && (
            <div className="p-4 text-sm text-gray-600">Loading incidents…</div>
          )}

          {incidentsQuery.isSuccess && incidentsQuery.data.length === 0 && (
            <div className="p-4 text-sm text-gray-600">
              No incidents yet. Run an analysis to create one.
            </div>
          )}

          {incidentsQuery.isSuccess && incidentsQuery.data.length > 0 && (
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {incidentsQuery.data.map((incident) => (
                <button
                  key={incident.id}
                  onClick={() => setSelectedIncidentId(incident.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    selectedIncidentId === incident.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                  }`}
                >
                  <div className="font-medium text-sm">
                    {incident.title?.trim() || `Incident ${incident.id.slice(0, 10)}`}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {incident.scenarioId} · {new Date(incident.createdAt).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Export Options */}
        <div className="rounded-xl border bg-white p-6">
          <div className="font-medium mb-4">Export Options</div>

          {!selectedIncidentId && (
            <div className="text-sm text-gray-600">
              Select an incident from the list to view export options.
            </div>
          )}

          {incidentQuery.isLoading && (
            <div className="text-sm text-gray-600">Loading incident details…</div>
          )}

          {incidentQuery.isError && (
            <div>
              <ApiErrorPanel error={incidentQuery.error} />
            </div>
          )}

          {incidentQuery.isSuccess && incidentQuery.data && (
            <div className="space-y-6">
              {/* Incident Info */}
              <div>
                <div className="text-xs text-gray-500 mb-1">Incident</div>
                <div className="text-sm font-medium">
                  {incidentQuery.data.title?.trim() || `Incident ${incidentQuery.data.id.slice(0, 10)}`}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {incidentQuery.data.scenarioId} · {new Date(incidentQuery.data.createdAt).toLocaleString()}
                </div>
              </div>

              {/* Latest Postmortem */}
              <div className="pt-4 border-t">
                <div className="text-xs text-gray-500 mb-2 font-medium">Latest Postmortem</div>
                {!latestPostmortem && (
                  <div className="text-sm text-gray-600">No postmortem available.</div>
                )}
                {latestPostmortem && (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-500">
                      Created: {new Date(latestPostmortem.createdAt).toLocaleString()}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyPostmortemMarkdown(latestPostmortem)}
                        className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50"
                      >
                        Copy Markdown
                      </button>
                      <button
                        onClick={() => copyPostmortemJson(latestPostmortem)}
                        className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50"
                      >
                        Copy JSON
                      </button>
                      <button
                        onClick={() => downloadPostmortemMarkdown(latestPostmortem, incidentQuery.data.id)}
                        className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50"
                      >
                        Download .md
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* All Postmortems */}
              {incidentQuery.data.postmortems.length > 1 && (
                <div className="pt-4 border-t">
                  <div className="text-xs text-gray-500 mb-2 font-medium">
                    All Postmortems ({incidentQuery.data.postmortems.length})
                  </div>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {incidentQuery.data.postmortems.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-xs border rounded p-2">
                        <span className="text-gray-600">
                          {new Date(p.createdAt).toLocaleString()}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => copyPostmortemMarkdown(p)}
                            className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
                          >
                            Copy MD
                          </button>
                          <button
                            onClick={() => downloadPostmortemMarkdown(p, incidentQuery.data.id)}
                            className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
                          >
                            Download
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Incident JSON Bundle */}
              <div className="pt-4 border-t">
                <div className="text-xs text-gray-500 mb-2 font-medium">Incident JSON Bundle</div>
                <div className="text-xs text-gray-600 mb-2">
                  Includes incident metadata, latest analysis, latest postmortem, and full history.
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyIncidentJson(incidentQuery.data)}
                    className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50"
                  >
                    Copy JSON
                  </button>
                  <button
                    onClick={() => downloadIncidentJson(incidentQuery.data)}
                    className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50"
                  >
                    Download .json
                  </button>
                </div>
              </div>

              {/* Quick Link */}
              <div className="pt-4 border-t">
                <Link
                  href={`/incidents/${incidentQuery.data.id}`}
                  className="text-xs underline text-blue-600"
                >
                  View full incident details →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
