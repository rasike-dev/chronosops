'use client'

import React from 'react'

type SourceType = 'SCENARIO' | 'GOOGLE_CLOUD' | 'PAGERDUTY' | 'DATADOG' | 'NEW_RELIC' | 'CUSTOM' | 'MANUAL'

interface SourceBadgeProps {
  type: SourceType
  label?: string
  className?: string
}

export function SourceBadge({ type, label, className = '' }: SourceBadgeProps) {
  const config: Record<SourceType, { bg: string; text: string; border: string; icon: string; defaultLabel: string }> = {
    SCENARIO: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-300',
      icon: '📊',
      defaultLabel: 'SCENARIO',
    },
    GOOGLE_CLOUD: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-300',
      icon: '☁️',
      defaultLabel: 'GOOGLE_CLOUD',
    },
    PAGERDUTY: {
      bg: 'bg-purple-100',
      text: 'text-purple-800',
      border: 'border-purple-300',
      icon: '📟',
      defaultLabel: 'PAGERDUTY',
    },
    DATADOG: {
      bg: 'bg-orange-100',
      text: 'text-orange-800',
      border: 'border-orange-300',
      icon: '📊',
      defaultLabel: 'DATADOG',
    },
    NEW_RELIC: {
      bg: 'bg-indigo-100',
      text: 'text-indigo-800',
      border: 'border-indigo-300',
      icon: '📈',
      defaultLabel: 'NEW_RELIC',
    },
    CUSTOM: {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      border: 'border-gray-300',
      icon: '⚙️',
      defaultLabel: 'CUSTOM',
    },
    MANUAL: {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      border: 'border-gray-300',
      icon: '✏️',
      defaultLabel: 'MANUAL',
    },
  }

  const style = config[type] || config.CUSTOM

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${style.bg} ${style.text} ${style.border} ${className}`}
    >
      <span>{style.icon}</span>
      <span>{label || style.defaultLabel}</span>
    </span>
  )
}
