'use client'

import React from 'react'

interface HypothesisCardProps {
  id: string
  confidence: number
  rank: number
  rationale?: string
  evidenceRefs?: string[]
  onClick?: () => void
  className?: string
}

export function HypothesisCard({
  id,
  confidence,
  rank,
  rationale,
  evidenceRefs,
  onClick,
  className = '',
}: HypothesisCardProps) {
  const confidencePercentage = Math.round(confidence * 100)
  const isTop = rank === 1

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg border transition-all ${
        isTop ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
      } ${onClick ? 'cursor-pointer hover:shadow-md' : ''} ${className}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {isTop && <span className="text-lg">⭐</span>}
          <span className="text-sm font-semibold text-gray-900">
            {rank}. {id}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900">{confidencePercentage}%</span>
          <div className="w-16 bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full"
              style={{ width: `${confidencePercentage}%` }}
            />
          </div>
        </div>
      </div>
      {rationale && (
        <p className="text-xs text-gray-600 mt-2 line-clamp-2">{rationale}</p>
      )}
      {evidenceRefs && evidenceRefs.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {evidenceRefs.slice(0, 3).map((ref, idx) => (
            <span
              key={idx}
              className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded"
            >
              {ref}
            </span>
          ))}
          {evidenceRefs.length > 3 && (
            <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
              +{evidenceRefs.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
