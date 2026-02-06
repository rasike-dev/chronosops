'use client'

import React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'
import { ApiErrorPanel } from '@/components/ApiErrorPanel'

type Analysis = {
  id: string
  createdAt: string
  requestJson: any
  resultJson: any
}

type Postmortem = {
  id: string
  createdAt: string
  markdown: string
  json: any
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

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const qc = useQueryClient()
  const router = useRouter()

  const q = useQuery({
    queryKey: ['incident', id],
    queryFn: () => apiGet<IncidentDetail>(`/v1/incidents/${id}`),
    staleTime: 5_000,
  })

  const reanalyze = useMutation({
    mutationFn: () => apiPost(`/v1/incidents/${id}/reanalyze`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['incident', id] })
      await qc.invalidateQueries({ queryKey: ['incidents'] })
    },
  })

  const latestAnalysis = q.data?.analyses?.[0]
  const latestPostmortem = q.data?.postmortems?.[0]

  return (
    <div className="p-6">
      <button className="text-sm underline text-gray-600" onClick={() => router.push('/incidents')}>
        ← Back
      </button>

      {q.isError && <div className="mt-4"><ApiErrorPanel error={q.error} /></div>}
      {q.isLoading && <div className="mt-4 text-sm text-gray-600">Loading incident…</div>}

      {q.isSuccess && (
        <>
          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">
                {q.data.title?.trim() ? q.data.title : `Incident ${q.data.id.slice(0, 10)}`}
              </h1>
              <div className="text-sm text-gray-600 mt-1">
                Scenario: <span className="font-medium text-gray-800">{q.data.scenarioId}</span> ·
                Status: <span className="font-medium text-gray-800"> {q.data.status}</span> ·
                Created: <span className="font-medium text-gray-800"> {new Date(q.data.createdAt).toLocaleString()}</span>
              </div>
            </div>

            <button
              className="px-3 py-2 rounded-lg border bg-white text-sm hover:bg-gray-50 disabled:opacity-50"
              onClick={() => reanalyze.mutate()}
              disabled={reanalyze.isPending}
              title="Replay analysis using stored requestJson and create a new analysis + postmortem snapshot"
            >
              {reanalyze.isPending ? 'Reanalyzing…' : 'Reanalyze'}
            </button>
          </div>

          {reanalyze.isError && (
            <div className="mt-4">
              <ApiErrorPanel error={reanalyze.error} />
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-4 mt-6">
            <div className="rounded-xl border bg-white p-4">
              <div className="font-medium">Latest Analysis</div>
              <div className="text-xs text-gray-500 mt-1">
                {latestAnalysis ? new Date(latestAnalysis.createdAt).toLocaleString() : 'None'}
              </div>

              {!latestAnalysis && (
                <div className="text-sm text-gray-600 mt-3">No analyses found.</div>
              )}

              {latestAnalysis && (
                <pre className="mt-3 text-xs bg-gray-50 border rounded-lg p-3 overflow-auto max-h-[420px]">
{JSON.stringify(latestAnalysis.resultJson, null, 2)}
                </pre>
              )}
            </div>

            <div className="rounded-xl border bg-white p-4">
              <div className="font-medium">Latest Postmortem</div>
              <div className="text-xs text-gray-500 mt-1">
                {latestPostmortem ? new Date(latestPostmortem.createdAt).toLocaleString() : 'None'}
              </div>

              {!latestPostmortem && (
                <div className="text-sm text-gray-600 mt-3">No postmortems found.</div>
              )}

              {latestPostmortem && (
                <>
                  <div className="mt-3 flex gap-2">
                    <button
                      className="text-xs underline"
                      onClick={() => navigator.clipboard.writeText(latestPostmortem.markdown)}
                    >
                      Copy Markdown
                    </button>
                    <button
                      className="text-xs underline"
                      onClick={() => navigator.clipboard.writeText(JSON.stringify(latestPostmortem.json, null, 2))}
                    >
                      Copy JSON
                    </button>
                  </div>

                  <pre className="mt-3 text-xs bg-gray-50 border rounded-lg p-3 overflow-auto max-h-[420px] whitespace-pre-wrap">
{latestPostmortem.markdown}
                  </pre>
                </>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 mt-6">
            <div className="font-medium">History</div>
            <div className="text-sm text-gray-600 mt-1">
              Analyses: {q.data.analyses.length} · Postmortems: {q.data.postmortems.length}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
