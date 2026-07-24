import { describe, expect, it } from 'vitest'
import {
  parentsOf,
  resolveExecutionOrder,
  PipelineCycleError,
} from './executionOrder'
import type { Pipeline, PipelineStage } from '../types/pipelineTypes'

const stage = (id: string): PipelineStage => ({
  id,
  type: 'coralStage',
  position: { x: 0, y: 0 },
  name: id,
  graph: {},
  config: {
    coralBinaryPath: '/coral',
    coralPluginPath: '/plugin',
    nodes: 1,
    tasksPerNode: 1,
    timeLimit: '01:00:00',
    useMpi: false,
  },
})

const pipeline = (ids: string[], edges: [string, string][]): Pipeline => ({
  nodes: ids.map(stage),
  edges: edges.map(([source, target]) => ({ source, target })),
})

/** Asserts `before` appears earlier than `after` in the ordered id list. */
const precedes = (order: string[], before: string, after: string) =>
  order.indexOf(before) < order.indexOf(after)

describe('resolveExecutionOrder', () => {
  it('orders a linear chain a → b → c', () => {
    const order = resolveExecutionOrder(
      pipeline(
        ['a', 'b', 'c'],
        [
          ['a', 'b'],
          ['b', 'c'],
        ]
      )
    ).map((s) => s.id)
    expect(order).toEqual(['a', 'b', 'c'])
  })

  it('orders a diamond so the fan-in node comes last', () => {
    // a → b, a → c, b → d, c → d
    const order = resolveExecutionOrder(
      pipeline(
        ['a', 'b', 'c', 'd'],
        [
          ['a', 'b'],
          ['a', 'c'],
          ['b', 'd'],
          ['c', 'd'],
        ]
      )
    ).map((s) => s.id)
    expect(precedes(order, 'a', 'b')).toBe(true)
    expect(precedes(order, 'a', 'c')).toBe(true)
    expect(precedes(order, 'b', 'd')).toBe(true)
    expect(precedes(order, 'c', 'd')).toBe(true)
  })

  it('includes disconnected stages', () => {
    const order = resolveExecutionOrder(
      pipeline(['a', 'b', 'c'], [['a', 'b']])
    ).map((s) => s.id)
    expect(order).toHaveLength(3)
    expect(new Set(order)).toEqual(new Set(['a', 'b', 'c']))
    expect(precedes(order, 'a', 'b')).toBe(true)
  })

  it('throws PipelineCycleError on a cycle', () => {
    expect(() =>
      resolveExecutionOrder(
        pipeline(
          ['a', 'b'],
          [
            ['a', 'b'],
            ['b', 'a'],
          ]
        )
      )
    ).toThrow(PipelineCycleError)
  })

  it('ignores edges referencing unknown stages', () => {
    const order = resolveExecutionOrder(
      pipeline(
        ['a', 'b'],
        [
          ['a', 'b'],
          ['ghost', 'a'],
        ]
      )
    ).map((s) => s.id)
    expect(order).toEqual(['a', 'b'])
  })
})

describe('parentsOf', () => {
  it('returns the deduplicated direct parents', () => {
    const edges = [
      { source: 'a', target: 'c' },
      { source: 'b', target: 'c' },
      { source: 'a', target: 'c' },
    ]
    expect(parentsOf('c', edges).sort()).toEqual(['a', 'b'])
    expect(parentsOf('a', edges)).toEqual([])
  })
})
