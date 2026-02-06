'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'
import { ApiErrorPanel } from '@/components/ApiErrorPanel'
import type { ScenarioListItem, Scenario, AnalyzeIncidentResponse } from '@chronosops/contracts'

export default function AnalyzePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [scenarioId, setScenarioId] = useState<string>('')
  const [windowBefore, setWindowBefore] = useState(15)
  const [windowAfter, setWindowAfter] = useState(15)

  // Pre-select scenario from query parameter
  useEffect(() => {
    const scenarioIdParam = searchParams.get('scenarioId')
    if (scenarioIdParam) {
      setScenarioId(scenarioIdParam)
    }
  }, [searchParams])

  // Fetch scenarios list
  const scenariosQuery = useQuery({
    queryKey: ['scenarios'],
    queryFn: () => apiGet<ScenarioListItem[]>('/v1/scenarios'),
    staleTime: 60_000,
  })

  // Fetch selected scenario details
  const scenarioQuery = useQuery({
    queryKey: ['scenario', scenarioId],
    queryFn: () => apiGet<Scenario>(`/v1/scenarios/${scenarioId}`),
    enabled: !!scenarioId,
    staleTime: 60_000,
  })

  // Analyze mutation
  const analyzeMutation = useMutation({
    mutationFn: (data: { scenarioId: string; windowMinutesBefore: number; windowMinutesAfter: number }) =>
      apiPost<AnalyzeIncidentResponse>('/v1/incidents/analyze', data),
    onSuccess: (data) => {
      // Redirect to incident detail page
      router.push(`/incidents/${data.incidentId}`)
    },
  })

  const handleAnalyze = () => {
    if (!scenarioId) return
    analyzeMutation.mutate({
      scenarioId,
      windowMinutesBefore: windowBefore,
      windowMinutesAfter: windowAfter,
    })
  }

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Analyze Scenario</h1>
          <p className="text-gray-600 mt-1">
            Run a fresh investigation with explainable evidence and ranked root-cause hypotheses.
          </p>
        </div>
      </div>

      <div className="mt-6 grid lg:grid-cols-2 gap-6">
        {/* Left: Configuration */}
        <div className="rounded-xl border bg-white p-6">
          <h2 className="text-lg font-medium mb-4">Configuration</h2>

          {/* Scenario Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Scenario
            </label>
            {scenariosQuery.isLoading && (
              <div className="text-sm text-gray-600">Loading scenarios…</div>
            )}
            {scenariosQuery.isError && (
              <div className="mt-2">
                <ApiErrorPanel error={scenariosQuery.error} />
              </div>
            )}
            {scenariosQuery.isSuccess && (
              <select
                value={scenarioId}
                onChange={(e) => setScenarioId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white text-sm"
              >
                <option value="">Select a scenario…</option>
                {scenariosQuery.data.map((s) => (
                  <option key={s.scenarioId} value={s.scenarioId}>
                    {s.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Window Configuration */}
          {scenarioId && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Window Before (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={windowBefore}
                  onChange={(e) => setWindowBefore(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Window After (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={windowAfter}
                  onChange={(e) => setWindowAfter(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <button
                onClick={handleAnalyze}
                disabled={analyzeMutation.isPending || !scenarioId}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {analyzeMutation.isPending ? 'Analyzing…' : 'Run Analysis'}
              </button>

              {analyzeMutation.isError && (
                <div className="mt-4">
                  <ApiErrorPanel error={analyzeMutation.error} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: Scenario Preview */}
        <div className="rounded-xl border bg-white p-6">
          <h2 className="text-lg font-medium mb-4">Scenario Preview</h2>

          {!scenarioId && (
            <div className="text-sm text-gray-600">
              Select a scenario to see details.
            </div>
          )}

          {scenarioQuery.isLoading && (
            <div className="text-sm text-gray-600">Loading scenario…</div>
          )}

          {scenarioQuery.isError && (
            <div>
              <ApiErrorPanel error={scenarioQuery.error} />
            </div>
          )}

          {scenarioQuery.isSuccess && scenarioQuery.data && (
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500">ID</div>
                <div className="text-sm font-medium">{scenarioQuery.data.scenarioId}</div>
              </div>

              <div>
                <div className="text-xs text-gray-500">Title</div>
                <div className="text-sm font-medium">{scenarioQuery.data.title}</div>
              </div>

              <div>
                <div className="text-xs text-gray-500">Description</div>
                <div className="text-sm text-gray-700">{scenarioQuery.data.description}</div>
              </div>

              <div>
                <div className="text-xs text-gray-500">Deployment</div>
                <div className="text-sm text-gray-700">
                  {scenarioQuery.data.deployment.serviceId} {scenarioQuery.data.deployment.versionFrom} → {scenarioQuery.data.deployment.versionTo}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(scenarioQuery.data.deployment.timestamp).toLocaleString()}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500">Metrics</div>
                <div className="text-sm text-gray-700">
                  {scenarioQuery.data.metrics.length} data points
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 rounded-xl border bg-blue-50 p-4">
        <div className="text-sm">
          <div className="font-medium mb-1">How it works:</div>
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            <li>Select a scenario to investigate</li>
            <li>Configure the time window around the deployment</li>
            <li>Run analysis to generate ranked root-cause hypotheses</li>
            <li>View results in the incident detail page</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
