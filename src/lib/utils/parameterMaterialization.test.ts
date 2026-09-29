import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NodeType, SELF } from '../types/nodeTypes'
import { parameterHandle } from './parameterPorts'

const access = vi.hoisted(() => ({
  readParameterFile: vi.fn(),
  writeParameterFile: vi.fn(),
  parameterFileTarget: vi.fn((location: string, fileName: string) => ({
    location,
    workingDirectory: '/work',
    fileName,
  })),
}))

vi.mock('./parameterFileAccess', () => access)

import { materializeParameterGraph } from './parameterMaterialization'

describe('materializeParameterGraph', () => {
  beforeEach(() => {
    access.readParameterFile.mockResolvedValue({
      resolvedPath: '/work/parameters.prm',
      content: 'subsection Solver\nset Tolerance = 1e-3\nend\n',
    })
    access.writeParameterFile.mockReset()
  })

  it('writes materialized values into the run directory', async () => {
    const inputHandle = parameterHandle('input', ['Solver', 'Tolerance'])
    const outputHandle = parameterHandle('output', ['Solver', 'Tolerance'])
    const nodes = [
      {
        id: '1',
        position: { x: 0, y: 0 },
        data: {
          type: 'std::string',
          node_type: NodeType.ELEMENTARY_CONSTRUCTOR,
          arguments: [],
          inputs: [],
          outputs: [SELF],
          value: 'parameters.prm',
          parameter_file: {
            exposures: [
              {
                path: ['Solver', 'Tolerance'],
                type: 'double',
                input: true,
                output: true,
              },
            ],
          },
        },
      },
      {
        id: '2',
        position: { x: 0, y: 0 },
        data: {
          type: 'double',
          node_type: NodeType.ELEMENTARY_CONSTRUCTOR,
          arguments: [],
          inputs: [],
          outputs: [SELF],
          value: '0.02',
        },
      },
      {
        id: '3',
        position: { x: 0, y: 0 },
        data: {
          type: 'consumer',
          node_type: NodeType.VOID_METHOD,
          arguments: [
            { connection_type: 'input', name: 'value', type: 'double' },
          ],
          inputs: [0],
          outputs: [],
        },
      },
    ] as any
    const edges = [
      {
        id: 'parameter-input',
        source: '2',
        sourceHandle: 'output-0',
        target: '1',
        targetHandle: inputHandle,
      },
      {
        id: 'parameter-output',
        source: '1',
        sourceHandle: outputHandle,
        target: '3',
        targetHandle: 'input-0',
      },
    ] as any

    const result = await materializeParameterGraph(
      'local',
      nodes,
      edges,
      {},
      '/run'
    )

    expect(access.writeParameterFile).toHaveBeenCalledTimes(1)
    expect(access.writeParameterFile.mock.calls[0][0]).toMatchObject({
      workingDirectory: '/run',
      fileName: 'parameters.prm',
    })
    expect(access.writeParameterFile.mock.calls[0][1]).toContain(
      'set Tolerance = 0.02'
    )
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].target).toBe('3')
    expect(result.edges[0].sourceHandle).toBe('output-0')
    expect(
      result.nodes.find((node) => node.id === '1')?.data.parameter_file
    ).toBeUndefined()
    expect(
      result.nodes.find(
        (node) => node.id !== '1' && node.id !== '2' && node.id !== '3'
      )?.data.value
    ).toBe('0.02')
  })
})
