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
  // verifies the early-return guard that prevents dagre from throwing on an empty graph
  it('returns an empty array for empty graphs', () => {
    expect(applyAutoLayout([], [])).toEqual([])
  })

  // confirms dagre assigns strictly increasing x coordinates along the rank axis for LR;
  // x is checked (not y) because LR advances horizontally
  it('lays out a simple chain left-to-right by default', () => {
    const nodes = [makeNode('1'), makeNode('2'), makeNode('3')]
    const edges = [makeEdge('1', '2'), makeEdge('2', '3')]

    const layouted = applyAutoLayout(nodes, edges, 'LR')

    expect(layouted[0].position.x).toBeLessThan(layouted[1].position.x)
    expect(layouted[1].position.x).toBeLessThan(layouted[2].position.x)
  })

  // mirrors the LR test but on the y axis to confirm the direction parameter actually
  // changes which axis dagre uses for ranking; TB and LR are tested separately because
  // dagre treats them as distinct layout modes with different coordinate semantics
  it('lays out a simple chain top-to-bottom when requested', () => {
    const nodes = [makeNode('1'), makeNode('2'), makeNode('3')]
    const edges = [makeEdge('1', '2'), makeEdge('2', '3')]

    const layouted = applyAutoLayout(nodes, edges, 'TB')

    expect(layouted[0].position.y).toBeLessThan(layouted[1].position.y)
    expect(layouted[1].position.y).toBeLessThan(layouted[2].position.y)
  })

  // confirms the measured? fallback path with LR direction: node '1' has only measured
  // sizes (no explicit width/height, which is the normal case for rendered canvas nodes)
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

    expect(layouted[0].position.x).toBeLessThan(layouted[1].position.x)
  })

  // confirms the measured? fallback path with TB direction: both nodes have only measured
  // sizes (no explicit width/height, which is the normal case for rendered canvas nodes);
  // y ordering is checked because TB advances vertically
  it('uses measured sizes with top-to-bottom direction', () => {
    const nodes = [
      {
        id: '1',
        type: 'test',
        position: { x: 0, y: 0 },
        measured: { width: 240, height: 120 },
        data: {},
      } as Node,
      {
        id: '2',
        type: 'test',
        position: { x: 0, y: 0 },
        measured: { width: 240, height: 120 },
        data: {},
      } as Node,
    ]

    const layouted = applyAutoLayout(nodes, [makeEdge('1', '2')], 'TB')

    expect(layouted[0].position.y).toBeLessThan(layouted[1].position.y)
  })
})
