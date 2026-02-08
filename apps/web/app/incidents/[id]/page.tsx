'use client'

import React, { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'
import { ApiErrorPanel } from '@/components/ApiErrorPanel'
import { SourceBadge } from '@/components/SourceBadge'
import { StatusBadge } from '@/components/StatusBadge'
import { EvidenceCompleteness } from '@/components/EvidenceCompleteness'
import { EvidenceTypeGrid } from '@/components/EvidenceTypeGrid'
import { FeatureSection } from '@/components/FeatureSection'
import { HypothesisCard } from '@/components/HypothesisCard'
import { ExplainabilityGraph } from '@/components/ExplainabilityGraph'

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
  scenarioId?: string | null
  title?: string | null
  status: string
  createdAt: string
  sourceType?: string | null
  sourceRef?: string | null
  sourceUrl?: string | null
  analyses: Analysis[]
  postmortems: Postmortem[]
}

type EvidenceBundle = {
  bundleId: string
  hash: string
  completenessScore: number
  sources: string[]
  artifacts: any[]
}

type InvestigationSession = {
  sessionId: string
  status: string
  currentIteration: number
  maxIterations: number
  confidenceTarget: number
  reason?: string | null
  iterations: Array<{
    iteration: number
    createdAt: string
    evidenceBundleId?: string | null
    analysisId?: string | null
    completenessScore?: number | null
    overallConfidence?: number | null
    decisionJson?: any
  }>
}

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const qc = useQueryClient()
  const router = useRouter()
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(null)

  const incidentQuery = useQuery({
    queryKey: ['incident', id],
    queryFn: () => apiGet<IncidentDetail>(`/v1/incidents/${id}`),
    staleTime: 5_000,
  })

  // Fetch evidence bundles
  const evidenceBundlesQuery = useQuery({
    queryKey: ['incident', id, 'evidence-bundles'],
    queryFn: () => apiGet<EvidenceBundle[]>(`/v1/incidents/${id}/evidence-bundles`),
    enabled: !!id,
    staleTime: 10_000,
  })

  // Fetch latest evidence bundle details
  const latestBundleId = evidenceBundlesQuery.data?.[0]?.bundleId
  const evidenceBundleQuery = useQuery({
    queryKey: ['evidence-bundle', latestBundleId],
    queryFn: () => apiGet<EvidenceBundle>(`/v1/incidents/evidence-bundles/${latestBundleId}`),
    enabled: !!latestBundleId,
    staleTime: 10_000,
  })

  // Fetch investigation sessions with auto-refresh when RUNNING
  const investigationsQuery = useQuery({
    queryKey: ['investigations', id],
    queryFn: () => apiGet<InvestigationSession[]>(`/v1/investigations/incident/${id}`),
    enabled: !!id,
    staleTime: 2_000, // Shorter stale time for faster updates
    refetchInterval: (query) => {
      // Auto-refresh every 3 seconds if there's a RUNNING session
      const data = query.state.data as InvestigationSession[] | undefined
      const hasRunningSession = data?.some((s) => s.status === 'RUNNING')
      return hasRunningSession ? 3_000 : false
    },
  })

  // Fetch explainability graph for latest analysis
  const latestAnalysis = incidentQuery.data?.analyses?.[0]
  const explainabilityGraphQuery = useQuery({
    queryKey: ['explainability-graph', id, latestAnalysis?.id],
    queryFn: () =>
      apiGet<any>(`/v1/incidents/${id}/analyses/${latestAnalysis?.id}/explainability-graph`),
    enabled: !!id && !!latestAnalysis?.id,
    staleTime: 10_000,
  })

  // Fetch audit verification
  const auditVerifyQuery = useQuery({
    queryKey: ['audit-verify', id],
    queryFn: () => apiGet<{ ok: boolean; verifiedCount: number; firstFailure?: any }>(`/v1/incidents/${id}/verify`),
    enabled: !!id,
    staleTime: 30_000,
  })

  const reanalyze = useMutation({
    mutationFn: () => apiPost(`/v1/incidents/${id}/reanalyze`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['incident', id] })
      await qc.invalidateQueries({ queryKey: ['incidents'] })
    },
  })

  const startInvestigation = useMutation({
    mutationFn: (data: { maxIterations: number; confidenceTarget: number }) =>
      apiPost<{ sessionId: string; status: string }>(`/v1/incidents/${id}/investigate`, data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['investigations', id] })
      await qc.invalidateQueries({ queryKey: ['incident', id] })
    },
  })

  const latestPostmortem = incidentQuery.data?.postmortems?.[0]
  const sourceType = incidentQuery.data?.sourceType as 'SCENARIO' | 'GOOGLE_CLOUD' | null

  // Check if there's a RUNNING investigation session
  const hasRunningSession = investigationsQuery.data?.some((s) => s.status === 'RUNNING') ?? false
  const runningSession = investigationsQuery.data?.find((s) => s.status === 'RUNNING')

  // Extract evidence completeness and types from bundle
  const completenessScore = evidenceBundleQuery.data?.completenessScore || 0
  const evidenceTypes = evidenceBundleQuery.data?.artifacts?.reduce((acc: any[], artifact: any) => {
    const type = artifact.kind?.split('_')[0] || 'UNKNOWN'
    const existing = acc.find((e) => e.type === type)
    if (existing) {
      existing.artifactCount++
    } else {
      acc.push({
        type,
        label: type.charAt(0) + type.slice(1).toLowerCase(),
        icon: type === 'METRICS' ? '📊' : type === 'LOGS' ? '📝' : type === 'TRACES' ? '🔍' : type === 'DEPLOYS' ? '🚀' : type === 'CONFIG' ? '⚙️' : '☁️',
        completeness: 85, // Would come from actual data
        artifactCount: 1,
      })
    }
    return acc
  }, [] as any[]) || []

  // Extract hypotheses from analysis
  const hypotheses = latestAnalysis?.resultJson?.hypotheses || []
  const overallConfidence = latestAnalysis?.resultJson?.overallConfidence || 0
  const primarySignal = latestAnalysis?.resultJson?.explainability?.primarySignal

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <button className="text-sm underline text-gray-600 mb-4" onClick={() => router.push('/incidents')}>
        ← Back to Incidents
      </button>

      {incidentQuery.isError && (
        <div className="mt-4">
          <ApiErrorPanel error={incidentQuery.error} />
        </div>
      )}
      {incidentQuery.isLoading && <div className="mt-4 text-sm text-gray-600">Loading incident…</div>}

      {incidentQuery.isSuccess && incidentQuery.data && (
        <>
          {/* Incident Header */}
          <div className="mt-4 mb-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-semibold">
                    {incidentQuery.data.title?.trim() || `Incident ${incidentQuery.data.id.slice(0, 10)}`}
                  </h1>
                  {sourceType && <SourceBadge type={sourceType} label={incidentQuery.data.scenarioId || undefined} />}
                  <StatusBadge status={incidentQuery.data.status} />
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  {incidentQuery.data.scenarioId && (
                    <span>
                      Scenario: <span className="font-medium text-gray-800">{incidentQuery.data.scenarioId}</span>
                    </span>
                  )}
                  <span>
                    Created: <span className="font-medium text-gray-800">{new Date(incidentQuery.data.createdAt).toLocaleString()}</span>
                  </span>
                  {incidentQuery.data.sourceUrl && (
                    <a
                      href={incidentQuery.data.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View Source →
                    </a>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  className="px-3 py-2 rounded-lg border bg-white text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => reanalyze.mutate()}
                  disabled={reanalyze.isPending || hasRunningSession}
                  title={hasRunningSession ? 'Cannot reanalyze while investigation is running' : undefined}
                >
                  {reanalyze.isPending ? 'Reanalyzing…' : 'Reanalyze'}
                </button>
                <button
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => startInvestigation.mutate({ maxIterations: 5, confidenceTarget: 0.8 })}
                  disabled={startInvestigation.isPending || hasRunningSession}
                  title={hasRunningSession ? `Investigation in progress (Session: ${runningSession?.sessionId.slice(0, 8)}...)` : undefined}
                >
                  {startInvestigation.isPending
                    ? 'Starting…'
                    : hasRunningSession
                      ? `Investigation Running (${runningSession?.currentIteration}/${runningSession?.maxIterations})`
                      : 'Start Investigation'}
                </button>
              </div>
            </div>

            {reanalyze.isError && (
              <div className="mt-2">
                <ApiErrorPanel error={reanalyze.error} />
              </div>
            )}
            {startInvestigation.isError && (
              <div className="mt-2">
                <ApiErrorPanel error={startInvestigation.error} />
              </div>
            )}
          </div>

          {/* Evidence Bundle Section */}
          <FeatureSection
            title="Evidence Bundle"
            icon="📦"
            description="Immutable, content-addressed evidence bundles with deterministic normalization"
            className="mb-6"
          >
            {evidenceBundleQuery.isLoading && <div className="text-sm text-gray-600">Loading evidence bundle…</div>}
            {evidenceBundleQuery.isError && (
              <div>
                <ApiErrorPanel error={evidenceBundleQuery.error} />
              </div>
            )}
            {evidenceBundleQuery.isSuccess && evidenceBundleQuery.data && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Bundle ID</div>
                    <div className="text-sm font-mono text-gray-800">{evidenceBundleQuery.data.bundleId}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Hash</div>
                    <div className="text-xs font-mono text-gray-600">{evidenceBundleQuery.data.hash?.slice(0, 16)}...</div>
                  </div>
                </div>

                <EvidenceCompleteness score={completenessScore} />

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-3">Evidence Types</div>
                  <EvidenceTypeGrid evidence={evidenceTypes} />
                </div>

                <div className="pt-4 border-t">
                  <div className="text-xs text-gray-500">
                    Sources: {evidenceBundleQuery.data.sources?.join(', ') || 'N/A'}
                  </div>
                </div>
              </div>
            )}
          </FeatureSection>

          {/* Analysis Results Section */}
          {latestAnalysis && (
            <FeatureSection
              title="Gemini 3 Flash Preview Analysis"
              icon="🧠"
              description="Strict schema-based reasoning with deterministic hypothesis catalog"
              className="mb-6"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-600">Overall Confidence</div>
                    <div className="text-2xl font-bold text-gray-900">{Math.round(overallConfidence * 100)}%</div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(latestAnalysis.createdAt).toLocaleString()}
                  </div>
                </div>

                {primarySignal && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-xs text-gray-500 mb-1">Primary Signal</div>
                    <div className="text-sm font-medium text-gray-900">{primarySignal}</div>
                  </div>
                )}

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-3">Ranked Hypotheses</div>
                  <div className="space-y-2">
                    {hypotheses.map((hyp: any, idx: number) => (
                      <HypothesisCard
                        key={hyp.id || idx}
                        id={hyp.id}
                        confidence={hyp.confidence}
                        rank={idx + 1}
                        rationale={hyp.rationale}
                        evidenceRefs={hyp.evidenceRefs}
                      />
                    ))}
                  </div>
                </div>

                {latestAnalysis.resultJson?.actions && latestAnalysis.resultJson.actions.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-3">Recommended Actions</div>
                    <div className="space-y-2">
                      {latestAnalysis.resultJson.actions.map((action: any, idx: number) => (
                        <div key={idx} className="p-3 bg-gray-50 rounded-lg border">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-gray-600">P{action.priority || 0}</span>
                            <span className="text-sm font-medium text-gray-900">{action.title}</span>
                          </div>
                          {action.steps && (
                            <ul className="text-xs text-gray-600 mt-1 list-disc list-inside">
                              {action.steps.map((step: string, stepIdx: number) => (
                                <li key={stepIdx}>{step}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </FeatureSection>
          )}

          {/* Investigation Loop Section */}
          {investigationsQuery.isSuccess && investigationsQuery.data && investigationsQuery.data.length > 0 && (
            <FeatureSection
              title="Autonomous Investigation Loop"
              icon="🔁"
              description="Bounded iterations with model-directed evidence requests"
              className="mb-6"
            >
              {hasRunningSession && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    <div className="text-sm font-medium text-blue-900">
                      Investigation in progress... Auto-refreshing every 3 seconds
                    </div>
                  </div>
                </div>
              )}
              {investigationsQuery.data.map((session) => (
                <div key={session.sessionId} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">Session {session.sessionId.slice(0, 8)}</div>
                      <div className="text-xs text-gray-500">
                        Iteration {session.currentIteration} / {session.maxIterations}
                        {session.status === 'RUNNING' && (
                          <span className="ml-2 text-blue-600">● Running</span>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={session.status as any} />
                  </div>

                  <div className="space-y-2">
                    {session.iterations.map((iter) => (
                      <div key={iter.iteration} className="p-3 bg-gray-50 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium">Iteration {iter.iteration}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(iter.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <div className="text-gray-500">Confidence</div>
                            <div className="font-medium">
                              {iter.overallConfidence ? Math.round(iter.overallConfidence * 100) : '-'}%
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500">Completeness</div>
                            <div className="font-medium">{iter.completenessScore || '-'}%</div>
                          </div>
                          <div>
                            <div className="text-gray-500">Target</div>
                            <div className="font-medium">{Math.round(session.confidenceTarget * 100)}%</div>
                          </div>
                        </div>
                        {iter.decisionJson && (
                          <details className="mt-2">
                            <summary className="text-xs text-gray-600 cursor-pointer">View Decision JSON</summary>
                            <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-auto max-h-40">
                              {JSON.stringify(iter.decisionJson, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>

                  {session.reason && (
                    <div className="p-2 bg-yellow-50 rounded border border-yellow-200 text-xs text-yellow-800">
                      Stop reason: {session.reason}
                    </div>
                  )}
                </div>
              ))}
            </FeatureSection>
          )}

          {/* Explainability Graph Section */}
          {explainabilityGraphQuery.isSuccess && explainabilityGraphQuery.data && (
            <FeatureSection
              title="Explainability Graph"
              icon="🕸️"
              description="Visual trace from evidence → reasoning → conclusion"
              className="mb-6"
            >
              <ExplainabilityGraph graph={explainabilityGraphQuery.data} />
            </FeatureSection>
          )}

          {/* Analysis Comparison Section */}
          {incidentQuery.data.analyses.length > 1 && (
            <FeatureSection
              title="Analysis Comparison"
              icon="🔄"
              description="Compare multiple investigation runs to detect drift"
              className="mb-6"
            >
              <div className="space-y-4">
                <div className="text-sm text-gray-600 mb-3">
                  Compare analyses to see evidence drift, hypothesis changes, and confidence evolution.
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {incidentQuery.data.analyses.slice(0, 2).map((analysis, idx) => (
                    <div key={analysis.id} className="p-3 bg-gray-50 rounded-lg border">
                      <div className="text-sm font-medium mb-2">Analysis {idx + 1}</div>
                      <div className="text-xs text-gray-500 mb-2">
                        {new Date(analysis.createdAt).toLocaleString()}
                      </div>
                      <div className="text-xs">
                        <div>Confidence: {Math.round((analysis.resultJson?.overallConfidence || 0) * 100)}%</div>
                        <div>Top Hypothesis: {analysis.resultJson?.hypotheses?.[0]?.id || 'N/A'}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  className="text-sm text-blue-600 hover:underline"
                  onClick={() => {
                    if (incidentQuery.data.analyses.length >= 2) {
                      const a = incidentQuery.data.analyses[0].id
                      const b = incidentQuery.data.analyses[1].id
                      router.push(`/incidents/${id}/compare/${a}/${b}`)
                    }
                  }}
                >
                  View Full Comparison →
                </button>
              </div>
            </FeatureSection>
          )}

          {/* Postmortem Section */}
          {latestPostmortem && (
            <FeatureSection
              title="Postmortem"
              icon="📄"
              description="Evidence-linked root cause narratives with export-ready formats"
              className="mb-6"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    Generated: {new Date(latestPostmortem.createdAt).toLocaleString()}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
                      onClick={() => navigator.clipboard.writeText(latestPostmortem.markdown)}
                    >
                      Copy Markdown
                    </button>
                    <button
                      className="text-xs px-3 py-1.5 border rounded hover:bg-gray-50"
                      onClick={() => {
                        const blob = new Blob([latestPostmortem.markdown], { type: 'text/markdown' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `postmortem-${id}-${latestPostmortem.id}.md`
                        a.click()
                      }}
                    >
                      Download Markdown
                    </button>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border max-h-96 overflow-auto">
                  <pre className="text-xs whitespace-pre-wrap font-sans">{latestPostmortem.markdown}</pre>
                </div>
              </div>
            </FeatureSection>
          )}

          {/* Audit Chain Section */}
          <FeatureSection
            title="Audit Chain & Integrity"
            icon="🧱"
            description="Hash-chained audit events for tamper detection"
            className="mb-6"
          >
            {auditVerifyQuery.isLoading && <div className="text-sm text-gray-600">Verifying audit chain…</div>}
            {auditVerifyQuery.isSuccess && auditVerifyQuery.data && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {auditVerifyQuery.data.ok ? (
                    <>
                      <span className="text-green-600 text-xl">✅</span>
                      <div>
                        <div className="text-sm font-medium text-gray-900">Chain Verified</div>
                        <div className="text-xs text-gray-500">
                          {auditVerifyQuery.data.verifiedCount || 0} events verified
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-red-600 text-xl">❌</span>
                      <div>
                        <div className="text-sm font-medium text-red-900">Verification Failed</div>
                        <div className="text-xs text-red-600">
                          Tampering detected at event {auditVerifyQuery.data.firstFailure?.seq}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <button
                  className="text-sm px-3 py-1.5 border rounded hover:bg-gray-50"
                  onClick={() => auditVerifyQuery.refetch()}
                >
                  Verify Now
                </button>
              </div>
            )}
          </FeatureSection>
        </>
      )}
    </div>
  )
}
