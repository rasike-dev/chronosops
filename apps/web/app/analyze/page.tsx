'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'
import { ApiErrorPanel } from '@/components/ApiErrorPanel'
import { SourceBadge } from '@/components/SourceBadge'
import { StatusBadge } from '@/components/StatusBadge'
import type { ScenarioListItem, Scenario, AnalyzeIncidentResponse } from '@chronosops/contracts'

type TabType = 'scenarios' | 'google' | 'api'

export default function AnalyzePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabType>('scenarios')
  const [scenarioId, setScenarioId] = useState<string>('')
  const [windowBefore, setWindowBefore] = useState(15)
  const [windowAfter, setWindowAfter] = useState(15)

  // Pre-select scenario from query parameter
  useEffect(() => {
    const scenarioIdParam = searchParams.get('scenarioId')
    if (scenarioIdParam) {
      setScenarioId(scenarioIdParam)
      setActiveTab('scenarios')
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
    enabled: !!scenarioId && activeTab === 'scenarios',
    staleTime: 60_000,
  })

  // Fetch Google Cloud incidents
  const googleIncidentsQuery = useQuery({
    queryKey: ['google-incidents'],
    queryFn: () => apiPost<{ incidents: any[]; imported: number }>('/v1/incidents/import/google', {}),
    enabled: false, // Only fetch on demand
    staleTime: 30_000,
  })

  // Analyze mutation (scenario)
  const analyzeMutation = useMutation({
    mutationFn: (data: { scenarioId: string; windowMinutesBefore: number; windowMinutesAfter: number }) =>
      apiPost<AnalyzeIncidentResponse>('/v1/incidents/analyze', data),
    onSuccess: (data) => {
      router.push(`/incidents/${data.incidentId}`)
    },
  })

  // Import Google incident mutation
  const importGoogleMutation = useMutation({
    mutationFn: (incidentData: any) =>
      apiPost<AnalyzeIncidentResponse>('/v1/incidents/analyze', {
        evidence: {
          googleEvidenceLite: incidentData,
        },
      }),
    onSuccess: (data) => {
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

  const handleFetchGoogle = () => {
    googleIncidentsQuery.refetch()
  }

  const handleImportGoogle = (incident: any) => {
    importGoogleMutation.mutate(incident)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Create Incident</h1>
          <p className="text-gray-600 mt-1">
            Import from scenarios, Google Cloud incidents, or integrate via API (PagerDuty, Datadog, New Relic, Custom). All sources are unified with full traceability.
          </p>
        </div>
      </div>

      {/* Source Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('scenarios')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'scenarios'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📊 Scenarios
          </button>
          <button
            onClick={() => setActiveTab('google')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'google'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            ☁️ Google Cloud
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'api'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🔌 API Integration
          </button>
        </nav>
      </div>

      {/* Scenarios Tab */}
      {activeTab === 'scenarios' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Configuration */}
          <div className="rounded-xl border bg-white p-6">
            <div className="flex items-center gap-2 mb-4">
              <SourceBadge type="SCENARIO" />
              <h2 className="text-lg font-medium">Scenario Analysis</h2>
            </div>

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
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">ID</div>
                  <div className="text-sm font-medium">{scenarioQuery.data.scenarioId}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-1">Title</div>
                  <div className="text-sm font-medium">{scenarioQuery.data.title}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-1">Description</div>
                  <div className="text-sm text-gray-700">{scenarioQuery.data.description}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-1">Deployment</div>
                  <div className="text-sm text-gray-700">
                    {scenarioQuery.data.deployment.serviceId} {scenarioQuery.data.deployment.versionFrom} → {scenarioQuery.data.deployment.versionTo}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(scenarioQuery.data.deployment.timestamp).toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-1">Metrics</div>
                  <div className="text-sm text-gray-700">
                    {scenarioQuery.data.metrics.length} data points
                  </div>
                </div>

                {/* Timeline Preview */}
                <div className="mt-4 pt-4 border-t">
                  <div className="text-xs text-gray-500 mb-2">Timeline</div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-1 bg-gray-100 rounded">Before</span>
                    <span>→</span>
                    <span className="px-2 py-1 bg-blue-100 rounded font-medium">Deploy</span>
                    <span>→</span>
                    <span className="px-2 py-1 bg-red-100 rounded">Spike</span>
                    <span>→</span>
                    <span className="px-2 py-1 bg-gray-100 rounded">After</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Google Cloud Tab */}
      {activeTab === 'google' && (
        <div className="space-y-6">
          <div className="rounded-xl border bg-white p-6">
            <div className="flex items-center gap-2 mb-4">
              <SourceBadge type="GOOGLE_CLOUD" />
              <h2 className="text-lg font-medium">Google Cloud Status Incidents</h2>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Fetch real incidents from Google Cloud Status page and import them for analysis.
            </p>

            <button
              onClick={handleFetchGoogle}
              disabled={googleIncidentsQuery.isFetching}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {googleIncidentsQuery.isFetching ? 'Fetching…' : 'Fetch from status.cloud.google.com'}
            </button>

            {googleIncidentsQuery.isError && (
              <div className="mt-4">
                <ApiErrorPanel error={googleIncidentsQuery.error} />
              </div>
            )}

            {googleIncidentsQuery.isSuccess && googleIncidentsQuery.data && (
              <div className="mt-4">
                <div className="text-sm text-gray-600 mb-4">
                  Found {googleIncidentsQuery.data.incidents?.length || 0} incidents
                </div>

                {googleIncidentsQuery.data.incidents && googleIncidentsQuery.data.incidents.length > 0 && (
                  <div className="space-y-3">
                    {googleIncidentsQuery.data.incidents.map((incident: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="font-medium text-sm mb-1">
                              {incident.headline || incident.title || 'Google Cloud Incident'}
                            </div>
                            {incident.summary && (
                              <div className="text-xs text-gray-600 line-clamp-2">{incident.summary}</div>
                            )}
                          </div>
                          {incident.status && <StatusBadge status={incident.status} className="ml-4" />}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                          {incident.severity && <span>Severity: {incident.severity}</span>}
                          {incident.url && (
                            <a
                              href={incident.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              View on status.cloud.google.com →
                            </a>
                          )}
                        </div>
                        <button
                          onClick={() => handleImportGoogle(incident)}
                          disabled={importGoogleMutation.isPending}
                          className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {importGoogleMutation.isPending ? 'Importing…' : 'Import & Analyze'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* API Integration Tab */}
      {activeTab === 'api' && (
        <div className="space-y-6">
          <div className="rounded-xl border bg-white p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🔌</span>
              <h2 className="text-lg font-medium">Generic Ingestion API</h2>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              ChronosOps supports ingestion from multiple incident management systems via a unified API endpoint. 
              Use <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">POST /v1/incidents/ingest</code> to integrate with:
            </p>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">📟</span>
                  <h3 className="font-medium">PagerDuty</h3>
                </div>
                <p className="text-xs text-gray-600 mb-2">
                  Normalize PagerDuty webhooks and send to the ingestion endpoint
                </p>
                <div className="text-xs text-gray-500">
                  Source Type: <code className="bg-gray-100 px-1 rounded">PAGERDUTY</code>
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">📊</span>
                  <h3 className="font-medium">Datadog</h3>
                </div>
                <p className="text-xs text-gray-600 mb-2">
                  Integrate Datadog incidents with severity mapping (SEV-1 to SEV-4)
                </p>
                <div className="text-xs text-gray-500">
                  Source Type: <code className="bg-gray-100 px-1 rounded">DATADOG</code>
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">📈</span>
                  <h3 className="font-medium">New Relic</h3>
                </div>
                <p className="text-xs text-gray-600 mb-2">
                  Connect New Relic incidents with priority mapping (P1-P4)
                </p>
                <div className="text-xs text-gray-500">
                  Source Type: <code className="bg-gray-100 px-1 rounded">NEW_RELIC</code>
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">⚙️</span>
                  <h3 className="font-medium">Custom Sources</h3>
                </div>
                <p className="text-xs text-gray-600 mb-2">
                  Integrate any incident management system with custom normalization
                </p>
                <div className="text-xs text-gray-500">
                  Source Type: <code className="bg-gray-100 px-1 rounded">CUSTOM</code>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-medium mb-3">API Endpoint</h3>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm mb-4">
                <div className="text-green-400">POST</div>
                <div className="mt-1">/v1/incidents/ingest</div>
              </div>

              <h3 className="font-medium mb-3">Example Request</h3>
              <div className="bg-gray-50 p-4 rounded-lg border overflow-x-auto">
                <pre className="text-xs text-gray-800">
{`{
  "sourceType": "PAGERDUTY",
  "sourceRef": "PD-123456",
  "title": "High error rate in payment-service",
  "severity": "high",
  "timeline": {
    "start": "2024-01-15T10:00:00Z",
    "end": "2024-01-15T11:00:00Z"
  },
  "metadata": {
    "service": "payment-service",
    "region": "us-east-1",
    "environment": "production"
  }
}`}
                </pre>
              </div>

              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm font-medium text-blue-900 mb-2">📚 Documentation</div>
                <p className="text-xs text-blue-800 mb-2">
                  For complete integration guide, API reference, and source-specific examples, see:
                </p>
                <a
                  href="/docs/INGESTION_INTEGRATION_GUIDE.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Ingestion Integration Guide →
                </a>
              </div>

              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="text-sm font-medium text-yellow-900 mb-2">🔐 Authentication</div>
                <p className="text-xs text-yellow-800">
                  Requires <code className="bg-yellow-100 px-1 rounded">CHRONOSOPS_ANALYST</code> or <code className="bg-yellow-100 px-1 rounded">CHRONOSOPS_ADMIN</code> role.
                  Include JWT token in <code className="bg-yellow-100 px-1 rounded">Authorization: Bearer &lt;token&gt;</code> header.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 rounded-xl border bg-blue-50 p-4">
        <div className="text-sm">
          <div className="font-medium mb-1">Features:</div>
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            <li>Unified incident model with source traceability</li>
            <li>Idempotent imports (duplicates detected automatically)</li>
            <li>Replay-safe storage for all incident data</li>
            <li>Multiple source types: Scenarios, Google Cloud, PagerDuty, Datadog, New Relic, Custom</li>
            <li>Generic ingestion API for easy integration</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
