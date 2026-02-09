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
      <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyConclusionPath}
              onChange={(e) => setShowOnlyConclusionPath(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span className="font-medium">Show only paths to conclusion</span>
          </label>
        </div>
        <div className="text-xs text-gray-600 font-medium bg-gray-100 px-3 py-1.5 rounded-full">
          {visibleNodes.length} nodes · {visibleEdges.length} edges
        </div>
      </div>

      {/* Graph Visualization */}
      <div className="relative border-2 border-gray-200 rounded-xl bg-gradient-to-br from-gray-50 via-white to-gray-50 shadow-inner overflow-auto" style={{ minHeight: '600px' }}>
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
                  {/* Edge shadow for depth */}
                  <line
                    x1={x1 + 1}
                    y1={y1 + 1}
                    x2={x2 + 1}
                    y2={y2 + 1}
                    stroke="#cbd5e1"
                    strokeWidth={strokeWidth + 1}
                    opacity={opacity * 0.3}
                    markerEnd="url(#arrowhead-shadow)"
                  />
                  {/* Main edge */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#64748b"
                    strokeWidth={strokeWidth}
                    opacity={opacity}
                    markerEnd="url(#arrowhead)"
                    className="transition-opacity"
                  />
                  {edge.label && (
                    <g>
                      <rect
                        x={(x1 + x2) / 2 - 20}
                        y={(y1 + y2) / 2 - 12}
                        width="40"
                        height="16"
                        rx="4"
                        fill="white"
                        opacity="0.9"
                        stroke="#e2e8f0"
                      />
                      <text
                        x={(x1 + x2) / 2}
                        y={(y1 + y2) / 2 - 2}
                        fontSize="10"
                        fill="#475569"
                        textAnchor="middle"
                        className="pointer-events-none font-medium"
                      >
                        {edge.label}
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
          </g>

          {/* Arrow marker definitions */}
          <defs>
            <marker
              id="arrowhead-shadow"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#cbd5e1" opacity="0.5" />
            </marker>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#64748b" />
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
                className="cursor-pointer transition-transform hover:scale-105"
              >
                {/* Node shadow for depth */}
                <rect
                  x={pos.x + 3}
                  y={pos.y + 3}
                  width="220"
                  height="80"
                  rx="10"
                  fill="#000000"
                  opacity={isSelected ? "0.15" : "0.08"}
                />
                {/* Node background with gradient effect */}
                <rect
                  x={pos.x}
                  y={pos.y}
                  width="220"
                  height="80"
                  rx="10"
                  className={`${nodeColor} border-2 ${
                    isSelected ? 'ring-4 ring-blue-400 ring-opacity-60 shadow-lg' : 'shadow-md'
                  }`}
                  fill="white"
                  style={{ filter: isSelected ? 'brightness(1.05)' : 'none' }}
                />
                {/* Icon with background circle */}
                <circle
                  cx={pos.x + 30}
                  cy={pos.y + 28}
                  r="12"
                  fill="currentColor"
                  opacity="0.1"
                />
                <text
                  x={pos.x + 30}
                  y={pos.y + 32}
                  fontSize="16"
                  fontWeight="600"
                  fill="currentColor"
                  textAnchor="middle"
                >
                  {getNodeIcon(node.type)}
                </text>
                {/* Title */}
                <text
                  x={pos.x + 50}
                  y={pos.y + 28}
                  fontSize="13"
                  fontWeight="700"
                  fill="currentColor"
                  className="font-semibold"
                >
                  {node.title.length > 22 ? node.title.substring(0, 22) + '...' : node.title}
                </text>
                {/* Subtitle */}
                {node.subtitle && (
                  <text
                    x={pos.x + 15}
                    y={pos.y + 52}
                    fontSize="10"
                    fill="#475569"
                    fontWeight="500"
                  >
                    {node.subtitle.length > 32 ? node.subtitle.substring(0, 32) + '...' : node.subtitle}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Node Details Panel */}
      {selectedNodeData && (
        <div className="border-2 border-gray-200 rounded-xl bg-white shadow-lg p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{getNodeIcon(selectedNodeData.type as NodeType)}</span>
                <div className="text-base font-bold text-gray-900">{selectedNodeData.title}</div>
              </div>
              {selectedNodeData.subtitle && (
                <div className="text-sm text-gray-600 mt-1 leading-relaxed">{selectedNodeData.subtitle}</div>
              )}
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="ml-4 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-medium">Type:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getNodeColor(selectedNodeData.type as NodeType)}`}>
                {selectedNodeData.type}
              </span>
            </div>
            {selectedNodeData.meta && (
              <div>
                <div className="text-gray-500 font-medium mb-2">Additional Details:</div>
                <pre className="text-xs bg-gray-50 p-3 rounded-lg border border-gray-200 overflow-auto max-h-48 font-mono">
                  {JSON.stringify(selectedNodeData.meta, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Legend</div>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 bg-blue-100 border-2 border-blue-300 rounded-lg shadow-sm"></div>
            <span className="font-medium text-gray-700">Evidence</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 bg-purple-100 border-2 border-purple-300 rounded-lg shadow-sm"></div>
            <span className="font-medium text-gray-700">Claim</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 bg-yellow-100 border-2 border-yellow-300 rounded-lg shadow-sm"></div>
            <span className="font-medium text-gray-700">Hypothesis</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 bg-green-100 border-2 border-green-300 rounded-lg shadow-sm"></div>
            <span className="font-medium text-gray-700">Action</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 bg-red-100 border-2 border-red-300 rounded-lg shadow-sm"></div>
            <span className="font-medium text-gray-700">Conclusion</span>
          </div>
        </div>
      </div>
    </div>
  )
}
