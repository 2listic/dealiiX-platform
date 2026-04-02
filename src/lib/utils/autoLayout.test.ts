import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/svelte'
import { applyAutoLayout } from './autoLayout'

const makeNode = (id: string, width = 120, height = 80): Node =>
  ({
    id,
    type: 'test',
    position: { x: 0, y: 0 },
    width,
    height,
    data: {},
  }) as Node

const makeEdge = (source: string, target: string): Edge =>
  ({
    id: `${source}-${target}`,
    source,
    target,
  }) as Edge

describe('applyAutoLayout', () => {
  it('returns an empty array for empty graphs', () => {
    expect(applyAutoLayout([], [])).toEqual([])
  })

  it('lays out a simple chain left-to-right by default', () => {
    const nodes = [makeNode('1'), makeNode('2'), makeNode('3')]
    const edges = [makeEdge('1', '2'), makeEdge('2', '3')]

    const layouted = applyAutoLayout(nodes, edges, 'LR')

    expect(layouted[0].position.x).toBeLessThan(layouted[1].position.x)
    expect(layouted[1].position.x).toBeLessThan(layouted[2].position.x)
  })

  it('lays out a simple chain top-to-bottom when requested', () => {
    const nodes = [makeNode('1'), makeNode('2'), makeNode('3')]
    const edges = [makeEdge('1', '2'), makeEdge('2', '3')]

    const layouted = applyAutoLayout(nodes, edges, 'TB')

    expect(layouted[0].position.y).toBeLessThan(layouted[1].position.y)
    expect(layouted[1].position.y).toBeLessThan(layouted[2].position.y)
  })

  it('uses measured sizes when explicit width and height are missing', () => {
    const nodes = [
      {
        id: '1',
        type: 'test',
        position: { x: 0, y: 0 },
        measured: { width: 300, height: 140 },
        data: {},
      } as Node,
      makeNode('2'),
    ]

    const layouted = applyAutoLayout(nodes, [makeEdge('1', '2')], 'LR')

    expect(layouted[0].position.x).not.toBe(0)
    expect(layouted[1].position.x).toBeGreaterThan(layouted[0].position.x)
  })
})
