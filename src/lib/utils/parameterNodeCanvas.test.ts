import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Node } from '@xyflow/svelte'
import type { ParameterExposure } from '../types/nodeTypes'

let nodes: Node[] = []
const checkpoint = vi.fn()
const clearConnectionCache = vi.fn()

vi.mock('../stores/nodes.svelte', () => ({
  getNodes: () => nodes,
  setNodes: (next: Node[]) => {
    nodes = next
  },
}))
vi.mock('../stores/graphStack.svelte', () => ({
  graphHistoryState: { checkpoint: () => checkpoint() },
}))
vi.mock('./connectionsValidation', () => ({
  clearConnectionCache: () => clearConnectionCache(),
}))

const { setNodeParameterExposures } = await import('./parameterNodeCanvas')

const exposure: ParameterExposure = {
  path: ['Mesh', 'Refinements'],
  type: 'unsigned int',
  input: true,
  output: false,
}

describe('setNodeParameterExposures', () => {
  beforeEach(() => {
    nodes = [
      { id: '1', position: { x: 0, y: 0 }, data: { value: 'poisson.prm' } },
      { id: '2', position: { x: 0, y: 0 }, data: { value: 3 } },
    ]
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
  })

  it('does nothing when the node is not in the current graph level', () => {
    const before = nodes

    setNodeParameterExposures('42', [exposure])

    expect(nodes).toBe(before)
    expect(checkpoint).not.toHaveBeenCalled()
    expect(clearConnectionCache).not.toHaveBeenCalled()
  })
})
