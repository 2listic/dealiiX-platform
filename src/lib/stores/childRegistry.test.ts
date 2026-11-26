import { expect, it } from 'vitest'
import { createCanvasNode } from '../graph/canvasNodeUtils'
import {
  importGraphFromProtocol,
  parseGraphWithQualifiedIds,
} from '../graph/graphParser'
import { enterSubnetwork, loadParentGraph } from './graphNavigation.svelte'
import { graphStackState } from './graphStack.svelte'
import { getNodesSnapshot, setEdges, setNodes } from './nodes.svelte'
import {
  getAvailableNodes,
  getNodeData,
  setRegistry,
  setActiveLocation,
} from './registryStore.svelte'

it('uses the registered CORAL palette inside each instance and restores its parent palette', async () => {
  const ports = { arguments: [], inputs: [], outputs: [] }
  const innerType = 'child::literal'
  const outerType = 'parent::operation'
  const networkType = 'network::coral'

  await setRegistry(
    {
      [outerType]: { ...ports, type: outerType, node_type: 'void_function' },
      [networkType]: {
        ...ports,
        type: networkType,
        node_type: 'network',
        value: {
          registry: {
            [innerType]: {
              ...ports,
              type: innerType,
              node_type: 'elementary_constructor',
              outputs: [-1],
              value: 'child value',
            },
          },
        },
      },
    },
    'local'
  )
  setActiveLocation('local')
  graphStackState.reset()
  const definition = getNodeData(networkType)
  const first = createCanvasNode(definition, { x: 0, y: 0 })
  const second = createCanvasNode(definition, { x: 10, y: 0 })
  setNodes([first, second])
  setEdges([])

  await enterSubnetwork(first.id)
  expect(getAvailableNodes().map(({ type }) => type)).toEqual([innerType])
  setNodes([createCanvasNode(getNodeData(innerType), { x: 0, y: 0 })])
  await loadParentGraph()

  expect(getAvailableNodes().map(({ type }) => type)).toEqual([
    outerType,
    networkType,
  ])
  const saved = parseGraphWithQualifiedIds(getNodesSnapshot(), [])
  const { nodes } = saved.workflow
  expect(nodes[first.id].value).toMatchObject({
    backend: { id: 'coral' },
    workflow: { nodes: expect.any(Object) },
  })
  const child = nodes[first.id].value as { workflow: { nodes: object } }
  expect(Object.values(child.workflow.nodes)).toMatchObject([
    { type: innerType },
  ])
  expect(nodes[second.id].value).toMatchObject({ workflow: { nodes: {} } })
  expect(JSON.stringify(nodes)).not.toContain('"registry"')

  await importGraphFromProtocol(saved)
  await enterSubnetwork(first.id)
  expect(getAvailableNodes().map(({ type }) => type)).toEqual([innerType])
  expect(getNodesSnapshot().map(({ data }) => data.type)).toEqual([innerType])
  await loadParentGraph()
})
