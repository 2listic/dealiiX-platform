import { beforeEach, describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/svelte'
import {
  ConnectionType,
  NodeType,
  Type,
  type NodeDefinitions,
  type StandardNodeDefinition,
} from '../types/nodeTypes'
import { createOverloadNodeDefinition } from '../registry/overloadResolution'
import { setEdges, setNodes } from './nodes.svelte'
import { getOverloadCandidates } from './overloadResolution.svelte'

const definition = (
  type: string,
  inputTypes: string[],
  outputType: string
): StandardNodeDefinition => ({
  type,
  operation: type,
  arguments: inputTypes.map((inputType, index) => ({
    connection_type: ConnectionType.INPUT,
    name: `input ${index}`,
    type: inputType as Type,
  })),
  inputs: inputTypes.map((_, index) => index),
  outputs: [-1],
  output_type: outputType,
  node_type: NodeType.FUNCTION,
})

const node = (
  id: string,
  data: NodeDefinitions,
  x = 0
): Node<NodeDefinitions> => ({
  id,
  type: data.node_type,
  data,
  position: { x, y: 0 },
})

const fieldToGradient: Edge = {
  id: 'e',
  source: 'field',
  target: 'gradient',
  sourceHandle: 'output-0',
  targetHandle: 'input-0',
}

const family = createOverloadNodeDefinition([
  definition('gradient<scalar>', ['ScalarField'], 'ScalarGradient'),
  definition('gradient<vector>', ['VectorField'], 'VectorGradient'),
])
const field = definition('field', [], 'ScalarField')

describe('getOverloadCandidates', () => {
  beforeEach(() => {
    setNodes([node('field', field), node('gradient', family)])
    setEdges([fieldToGradient])
  })

  it('resolves a family from its edges', () => {
    expect(getOverloadCandidates('gradient')?.map((c) => c.type)).toEqual([
      'gradient<scalar>',
    ])
    expect(getOverloadCandidates('field')).toBeUndefined()
  })

  it('keeps the same result when a node only moves or is selected', () => {
    const before = getOverloadCandidates('gradient')

    setNodes([
      { ...node('field', field, 120), selected: true },
      node('gradient', family, 40),
    ])
    setEdges([{ ...fieldToGradient, selected: true }])

    expect(getOverloadCandidates('gradient')).toBe(before)
  })

  it('resolves again when an edge or a node definition changes', () => {
    const before = getOverloadCandidates('gradient')

    setEdges([])
    const disconnected = getOverloadCandidates('gradient')
    expect(disconnected).not.toBe(before)
    expect(disconnected).toHaveLength(2)

    setEdges([fieldToGradient])
    setNodes([
      node('field', definition('field', [], 'VectorField')),
      node('gradient', family),
    ])
    expect(getOverloadCandidates('gradient')?.map((c) => c.type)).toEqual([
      'gradient<vector>',
    ])
  })
})
