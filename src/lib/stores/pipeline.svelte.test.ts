import { describe, expect, it, beforeEach } from 'vitest'
import { pipelineState, getNodesSnapshot } from './pipeline.svelte'
import type { PipelineFile, PipelineStage } from '../types/pipelineTypes'

/** A coral stage in the download/import file format. */
const coralFileStage = (
  id: string,
  position = { x: 0, y: 0 }
): PipelineStage => ({
  id,
  type: 'coralStage',
  position,
  name: id,
  graph: { workflow: id },
  config: {
    coralBinaryPath: '/coral',
    coralPluginPath: '/plugin',
    nodes: 1,
    tasksPerNode: 1,
    timeLimit: '01:00:00',
    useMpi: false,
  },
})

/** Wraps stages/edges into a full {@link PipelineFile} (with envelope). */
const file = (
  stages: PipelineStage[],
  edges: [string, string][] = []
): PipelineFile => ({
  pipeline: {
    nodes: stages,
    edges: edges.map(([source, target]) => ({ source, target })),
  },
  version: 1,
  author: 'dealiix-platform',
  date_time_utc: '2026-01-01T00:00:00.000Z',
})

beforeEach(() => {
  pipelineState.clear()
})

describe('pipelineState.load', () => {
  it('rebuilds canvas nodes (id/type/position/data) and edges from a file', () => {
    const loaded = file(
      [
        coralFileStage('p0', { x: 10, y: 20 }),
        coralFileStage('p3', { x: 30, y: 40 }),
      ],
      [['p0', 'p3']]
    )

    pipelineState.load(loaded)

    const nodes = getNodesSnapshot()
    expect(nodes.map((n) => n.id)).toEqual(['p0', 'p3'])
    expect(nodes[0].type).toBe('coralStage')
    expect(nodes[0].position).toEqual({ x: 10, y: 20 })
    // Flat file fields are re-nested under `data` (minus id/type/position).
    expect(nodes[0].data).toMatchObject({
      name: 'p0',
      graph: { workflow: 'p0' },
    })
    expect(nodes[0].data).not.toHaveProperty('id')
    expect(nodes[0].data).not.toHaveProperty('type')
    expect(nodes[0].data).not.toHaveProperty('position')
    expect(pipelineState.edges).toEqual([
      { id: 'xy-edge__p0-p3', source: 'p0', target: 'p3' },
    ])
  })

  it('resyncs the stage counter so a new stage does not collide with loaded ids', () => {
    pipelineState.load(file([coralFileStage('p0'), coralFileStage('p3')]))

    pipelineState.addCoralStage({
      name: 'new stage',
      graph: {},
      coralBinaryPath: '/coral',
      coralPluginPath: '/plugin',
    })

    const ids = getNodesSnapshot().map((n) => n.id)
    expect(ids).toContain('p4')
    expect(new Set(ids).size).toBe(ids.length) // no duplicate ids
  })

  it('resets the counter to 1 on an empty load', () => {
    pipelineState.load(file([]))

    pipelineState.addCoralStage({
      name: 'first stage',
      graph: {},
      coralBinaryPath: '/coral',
      coralPluginPath: '/plugin',
    })

    expect(getNodesSnapshot().map((n) => n.id)).toEqual(['p1'])
  })

  it('ignores the metadata envelope on the file', () => {
    // A file whose envelope differs from the app's — load must not choke on it.
    const loaded = file([coralFileStage('p0')])
    loaded.author = 'someone-else'
    loaded.version = 99
    expect(() => pipelineState.load(loaded)).not.toThrow()
    expect(getNodesSnapshot()).toHaveLength(1)
  })
})

describe('pipelineState.toPipeline', () => {
  it('returns flat nodes/edges with id/type/position + payload per stage', () => {
    pipelineState.load(file([coralFileStage('p0', { x: 5, y: 6 })]))

    const pipeline = pipelineState.toPipeline()

    expect(Object.keys(pipeline).sort()).toEqual(['edges', 'nodes'])
    expect(pipeline.nodes).toHaveLength(1)
    const [node] = pipeline.nodes
    expect(node).toMatchObject({
      id: 'p0',
      type: 'coralStage',
      position: { x: 5, y: 6 },
      name: 'p0',
    })
  })

  it('round-trips: load(export) restores the same nodes/edges', () => {
    const original = file(
      [
        coralFileStage('p0', { x: 1, y: 2 }),
        coralFileStage('p1', { x: 3, y: 4 }),
      ],
      [['p0', 'p1']]
    )
    pipelineState.load(original)

    const exported = pipelineState.toPipeline()

    expect(exported.nodes).toEqual(original.pipeline.nodes)
    expect(exported.edges).toEqual(original.pipeline.edges)
  })
})
