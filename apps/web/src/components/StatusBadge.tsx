'use client'

import React from 'react'

type StatusType = 'analyzed' | 'investigating' | 'resolved' | 'failed' | 'running' | 'completed' | 'stopped'

interface StatusBadgeProps {
  status: StatusType | string
  className?: string
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config: Record<string, { bg: string; text: string; border: string; icon: string }> = {
    analyzed: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-300',
      icon: '✅',
    },
    investigating: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      border: 'border-yellow-300',
      icon: '🔍',
    },
    resolved: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-300',
      icon: '✓',
    },
    failed: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      border: 'border-red-300',
      icon: '❌',
    },
    running: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-300',
      icon: '⏳',
    },
    completed: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-300',
      icon: '✅',
    },
    stopped: {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      border: 'border-gray-300',
      icon: '⏸️',
    },
  }

  const style = config[status.toLowerCase()] || {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    border: 'border-gray-300',
    icon: '•',
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${style.bg} ${style.text} ${style.border} ${className}`}
    >
      <span>{style.icon}</span>
      <span className="capitalize">{status}</span>
    </span>
  )
}
