import { describe, expect, it } from 'vitest'
import defaultRegistry from '../data/defaultNodes.json'
import defaultNetworkNodes from '../data/defaultNetworkNodes.json'
import {
  NodeType,
  TypeField,
  Type,
  returnNodeName,
  type NodeDefinitions,
  type RegisteredNodes,
  type RegisteredSubGraphNodes,
} from '../types/nodeTypes'
import {
  createCanvasNode,
  findCompatibleSourceNodesAsOptions,
  findCompatibleTargetNodesAsOptions,
  formatSuggestedNodeName,
  getInputTypeAndName,
  getOutputTypeAndName,
} from './canvasNodeUtils'

const registry = defaultRegistry as unknown as RegisteredNodes
const networkNodes = defaultNetworkNodes as unknown as RegisteredSubGraphNodes

describe('canvasNodeUtils', () => {
  it('extracts source type and connection name from a regular output', () => {
    // GridGenerator<2> has outputs: [0] → arguments[0] = pass_through triangulation
    const sourceNode = {
      id: '1',
      type: NodeType.VOID_FUNCTION,
      position: { x: 0, y: 0 },
      data: structuredClone(
        registry['GridGenerator::generate_from_name_and_arguments<2>']
      ),
    }

    expect(getOutputTypeAndName(sourceNode, 'output-0')).toEqual({
      connectionType: 'dealii::Triangulation<2, 2>',
      connectionName: 'triangulation',
    })
  })

  it('extracts source type from SELF outputs', () => {
    // FE_Q<2, 2> has outputs: [-1] (SELF), base: 'dealii::FiniteElement<2, 2>'
    const sourceNode = {
      id: '1',
      type: NodeType.CONSTRUCTOR,
      position: { x: 0, y: 0 },
      data: {
        ...structuredClone(registry['dealii::FE_Q<2, 2>']),
        name: 'my_fe',
      },
    }

    expect(getOutputTypeAndName(sourceNode, 'output-0')).toEqual({
      connectionType: 'dealii::FiniteElement<2, 2>',
      connectionName: 'my_fe',
    })
  })

  it('falls back to the node type when an elementary constructor has no base', () => {
    // int has outputs: [-1] (SELF), no base — connectionName comes from the node name
    const sourceNode = {
      id: '1',
      type: NodeType.ELEMENTARY_CONSTRUCTOR,
      position: { x: 0, y: 0 },
      data: { ...structuredClone(registry['int']), name: 'my_integer' },
    }

    expect(getOutputTypeAndName(sourceNode, 'output-0')).toEqual({
      connectionType: 'int',
      connectionName: 'my_integer',
    })
  })

  it('finds compatible nodes by matching source type, excluding the source node', () => {
    // LaplaceProblem::run<2>: inputs=[0,1], arguments[1]='std::string' → match at handle-1
    // LaplaceProblem::run<1,2>: same structure → EXCLUDED
    // dealii::FE_Q<2, 2>: inputs=[0], arguments[0]='unsigned int' → no match
    const availableNodes = [
      registry['LaplaceProblem::run<2>'],
      registry['LaplaceProblem::run<1,2>'],
      registry['dealii::FE_Q<2, 2>'],
    ] as NodeDefinitions[]

    const options = findCompatibleTargetNodesAsOptions(
      availableNodes,
      Type.STRING,
      'LaplaceProblem::run<1,2>'
    )

    expect(options).toHaveLength(1)
    expect(options[0].nodeDefinition.type).toBe('LaplaceProblem::run<2>')
    expect(options[0].handleId).toBe('input-1')
    expect(options[0].argumentName).toBe('output_dir')
  })

  it('includes network nodes in compatibility results', () => {
    // step1 triangulation input free: string inputs at handles 1, 2, 4
    // dealii::FE_Q<2, 2>: uint input → no match
    const availableNodes = [
      networkNodes['step1 triangulation input free'],
      registry['dealii::FE_Q<2, 2>'],
    ] as NodeDefinitions[]

    const options = findCompatibleTargetNodesAsOptions(
      availableNodes,
      Type.STRING
    )

    expect(options).toHaveLength(3)
    expect(options.map((o) => o.nodeDefinition.type)).toEqual([
      TypeField.CORAL_NETWORK,
      TypeField.CORAL_NETWORK,
      TypeField.CORAL_NETWORK,
    ])
  })

  it('extracts input metadata from a target handle', () => {
    // dealii::FE_Q<2, 2>: inputs=[0], arguments[0]={ 'fe_degree', 'unsigned int' }
    const targetNode = {
      id: '2',
      type: NodeType.CONSTRUCTOR,
      position: { x: 0, y: 0 },
      data: structuredClone(registry['dealii::FE_Q<2, 2>']),
    }

    expect(getInputTypeAndName(targetNode, 'input-0')).toEqual({
      connectionType: Type.UNSIGNED_INT,
      connectionName: 'fe_degree',
    })
  })

  it('finds compatible producer nodes for a target input, excluding the target type', () => {
    // Looking for nodes that output 'unsigned int'
    // 'unsigned int' elementary constructor: SELF output type 'unsigned int' → EXCLUDED
    // dealii::FE_Q<2, 2>: SELF with base 'dealii::FiniteElement<2, 2>' → wrong output type
    const availableNodes = [
      registry['unsigned int'],
      registry['dealii::FE_Q<2, 2>'],
    ] as NodeDefinitions[]

    const options = findCompatibleSourceNodesAsOptions(
      availableNodes,
      Type.UNSIGNED_INT,
      'unsigned int'
    )

    expect(options).toHaveLength(0)
  })

  it('formats suggested names for display', () => {
    expect(formatSuggestedNodeName('my_connection_name')).toBe(
      'My connection name'
    )
  })

  it('builds default node names from the node definition type', () => {
    expect(
      returnNodeName({
        type: 'target_node_type',
        node_type: NodeType.FUNCTION,
        arguments: [],
        inputs: [],
        outputs: [],
      })
    ).toBe('Target node type')
  })

  it('clones created nodes and applies the requested name', () => {
    const nodeDefinition = registry['LaplaceProblem::run<2>'] as NodeDefinitions

    const node = createCanvasNode(
      nodeDefinition,
      { x: 10, y: 20 },
      { name: 'my_run' }
    )

    expect(node.data).not.toBe(nodeDefinition)
    expect(node.data.name).toBe('my_run')
  })
})
