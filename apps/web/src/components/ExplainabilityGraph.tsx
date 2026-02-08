'use client'

import React, { useMemo, useState } from 'react'
import type { ExplainabilityGraph } from '@chronosops/contracts'

interface ExplainabilityGraphProps {
  graph: ExplainabilityGraph
  className?: string
}

type NodeType = 'EVIDENCE' | 'CLAIM' | 'HYPOTHESIS' | 'ACTION' | 'CONCLUSION'

// Simple graph visualization using SVG (no external dependencies)
export function ExplainabilityGraph({ graph, className = '' }: ExplainabilityGraphProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [showOnlyConclusionPath, setShowOnlyConclusionPath] = useState(false)

  // Get selected node data
  const selectedNodeData = useMemo(() => {
    if (!selectedNode) return null
    return graph.nodes.find((n) => n.id === selectedNode)
  }, [selectedNode, graph.nodes])

  // Filter edges based on showOnlyConclusionPath
  const visibleEdges = useMemo(() => {
    if (!showOnlyConclusionPath) return graph.edges

    // Find conclusion node
    const conclusionNode = graph.nodes.find((n) => n.type === 'CONCLUSION')
    if (!conclusionNode) return graph.edges

    // Build path from conclusion backwards
    const conclusionPath = new Set<string>([conclusionNode.id])
    const queue = [conclusionNode.id]

    while (queue.length > 0) {
      const currentId = queue.shift()!
      const incomingEdges = graph.edges.filter((e) => e.to === currentId)
      for (const edge of incomingEdges) {
        if (!conclusionPath.has(edge.from)) {
          conclusionPath.add(edge.from)
          queue.push(edge.from)
        }
      }
    }

    // Only show edges where both nodes are in the path
    return graph.edges.filter(
      (e) => conclusionPath.has(e.from) && conclusionPath.has(e.to)
    )
  }, [showOnlyConclusionPath, graph.edges, graph.nodes])

  // Get visible nodes
  const visibleNodes = useMemo(() => {
    if (!showOnlyConclusionPath) return graph.nodes

    const conclusionNode = graph.nodes.find((n) => n.type === 'CONCLUSION')
    if (!conclusionNode) return graph.nodes

    const conclusionPath = new Set<string>([conclusionNode.id])
    const queue = [conclusionNode.id]

    while (queue.length > 0) {
      const currentId = queue.shift()!
      const incomingEdges = visibleEdges.filter((e) => e.to === currentId)
      for (const edge of incomingEdges) {
        if (!conclusionPath.has(edge.from)) {
          conclusionPath.add(edge.from)
          queue.push(edge.from)
        }
      }
    }

    return graph.nodes.filter((n) => conclusionPath.has(n.id))
  }, [showOnlyConclusionPath, graph.nodes, visibleEdges])

  // Improved layout: arrange nodes in columns with better spacing
  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {}
    const nodeTypes: Record<NodeType, ExplainabilityGraph['nodes']> = {
      EVIDENCE: [],
      CLAIM: [],
      HYPOTHESIS: [],
      ACTION: [],
      CONCLUSION: [],
    }

    visibleNodes.forEach((node) => {
      nodeTypes[node.type].push(node)
    })

    const columnWidth = 220
    const rowHeight = 120
    const startX = 100
    const startY = 80
    let currentX = startX

    // Column 1: Evidence (left)
    const maxEvidenceRows = Math.max(nodeTypes.EVIDENCE.length, 1)
    const evidenceCenterY = startY + (maxEvidenceRows - 1) * rowHeight / 2
    nodeTypes.EVIDENCE.forEach((node, idx) => {
      positions[node.id] = { 
        x: currentX, 
        y: evidenceCenterY - (nodeTypes.EVIDENCE.length - 1) * rowHeight / 2 + idx * rowHeight 
      }
    })
    if (nodeTypes.EVIDENCE.length > 0) currentX += columnWidth

    // Column 2: Claim (center-left)
    if (nodeTypes.CLAIM.length > 0) {
      nodeTypes.CLAIM.forEach((node, idx) => {
        positions[node.id] = { x: currentX, y: startY + idx * rowHeight }
      })
      currentX += columnWidth
    }

    // Column 3: Hypotheses (center)
    const maxHypRows = Math.max(nodeTypes.HYPOTHESIS.length, 1)
    const hypCenterY = startY + (maxHypRows - 1) * rowHeight / 2
    nodeTypes.HYPOTHESIS.forEach((node, idx) => {
      positions[node.id] = { 
        x: currentX, 
        y: hypCenterY - (nodeTypes.HYPOTHESIS.length - 1) * rowHeight / 2 + idx * rowHeight 
      }
    })
    if (nodeTypes.HYPOTHESIS.length > 0) currentX += columnWidth

    // Column 4: Actions (center-right)
    const maxActionRows = Math.max(nodeTypes.ACTION.length, 1)
    const actionCenterY = startY + (maxActionRows - 1) * rowHeight / 2
    nodeTypes.ACTION.forEach((node, idx) => {
      positions[node.id] = { 
        x: currentX, 
        y: actionCenterY - (nodeTypes.ACTION.length - 1) * rowHeight / 2 + idx * rowHeight 
      }
    })
    if (nodeTypes.ACTION.length > 0) currentX += columnWidth

    // Column 5: Conclusion (right)
    if (nodeTypes.CONCLUSION.length > 0) {
      nodeTypes.CONCLUSION.forEach((node, idx) => {
        positions[node.id] = { x: currentX, y: startY + idx * rowHeight }
      })
    }

    return positions
  }, [visibleNodes])

  const getNodeColor = (type: NodeType) => {
    switch (type) {
      case 'EVIDENCE':
        return 'bg-blue-100 border-blue-300 text-blue-900'
      case 'CLAIM':
        return 'bg-purple-100 border-purple-300 text-purple-900'
      case 'HYPOTHESIS':
        return 'bg-yellow-100 border-yellow-300 text-yellow-900'
      case 'ACTION':
        return 'bg-green-100 border-green-300 text-green-900'
      case 'CONCLUSION':
        return 'bg-red-100 border-red-300 text-red-900'
      default:
        return 'bg-gray-100 border-gray-300 text-gray-900'
    }
  }

  const getNodeIcon = (type: NodeType) => {
    switch (type) {
      case 'EVIDENCE':
        return '📦'
      case 'CLAIM':
        return '📊'
      case 'HYPOTHESIS':
        return '💡'
      case 'ACTION':
        return '⚡'
      case 'CONCLUSION':
        return '🎯'
      default:
        return '•'
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showOnlyConclusionPath}
              onChange={(e) => setShowOnlyConclusionPath(e.target.checked)}
              className="rounded"
            />
            <span>Show only paths to conclusion</span>
          </label>
        </div>
        <div className="text-xs text-gray-500">
          {visibleNodes.length} nodes · {visibleEdges.length} edges
        </div>
      </div>

      {/* Graph Visualization */}
      <div className="relative border rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 overflow-auto" style={{ minHeight: '600px' }}>
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1400 700"
          className="absolute inset-0"
          style={{ minHeight: '600px' }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Edges */}
          <g>
            {visibleEdges.map((edge, idx) => {
              const fromNode = visibleNodes.find((n) => n.id === edge.from)
              const toNode = visibleNodes.find((n) => n.id === edge.to)
              if (!fromNode || !toNode) return null

              const fromPos = nodePositions[edge.from]
              const toPos = nodePositions[edge.to]
              if (!fromPos || !toPos) return null

              const x1 = fromPos.x + 110 // Right edge of source node
              const y1 = fromPos.y + 40 // Center vertically
              const x2 = toPos.x + 10 // Left edge of target node
              const y2 = toPos.y + 40 // Center vertically

              const weight = edge.weight || 0.5
              const strokeWidth = 1 + weight * 2
              const opacity = 0.3 + weight * 0.5

              return (
                <g key={`edge-${idx}`}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#94a3b8"
                    strokeWidth={strokeWidth}
                    opacity={opacity}
                    markerEnd="url(#arrowhead)"
                  />
                  {edge.label && (
                    <text
                      x={(x1 + x2) / 2}
                      y={(y1 + y2) / 2 - 5}
                      fontSize="10"
                      fill="#64748b"
                      textAnchor="middle"
                      className="pointer-events-none"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              )
            })}
          </g>

          {/* Arrow marker definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#94a3b8" />
            </marker>
          </defs>

          {/* Nodes */}
          {visibleNodes.map((node) => {
            const pos = nodePositions[node.id]
            if (!pos) return null

            const isSelected = selectedNode === node.id
            const nodeColor = getNodeColor(node.type)

            return (
              <g
                key={node.id}
                onClick={() => setSelectedNode(isSelected ? null : node.id)}
                className="cursor-pointer"
              >
                {/* Node background with shadow effect */}
                <rect
                  x={pos.x + 2}
                  y={pos.y + 2}
                  width="220"
                  height="80"
                  rx="8"
                  fill="#000000"
                  opacity="0.1"
                />
                <rect
                  x={pos.x}
                  y={pos.y}
                  width="220"
                  height="80"
                  rx="8"
                  className={`${nodeColor} border-2 ${
                    isSelected ? 'ring-4 ring-blue-500' : ''
                  }`}
                  fill="white"
                />
                {/* Icon and title */}
                <text
                  x={pos.x + 35}
                  y={pos.y + 28}
                  fontSize="13"
                  fontWeight="600"
                  fill="currentColor"
                >
                  {getNodeIcon(node.type)}
                </text>
                <text
                  x={pos.x + 55}
                  y={pos.y + 28}
                  fontSize="12"
                  fontWeight="600"
                  fill="currentColor"
                >
                  {node.title.length > 25 ? node.title.substring(0, 25) + '...' : node.title}
                </text>
                {/* Subtitle */}
                {node.subtitle && (
                  <text
                    x={pos.x + 12}
                    y={pos.y + 50}
                    fontSize="10"
                    fill="#64748b"
                  >
                    {node.subtitle.length > 35 ? node.subtitle.substring(0, 35) + '...' : node.subtitle}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Node Details Panel */}
      {selectedNodeData && (
        <div className="border rounded-lg bg-gray-50 p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="text-sm font-semibold text-gray-900">{selectedNodeData.title}</div>
              {selectedNodeData.subtitle && (
                <div className="text-xs text-gray-600 mt-1">{selectedNodeData.subtitle}</div>
              )}
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 space-y-2 text-xs">
            <div>
              <span className="text-gray-500">Type:</span>{' '}
              <span className="font-medium">{selectedNodeData.type}</span>
            </div>
            {selectedNodeData.meta && (
              <div className="mt-2">
                <div className="text-gray-500 mb-1">Details:</div>
                <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-40">
                  {JSON.stringify(selectedNodeData.meta, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-100 border border-blue-300 rounded"></div>
          <span>Evidence</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-purple-100 border border-purple-300 rounded"></div>
          <span>Claim</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
          <span>Hypothesis</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
          <span>Action</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
          <span>Conclusion</span>
        </div>
      </div>
    </div>
  )
}
