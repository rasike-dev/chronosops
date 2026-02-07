'use client'

import React from 'react'

interface FeatureSectionProps {
  title: string
  icon?: string
  description?: string
  children: React.ReactNode
  className?: string
  actions?: React.ReactNode
}

export function FeatureSection({
  title,
  icon,
  description,
  children,
  className = '',
  actions,
}: FeatureSectionProps) {
  return (
    <div className={`rounded-xl border bg-white p-6 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {icon && <span className="text-xl">{icon}</span>}
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
          {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
        </div>
        {actions && <div className="ml-4">{actions}</div>}
      </div>
      {children}
    </div>
  )
}
