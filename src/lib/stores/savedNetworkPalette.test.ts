import { expect, it } from 'vitest'
import {
  NodeType,
  TypeField,
  type SubGraphNodeDefinition,
} from '../types/nodeTypes'
import { graphStackState } from './graphStack.svelte'
import {
  getStoredNetworkNodes,
  setNetworkNodes,
  setServiceRegistry,
} from './registryStore.svelte'

const savedNetwork = (
  name: string,
  backendId?: string
): SubGraphNodeDefinition => ({
  type: TypeField.CORAL_NETWORK,
  node_type: NodeType.NETWORK,
  name,
  arguments: [],
  inputs: [],
  outputs: [],
  value: {
    author: '',
    date_time_utc: '',
    version: 1,
    ...(backendId && { backend: { id: backendId } }),
    workflow: { nodes: {}, edges: {} },
  },
})

it('only exposes saved networks with a matching backend ID as the editor navigates', async () => {
  const names = () => getStoredNetworkNodes().map(({ name }) => name)
  graphStackState.reset()
  await setNetworkNodes({
    root: savedNetwork('Root graph', 'orchestrator'),
    child: savedNetwork('CORAL subnetwork', 'coral'),
    legacy: savedNetwork('No backend'),
  })
  setServiceRegistry({ __backend: { id: 'orchestrator' } })
  expect(names()).toEqual(['Root graph'])

  graphStackState.pushContext({
    label: 'CORAL child',
    originalName: null,
    parentNodeId: '0',
    registry: { nodes: {}, backend: { id: 'coral', plugin: 'immersx' } },
    current: { nodes: [], edges: [] },
    past: [],
    future: [],
  })
  expect(names()).toEqual(['CORAL subnetwork'])
  graphStackState.updateTopContext({ registry: { nodes: {} } })
  expect(names()).toEqual([])
  graphStackState.reset()
  expect(names()).toEqual(['Root graph'])
})
