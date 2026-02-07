'use client'

import React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { ApiErrorPanel } from '@/components/ApiErrorPanel'
import { FeatureSection } from '@/components/FeatureSection'

type DiffItem = {
  type: 'ADDED' | 'REMOVED' | 'CHANGED' | 'UNCHANGED'
  key: string
  before?: any
  after?: any
  note?: string | null
}

type AnalysisCompare = {
  kind: string
  incidentId: string
  a: {
    analysisId: string
    createdAt: string
    evidenceBundleId: string | null
    confidence: number
  }
  b: {
    analysisId: string
    createdAt: string
    evidenceBundleId: string | null
    confidence: number
  }
  evidence: {
    bundleChanged: boolean
    artifactDiffs: DiffItem[]
  }
  reasoning: {
    primarySignalDiff: DiffItem
    hypothesisDiffs: DiffItem[]
    actionsDiffs: DiffItem[]
  }
  completeness: {
    scoreDiff: DiffItem
    missingDiffs: DiffItem[]
  }
  summary: {
    headline: string
    keyChanges: string[]
  }
}

export default function CompareAnalysesPage() {
  const params = useParams<{ id: string; a: string; b: string }>()
  const router = useRouter()
  const { id, a, b } = params

  const compareQuery = useQuery({
    queryKey: ['compare', id, a, b],
    queryFn: () => apiGet<AnalysisCompare>(`/v1/incidents/${id}/analyses/${a}/compare/${b}`),
    staleTime: 10_000,
  })

  const getDiffBadge = (type: DiffItem['type']) => {
    const config = {
      ADDED: { bg: 'bg-green-100', text: 'text-green-800', icon: '➕', label: 'Added' },
      REMOVED: { bg: 'bg-red-100', text: 'text-red-800', icon: '➖', label: 'Removed' },
      CHANGED: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: '🔄', label: 'Changed' },
      UNCHANGED: { bg: 'bg-gray-100', text: 'text-gray-600', icon: '✓', label: 'Unchanged' },
    }
    const style = config[type]
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
        <span>{style.icon}</span>
        <span>{style.label}</span>
      </span>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <button className="text-sm underline text-gray-600 mb-4" onClick={() => router.back()}>
        ← Back
      </button>

      {compareQuery.isError && (
        <div className="mt-4">
          <ApiErrorPanel error={compareQuery.error} />
        </div>
      )}

      {compareQuery.isLoading && <div className="mt-4 text-sm text-gray-600">Loading comparison…</div>}

      {compareQuery.isSuccess && compareQuery.data && (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-semibold mb-2">Analysis Comparison</h1>
            <p className="text-gray-600">{compareQuery.data.summary.headline}</p>
          </div>

          {/* Summary */}
          {compareQuery.data.summary.keyChanges.length > 0 && (
            <FeatureSection
              title="Key Changes"
              icon="📊"
              description="Summary of significant differences between analyses"
              className="mb-6"
            >
              <ul className="space-y-2">
                {compareQuery.data.summary.keyChanges.map((change, idx) => (
                  <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </FeatureSection>
          )}

          {/* Analysis Info */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <FeatureSection
              title="Analysis A"
              icon="📄"
              description="First analysis"
              className=""
            >
              <div className="space-y-2 text-sm">
                <div>
                  <div className="text-xs text-gray-500">Created</div>
                  <div className="font-medium">{new Date(compareQuery.data.a.createdAt).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Confidence</div>
                  <div className="font-medium">{Math.round(compareQuery.data.a.confidence * 100)}%</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Bundle ID</div>
                  <div className="font-mono text-xs">{compareQuery.data.a.evidenceBundleId || 'N/A'}</div>
                </div>
              </div>
            </FeatureSection>

            <FeatureSection
              title="Analysis B"
              icon="📄"
              description="Second analysis"
              className=""
            >
              <div className="space-y-2 text-sm">
                <div>
                  <div className="text-xs text-gray-500">Created</div>
                  <div className="font-medium">{new Date(compareQuery.data.b.createdAt).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Confidence</div>
                  <div className="font-medium">{Math.round(compareQuery.data.b.confidence * 100)}%</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Bundle ID</div>
                  <div className="font-mono text-xs">{compareQuery.data.b.evidenceBundleId || 'N/A'}</div>
                </div>
              </div>
            </FeatureSection>
          </div>

          {/* Evidence Diffs */}
          <FeatureSection
            title="Evidence Changes"
            icon="📦"
            description="Changes in evidence bundles and artifacts"
            className="mb-6"
          >
            <div className="space-y-4">
              {compareQuery.data.evidence.bundleChanged && (
                <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
                  <div className="text-sm font-medium text-yellow-900">Evidence bundle changed</div>
                  <div className="text-xs text-yellow-700 mt-1">
                    Bundle IDs differ between analyses
                  </div>
                </div>
              )}

              {compareQuery.data.evidence.artifactDiffs.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-3">Artifact Changes</div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {compareQuery.data.evidence.artifactDiffs.map((diff, idx) => (
                      <div key={idx} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium">{diff.key}</div>
                          {getDiffBadge(diff.type)}
                        </div>
                        {diff.type === 'CHANGED' && (
                          <div className="grid md:grid-cols-2 gap-3 mt-2 text-xs">
                            <div>
                              <div className="text-gray-500 mb-1">Before</div>
                              <div className="bg-red-50 p-2 rounded">
                                <div className="font-medium">{diff.before?.title || diff.before?.kind}</div>
                                {diff.before?.summary && (
                                  <div className="text-gray-600 mt-1">{diff.before.summary}</div>
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="text-gray-500 mb-1">After</div>
                              <div className="bg-green-50 p-2 rounded">
                                <div className="font-medium">{diff.after?.title || diff.after?.kind}</div>
                                {diff.after?.summary && (
                                  <div className="text-gray-600 mt-1">{diff.after.summary}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        {diff.type === 'ADDED' && diff.after && (
                          <div className="mt-2 text-xs bg-green-50 p-2 rounded">
                            <div className="font-medium">{diff.after.title || diff.after.kind}</div>
                            {diff.after.summary && (
                              <div className="text-gray-600 mt-1">{diff.after.summary}</div>
                            )}
                          </div>
                        )}
                        {diff.type === 'REMOVED' && diff.before && (
                          <div className="mt-2 text-xs bg-red-50 p-2 rounded">
                            <div className="font-medium">{diff.before.title || diff.before.kind}</div>
                            {diff.before.summary && (
                              <div className="text-gray-600 mt-1">{diff.before.summary}</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </FeatureSection>

          {/* Reasoning Diffs */}
          <FeatureSection
            title="Reasoning Changes"
            icon="🧠"
            description="Changes in hypotheses, confidence, and recommendations"
            className="mb-6"
          >
            <div className="space-y-4">
              {/* Primary Signal */}
              {compareQuery.data.reasoning.primarySignalDiff.type !== 'UNCHANGED' && (
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">Primary Signal</div>
                    {getDiffBadge(compareQuery.data.reasoning.primarySignalDiff.type)}
                  </div>
                  {compareQuery.data.reasoning.primarySignalDiff.note && (
                    <div className="text-xs text-gray-600">{compareQuery.data.reasoning.primarySignalDiff.note}</div>
                  )}
                </div>
              )}

              {/* Hypothesis Diffs */}
              {compareQuery.data.reasoning.hypothesisDiffs.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-3">Hypothesis Changes</div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {compareQuery.data.reasoning.hypothesisDiffs.map((diff, idx) => (
                      <div key={idx} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium">{diff.key}</div>
                          {getDiffBadge(diff.type)}
                        </div>
                        {diff.type === 'CHANGED' && (
                          <div className="grid md:grid-cols-2 gap-3 mt-2 text-xs">
                            <div>
                              <div className="text-gray-500 mb-1">Before</div>
                              <div className="bg-red-50 p-2 rounded">
                                <div>Rank: {diff.before?.rank}</div>
                                <div>Confidence: {diff.before?.confidence ? Math.round(diff.before.confidence * 100) : '-'}%</div>
                                <div className="font-medium mt-1">{diff.before?.title}</div>
                              </div>
                            </div>
                            <div>
                              <div className="text-gray-500 mb-1">After</div>
                              <div className="bg-green-50 p-2 rounded">
                                <div>Rank: {diff.after?.rank}</div>
                                <div>Confidence: {diff.after?.confidence ? Math.round(diff.after.confidence * 100) : '-'}%</div>
                                <div className="font-medium mt-1">{diff.after?.title}</div>
                              </div>
                            </div>
                          </div>
                        )}
                        {diff.note && (
                          <div className="text-xs text-gray-600 mt-2">{diff.note}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions Diffs */}
              {compareQuery.data.reasoning.actionsDiffs.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-3">Action Changes</div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {compareQuery.data.reasoning.actionsDiffs.map((diff, idx) => (
                      <div key={idx} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium">{diff.key}</div>
                          {getDiffBadge(diff.type)}
                        </div>
                        {diff.type === 'CHANGED' && diff.note && (
                          <div className="text-xs text-gray-600 mt-2">{diff.note}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </FeatureSection>

          {/* Completeness Diffs */}
          <FeatureSection
            title="Completeness Changes"
            icon="✅"
            description="Changes in evidence completeness scores"
            className="mb-6"
          >
            <div className="space-y-4">
              {compareQuery.data.completeness.scoreDiff.type !== 'UNCHANGED' && (
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">Completeness Score</div>
                    {getDiffBadge(compareQuery.data.completeness.scoreDiff.type)}
                  </div>
                  {compareQuery.data.completeness.scoreDiff.note && (
                    <div className="text-xs text-gray-600">{compareQuery.data.completeness.scoreDiff.note}</div>
                  )}
                </div>
              )}

              {compareQuery.data.completeness.missingDiffs.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-3">Missing Evidence Changes</div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {compareQuery.data.completeness.missingDiffs.map((diff, idx) => (
                      <div key={idx} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium">{diff.key}</div>
                          {getDiffBadge(diff.type)}
                        </div>
                        {diff.note && (
                          <div className="text-xs text-gray-600 mt-2">{diff.note}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </FeatureSection>
        </>
      )}
    </div>
  )
}
