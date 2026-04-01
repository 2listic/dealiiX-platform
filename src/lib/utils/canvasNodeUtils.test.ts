import { describe, expect, it } from 'vitest'
import {
  NodeType,
  SELF,
  Type,
  TypeField,
  returnNodeName,
} from '../types/nodeTypes'
import {
  createCanvasNode,
  findCompatibleSourceNodeOptions,
  findCompatibleNodeOptions,
  formatSuggestedNodeName,
  getInputMetadata,
  getOutputMetadata,
} from './canvasNodeUtils'

describe('canvasNodeUtils', () => {
  it('extracts source type and connection name from a regular output', () => {
    const sourceNode = {
      id: '1',
      type: NodeType.CONSTRUCTOR,
      position: { x: 0, y: 0 },
      data: {
        type: 'Producer',
        node_type: NodeType.CONSTRUCTOR,
        inputs: [],
        outputs: [0],
        arguments: [
          {
            connection_type: 'output',
            name: 'mesh',
            type: Type.STRING,
          },
        ],
      },
    }

    expect(getOutputMetadata(sourceNode, 'output-0')).toEqual({
      sourceType: Type.STRING,
      connectionName: 'mesh',
    })
  })

  it('extracts source type from SELF outputs', () => {
    const sourceNode = {
      id: '1',
      type: NodeType.CONSTRUCTOR,
      position: { x: 0, y: 0 },
      data: {
        type: 'ConcreteType',
        base: 'BaseType',
        name: 'state',
        node_type: NodeType.CONSTRUCTOR,
        inputs: [],
        outputs: [SELF],
        arguments: [],
      },
    }

    expect(getOutputMetadata(sourceNode, 'output-0')).toEqual({
      sourceType: 'BaseType',
      connectionName: 'state',
    })
  })

  it('keeps the output argument name for elementary constructors', () => {
    const sourceNode = {
      id: '1',
      type: NodeType.ELEMENTARY_CONSTRUCTOR,
      position: { x: 0, y: 0 },
      data: {
        type: Type.INT,
        name: 'my_integer',
        node_type: NodeType.ELEMENTARY_CONSTRUCTOR,
        inputs: [],
        outputs: [0],
        arguments: [
          {
            connection_type: 'output',
            name: 'value',
            type: Type.INT,
          },
        ],
      },
    }

    expect(getOutputMetadata(sourceNode, 'output-0')).toEqual({
      sourceType: Type.INT,
      connectionName: 'value',
    })
  })

  it('finds compatible templates by matching source type or any', () => {
    const options = findCompatibleNodeOptions(
      [
        {
          type: 'Consumer',
          node_type: NodeType.FUNCTION,
          arguments: [
            {
              connection_type: 'input',
              name: 'mesh',
              type: Type.STRING,
            },
          ],
          inputs: [0],
          outputs: [],
        },
        {
          type: 'WildcardConsumer',
          node_type: NodeType.FUNCTION,
          arguments: [
            {
              connection_type: 'input',
              name: 'value',
              type: Type.ANY,
            },
          ],
          inputs: [0],
          outputs: [],
        },
        {
          type: TypeField.CORAL_NETWORK,
          node_type: NodeType.NETWORK,
          name: 'Nested',
          value: {
            author: '',
            date_time_utc: '',
            version: 1,
            workflow: { nodes: {}, edges: {} },
          },
          arguments: [
            {
              connection_type: 'input',
              name: 'networkInput',
              type: Type.STRING,
            },
          ],
          inputs: [0],
          outputs: [],
        },
      ],
      Type.STRING,
      'Consumer'
    )

    expect(options).toHaveLength(2)
    expect(options.map((option) => option.template.type)).toEqual([
      'WildcardConsumer',
      TypeField.CORAL_NETWORK,
    ])
    expect(options[0].argumentName).toBe('value')
    expect(options[1].argumentName).toBe('networkInput')
  })

  it('extracts input metadata from a target handle', () => {
    const targetNode = {
      id: '2',
      type: NodeType.FUNCTION,
      position: { x: 0, y: 0 },
      data: {
        type: 'Consumer',
        node_type: NodeType.FUNCTION,
        inputs: [0],
        outputs: [],
        arguments: [
          {
            connection_type: 'input',
            name: 'rhs',
            type: Type.INT,
          },
        ],
      },
    }

    expect(getInputMetadata(targetNode, 'input-0')).toEqual({
      expectedInputType: Type.INT,
      connectionName: 'rhs',
    })
  })

  it('finds compatible producer templates for a target input', () => {
    const options = findCompatibleSourceNodeOptions(
      [
        {
          type: 'Producer',
          node_type: NodeType.CONSTRUCTOR,
          arguments: [
            {
              connection_type: 'output',
              name: 'rhs',
              type: Type.INT,
            },
          ],
          inputs: [],
          outputs: [0],
        },
        {
          type: 'SelfProducer',
          base: 'Vector',
          node_type: NodeType.CONSTRUCTOR,
          arguments: [],
          inputs: [],
          outputs: [SELF],
        },
      ],
      Type.INT,
      'Producer'
    )

    expect(options).toHaveLength(0)
  })

  it('formats suggested names for display', () => {
    expect(formatSuggestedNodeName('my_connection_name')).toBe(
      'My connection name'
    )
  })

  it('builds default node names from the destination template', () => {
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
    const template = {
      type: 'Consumer',
      node_type: NodeType.FUNCTION,
      arguments: [],
      inputs: [],
      outputs: [],
    }

    const node = createCanvasNode(template, { x: 10, y: 20 }, { name: 'mesh' })

    expect(node.data).not.toBe(template)
    expect(node.data.name).toBe('mesh')
  })
})
