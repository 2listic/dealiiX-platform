import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Edge, Node } from '@xyflow/svelte'
import type { ParameterExposure } from '../types/nodeTypes'
import { parameterHandle } from './parameterPorts'

let nodes: Node[] = []
let edges: Edge[] = []
const checkpoint = vi.fn()
const clearConnectionCache = vi.fn()

vi.mock('../stores/nodes.svelte', () => ({
  getNodes: () => nodes,
  setNodes: (next: Node[]) => {
    nodes = next
  },
  getEdges: () => edges,
  setEdges: (next: Edge[]) => {
    edges = next
  },
}))
vi.mock('../stores/graphStack.svelte', () => ({
  graphHistoryState: { checkpoint: () => checkpoint() },
}))
vi.mock('./connectionsValidation', () => ({
  clearConnectionCache: () => clearConnectionCache(),
}))

const {
  markParameterFile,
  setNodeParameterExposures,
  staleParameterEdges,
  unmarkParameterFile,
} = await import('./parameterNodeCanvas')

const refinements = ['Mesh', 'Refinements']
const exposure: ParameterExposure = {
  path: refinements,
  type: 'unsigned int',
  input: true,
  output: true,
}

// Literal 2 -> parameter input of 1; parameter output of 1 -> node 3; 2 -> 3.
const inputEdge: Edge = {
  id: 'in',
  source: '2',
  sourceHandle: 'output-0',
  target: '1',
  targetHandle: parameterHandle('input', refinements),
}
const outputEdge: Edge = {
  id: 'out',
  source: '1',
  sourceHandle: parameterHandle('output', refinements),
  target: '3',
  targetHandle: 'input-0',
}
const ordinaryEdge: Edge = {
  id: 'plain',
  source: '2',
  sourceHandle: 'output-0',
  target: '3',
  targetHandle: 'input-1',
}

describe('setNodeParameterExposures', () => {
  beforeEach(() => {
    nodes = [
      { id: '1', position: { x: 0, y: 0 }, data: { value: 'poisson.prm' } },
      { id: '2', position: { x: 0, y: 0 }, data: { value: 3 } },
    ]
    edges = [inputEdge, outputEdge, ordinaryEdge]
    checkpoint.mockReset()
    clearConnectionCache.mockReset()
  })

  it('writes the exposures to the node as one undoable edit', () => {
    setNodeParameterExposures('1', [exposure])

    expect(checkpoint).toHaveBeenCalledTimes(1)
    expect(clearConnectionCache).toHaveBeenCalledTimes(1)
    expect(nodes[0].data).toEqual({
      value: 'poisson.prm',
      parameter_file: { exposures: [exposure] },
    })
    expect(nodes[1].data).toEqual({ value: 3 })
    expect(edges).toEqual([inputEdge, outputEdge, ordinaryEdge])
  })

  it('removes the edges of a direction that is no longer exposed', () => {
    const inputOnly = { ...exposure, output: false }

    expect(staleParameterEdges('1', [inputOnly])).toEqual([outputEdge])

    setNodeParameterExposures('1', [inputOnly])

    expect(edges).toEqual([inputEdge, ordinaryEdge])
  })

  it('removes every edge of a parameter that is no longer exposed', () => {
    expect(staleParameterEdges('1', [])).toEqual([inputEdge, outputEdge])

    setNodeParameterExposures('1', [])

    expect(edges).toEqual([ordinaryEdge])
  })

  it('does nothing when the node is not in the current graph level', () => {
    const before = nodes

    setNodeParameterExposures('42', [])

    expect(nodes).toBe(before)
    expect(edges).toEqual([inputEdge, outputEdge, ordinaryEdge])
    expect(checkpoint).not.toHaveBeenCalled()
    expect(clearConnectionCache).not.toHaveBeenCalled()
  })
})

describe('markParameterFile / unmarkParameterFile', () => {
  beforeEach(() => {
    nodes = [
      {
        id: '1',
        position: { x: 0, y: 0 },
        data: {
          value: 'poisson.prm',
          parameter_file: { exposures: [exposure] },
        },
      },
      { id: '2', position: { x: 0, y: 0 }, data: { value: 3 } },
    ]
    edges = [inputEdge, outputEdge, ordinaryEdge]
    checkpoint.mockReset()
    clearConnectionCache.mockReset()
  })

  it('marks a node with no exposures as one undoable edit', () => {
    markParameterFile('2')

    expect(checkpoint).toHaveBeenCalledTimes(1)
    expect(nodes[1].data).toEqual({
      value: 3,
      parameter_file: { exposures: [] },
    })
    expect(edges).toEqual([inputEdge, outputEdge, ordinaryEdge])
  })

  it('unmarks a node and removes the edges of its parameter handles', () => {
    unmarkParameterFile('1')

    expect(checkpoint).toHaveBeenCalledTimes(1)
    expect(clearConnectionCache).toHaveBeenCalledTimes(1)
    expect(nodes[0].data).toEqual({ value: 'poisson.prm' })
    expect(edges).toEqual([ordinaryEdge])
  })

  it('does nothing when the node is not in the current graph level', () => {
    const before = nodes

    unmarkParameterFile('42')

    expect(nodes).toBe(before)
    expect(checkpoint).not.toHaveBeenCalled()
  })
})
