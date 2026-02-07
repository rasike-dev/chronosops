'use client'

import React from 'react'

interface EvidenceCompletenessProps {
  score: number
  maxScore?: number
  showLabel?: boolean
  className?: string
}

export function EvidenceCompleteness({
  score,
  maxScore = 100,
  showLabel = true,
  className = '',
}: EvidenceCompletenessProps) {
  const percentage = Math.round((score / maxScore) * 100)
  const colorClass =
    percentage >= 80
      ? 'bg-green-500'
      : percentage >= 60
      ? 'bg-yellow-500'
      : percentage >= 40
      ? 'bg-orange-500'
      : 'bg-red-500'

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Evidence Completeness</span>
          <span className="text-sm font-semibold text-gray-900">{percentage}%</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all duration-300 ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
