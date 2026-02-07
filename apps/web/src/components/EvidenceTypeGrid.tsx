'use client'

import React from 'react'

type EvidenceType = 'METRICS' | 'LOGS' | 'TRACES' | 'DEPLOYS' | 'CONFIG' | 'GOOGLE_STATUS'

interface EvidenceTypeData {
  type: EvidenceType
  label: string
  icon: string
  completeness: number
  artifactCount?: number
}

interface EvidenceTypeGridProps {
  evidence: EvidenceTypeData[]
  onTypeClick?: (type: EvidenceType) => void
  className?: string
}

export function EvidenceTypeGrid({ evidence, onTypeClick, className = '' }: EvidenceTypeGridProps) {
  const getStatusIcon = (completeness: number) => {
    if (completeness >= 80) return '✅'
    if (completeness >= 50) return '⚠️'
    return '❌'
  }

  const getStatusColor = (completeness: number) => {
    if (completeness >= 80) return 'border-green-200 bg-green-50'
    if (completeness >= 50) return 'border-yellow-200 bg-yellow-50'
    return 'border-red-200 bg-red-50'
  }

  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 gap-3 ${className}`}>
      {evidence.map((item) => (
        <div
          key={item.type}
          onClick={() => onTypeClick?.(item.type)}
          className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${getStatusColor(
            item.completeness
          )} ${onTypeClick ? 'hover:scale-105' : ''}`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm font-medium text-gray-800">{item.label}</span>
            </div>
            <span className="text-sm">{getStatusIcon(item.completeness)}</span>
          </div>
          <div className="text-xs text-gray-600">
            {item.completeness}% complete
            {item.artifactCount !== undefined && ` · ${item.artifactCount} artifacts`}
          </div>
        </div>
      ))}
    </div>
  )
}
