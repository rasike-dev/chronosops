'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { ApiErrorPanel } from '@/components/ApiErrorPanel'
import type { ScenarioListItem, Scenario } from '@chronosops/contracts'

export default function ScenariosPage() {
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)

  const scenariosQuery = useQuery({
    queryKey: ['scenarios'],
    queryFn: () => apiGet<ScenarioListItem[]>('/v1/scenarios'),
    staleTime: 60_000,
  })

  const scenarioQuery = useQuery({
    queryKey: ['scenario', selectedScenarioId],
    queryFn: () => apiGet<Scenario>(`/v1/scenarios/${selectedScenarioId}`),
    enabled: !!selectedScenarioId,
    staleTime: 60_000,
  })

  // Calculate metrics summary
  const metricsSummary = scenarioQuery.data?.metrics.reduce((acc, m) => {
    if (m.metric === 'p95_latency_ms') {
      acc.latency.push(m.value)
    } else if (m.metric === 'error_rate') {
      acc.errors.push(m.value)
    }
    return acc
  }, { latency: [] as number[], errors: [] as number[] }) || { latency: [], errors: [] }

  const avgLatency = metricsSummary.latency.length > 0
    ? Math.round(metricsSummary.latency.reduce((a, b) => a + b, 0) / metricsSummary.latency.length)
    : 0

  const avgErrorRate = metricsSummary.errors.length > 0
    ? (metricsSummary.errors.reduce((a, b) => a + b, 0) / metricsSummary.errors.length * 100).toFixed(2)
    : '0.00'

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Scenarios</h1>
          <p className="text-gray-600 mt-1">
            Inspect scenario timelines, telemetry, and deployment details.
          </p>
        </div>

        <Link
          className="text-sm underline"
          href="/analyze"
        >
          Analyze scenario →
        </Link>
      </div>

      {scenariosQuery.isError && (
        <div className="mt-4">
          <ApiErrorPanel error={scenariosQuery.error} />
        </div>
      )}

      <div className="mt-6 grid lg:grid-cols-2 gap-6">
        {/* Left: Scenario List */}
        <div className="rounded-xl border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <div className="font-medium text-sm">Available Scenarios</div>
          </div>

          {scenariosQuery.isLoading && (
            <div className="p-4 text-sm text-gray-600">Loading scenarios…</div>
          )}

          {scenariosQuery.isSuccess && scenariosQuery.data.length === 0 && (
            <div className="p-4 text-sm text-gray-600">No scenarios available.</div>
          )}

          {scenariosQuery.isSuccess && scenariosQuery.data.length > 0 && (
            <div className="divide-y">
              {scenariosQuery.data.map((scenario) => (
                <button
                  key={scenario.scenarioId}
                  onClick={() => setSelectedScenarioId(scenario.scenarioId)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    selectedScenarioId === scenario.scenarioId ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                  }`}
                >
                  <div className="font-medium text-sm">{scenario.title}</div>
                  <div className="text-xs text-gray-500 mt-1">{scenario.scenarioId}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Scenario Details */}
        <div className="rounded-xl border bg-white p-6">
          <div className="font-medium mb-4">Scenario Details</div>

          {!selectedScenarioId && (
            <div className="text-sm text-gray-600">
              Select a scenario from the list to view details.
            </div>
          )}

          {scenarioQuery.isLoading && (
            <div className="text-sm text-gray-600">Loading scenario details…</div>
          )}

          {scenarioQuery.isError && (
            <div>
              <ApiErrorPanel error={scenarioQuery.error} />
            </div>
          )}

          {scenarioQuery.isSuccess && scenarioQuery.data && (
            <div className="space-y-4">
              {/* Basic Info */}
              <div>
                <div className="text-xs text-gray-500 mb-1">ID</div>
                <div className="text-sm font-medium font-mono">{scenarioQuery.data.scenarioId}</div>
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">Title</div>
                <div className="text-sm font-medium">{scenarioQuery.data.title}</div>
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">Description</div>
                <div className="text-sm text-gray-700">{scenarioQuery.data.description}</div>
              </div>

              {/* Deployment Info */}
              <div className="pt-3 border-t">
                <div className="text-xs text-gray-500 mb-2 font-medium">Deployment</div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">Service:</span>{' '}
                    <span className="font-medium">{scenarioQuery.data.deployment.serviceId}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Version:</span>{' '}
                    <span className="font-medium">
                      {scenarioQuery.data.deployment.versionFrom} → {scenarioQuery.data.deployment.versionTo}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Time:</span>{' '}
                    <span className="font-medium">
                      {new Date(scenarioQuery.data.deployment.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Metrics Summary */}
              <div className="pt-3 border-t">
                <div className="text-xs text-gray-500 mb-2 font-medium">Metrics Summary</div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">Total data points:</span>{' '}
                    <span className="font-medium">{scenarioQuery.data.metrics.length}</span>
                  </div>
                  {avgLatency > 0 && (
                    <div>
                      <span className="text-gray-500">Avg p95 latency:</span>{' '}
                      <span className="font-medium">{avgLatency}ms</span>
                    </div>
                  )}
                  {metricsSummary.errors.length > 0 && (
                    <div>
                      <span className="text-gray-500">Avg error rate:</span>{' '}
                      <span className="font-medium">{avgErrorRate}%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Metrics Breakdown */}
              <div className="pt-3 border-t">
                <div className="text-xs text-gray-500 mb-2 font-medium">Metrics by Type</div>
                <div className="space-y-1 text-xs">
                  {['p95_latency_ms', 'error_rate', 'rps'].map((metricType) => {
                    const count = scenarioQuery.data.metrics.filter(m => m.metric === metricType).length
                    if (count === 0) return null
                    return (
                      <div key={metricType} className="flex justify-between">
                        <span className="text-gray-600">{metricType}:</span>
                        <span className="font-medium">{count} points</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-4 border-t">
                <Link
                  href={`/analyze?scenarioId=${scenarioQuery.data.scenarioId}`}
                  className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium"
                >
                  Analyze This Scenario →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
