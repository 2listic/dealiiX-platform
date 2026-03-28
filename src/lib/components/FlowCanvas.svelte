<script module>
  import UnifiedNode from './nodes/UnifiedNode.svelte'
</script>

<script lang="ts">
  import {
    SvelteFlow,
    Background,
    MiniMap,
    type EdgeTypes,
    type NodeTypes,
    Controls,
    Panel,
    useSvelteFlow,
    type OnConnectEnd,
  } from '@xyflow/svelte'

  import '@xyflow/svelte/dist/base.css'
  import CustomEdge from './edges/CustomEdge.svelte'
  import {
    getNodes,
    getEdges,
    setNodes,
    setEdges,
  } from '../stores/nodes.svelte'
  import { colorModeState } from '../stores/colorModeStore.svelte'
  import { dndNodeDataState } from '../stores/dndStore.svelte.js'
  import { currentProjectState } from '../stores/currentProjectStore.svelte'
  import {
    clearConnectionCache,
    isValidConnection,
  } from '../utils/connectionsValidation'
  import { onDragOver, onDrop } from '../utils/dragAndDrop.svelte'
  import { NodeType, NodeTypePyBackend } from '../types/nodeTypes'
  import ButtonToggleDarkMode from './layout/ButtonToggleDarkMode.svelte'
  import JobsTable from './layout/JobsTable.svelte'
  import {
    getAvailableNodes,
    getNextNodeId,
    getStoredNetworkNodes,
  } from '../stores/nodes.svelte'
  import {
    createCanvasNode,
    createCustomEdge,
    findCompatibleNodeOptions,
    findCompatibleSourceNodeOptions,
    getSuggestedCreatedNodeName,
    getInputMetadata,
    getOutputMetadata,
    type CompatibleNodeOption,
  } from '../utils/flowNodeCreation'
  import { toastState } from '../stores/toastsStore.svelte'
  import { getModal } from './layout/Modal.svelte'
  import CreateConnectedNodeModal from './nodes/CreateConnectedNodeModal.svelte'

  const { screenToFlowPosition, getNode, getIntersectingNodes } = useSvelteFlow()
  const createConnectedNodeModalId = 'create-connected-node'

  let canvasElement = $state<HTMLDivElement>()
  let createConnectedNodeOptions = $state<CompatibleNodeOption[]>([])
  let createConnectedNodeName = $state('')
  let createConnectedNodeSourceType = $state('')
  let createConnectedNodePosition = $state({ x: 0, y: 0 })
  let activeConnectionStart = $state<{
    nodeId: string
    handleId: string
    handleType: 'source' | 'target'
  } | null>(null)
  let pendingConnection = $state<
    | {
        direction: 'forward'
        source: string
        sourceHandle: string
      }
    | {
        direction: 'backward'
        target: string
        targetHandle: string
      }
    | null
  >(null)

  const nodeTypes: NodeTypes = {
    [NodeType.ELEMENTARY_CONSTRUCTOR]: UnifiedNode,
    [NodeType.EMPTY_CONSTRUCTOR]: UnifiedNode,
    [NodeType.CONSTRUCTOR]: UnifiedNode,
    [NodeType.ABSTRACT]: UnifiedNode,
    [NodeType.VOID_METHOD]: UnifiedNode,
    [NodeType.VOID_CONST_METHOD]: UnifiedNode,
    [NodeType.VOID_FUNCTION]: UnifiedNode,
    [NodeType.FUNCTION]: UnifiedNode,
    [NodeType.NETWORK]: UnifiedNode,
    [NodeTypePyBackend.PRIMITIVE]: UnifiedNode,
    [NodeTypePyBackend.METHOD]: UnifiedNode,
  }
  const edgeTypes: EdgeTypes = {
    'custom-edge': CustomEdge,
  }

  const ondelete = ({ edges: deletedEdges }) => {
    if (deletedEdges && deletedEdges.length > 0) {
      clearConnectionCache()
    }
  }

  const getClientPosition = (event: MouseEvent | TouchEvent) => {
    if ('changedTouches' in event && event.changedTouches.length > 0) {
      const touch = event.changedTouches[0]
      return { x: touch.clientX, y: touch.clientY }
    }

    if ('clientX' in event) {
      return { x: event.clientX, y: event.clientY }
    }

    return null
  }

  const resetConnectedNodeDraft = () => {
    createConnectedNodeOptions = []
    createConnectedNodeName = ''
    createConnectedNodeSourceType = ''
    pendingConnection = null
  }

  const createConnectedNode = (
    option: CompatibleNodeOption,
    name: string
  ) => {
    if (!pendingConnection) {
      return
    }

    try {
      const newNode = createCanvasNode(
        option.template,
        createConnectedNodePosition,
        {
          id: getNextNodeId().toString(),
          name,
        }
      )

      const nextNodes = [...getNodes(), newNode]
      setNodes(nextNodes)

      const nextEdges =
        pendingConnection.direction === 'forward'
          ? [
              ...getEdges(),
              createCustomEdge({
                source: pendingConnection.source,
                sourceHandle: pendingConnection.sourceHandle,
                target: newNode.id,
                targetHandle: option.handleId,
              }),
            ]
          : [
              ...getEdges(),
              createCustomEdge({
                source: newNode.id,
                sourceHandle: option.handleId,
                target: pendingConnection.target,
                targetHandle: pendingConnection.targetHandle,
              }),
            ]

      setEdges(nextEdges)

      clearConnectionCache()

      pendingConnection = null
      getModal(createConnectedNodeModalId)?.close()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'unknown create-node error'
      console.error('Create connected node failed:', error)
      toastState.add({
        message: `Create connected node failed: ${message}`,
        type: 'error',
      })
    }
  }

  const maybeOpenConnectedNodeModal = (
    event: MouseEvent | TouchEvent
  ) => {
    if (!activeConnectionStart) {
      return
    }

    const clientPosition = getClientPosition(event)
    if (!clientPosition || !canvasElement) {
      return
    }

    const bounds = canvasElement.getBoundingClientRect()
    const isInsideCanvas =
      clientPosition.x >= bounds.left &&
      clientPosition.x <= bounds.right &&
      clientPosition.y >= bounds.top &&
      clientPosition.y <= bounds.bottom

    if (!isInsideCanvas) {
      activeConnectionStart = null
      return
    }

    const position = screenToFlowPosition(clientPosition)
    const overlappingNodes = getIntersectingNodes(
      {
        x: position.x - 1,
        y: position.y - 1,
        width: 2,
        height: 2,
      },
      true
    )
    if (overlappingNodes.length > 0) {
      activeConnectionStart = null
      return
    }

    const templates = [...getStoredNetworkNodes(), ...getAvailableNodes()]
    const node = getNode(activeConnectionStart.nodeId)
    if (!node || !activeConnectionStart.handleId) {
      activeConnectionStart = null
      return
    }

    let compatibleOptions: CompatibleNodeOption[] = []
    let connectionName = ''
    let connectionType = ''

    if (activeConnectionStart.handleType === 'source') {
      const outputMetadata = getOutputMetadata(node, activeConnectionStart.handleId)
      if (!outputMetadata) {
        activeConnectionStart = null
        return
      }

      connectionName = outputMetadata.connectionName
      connectionType = outputMetadata.sourceType
      compatibleOptions = findCompatibleNodeOptions(
        templates,
        outputMetadata.sourceType,
        node.data.type
      )
      pendingConnection = {
        direction: 'forward',
        source: activeConnectionStart.nodeId,
        sourceHandle: activeConnectionStart.handleId,
      }
    } else {
      const inputMetadata = getInputMetadata(node, activeConnectionStart.handleId)
      if (!inputMetadata) {
        activeConnectionStart = null
        return
      }

      connectionName = inputMetadata.connectionName
      connectionType = inputMetadata.expectedInputType
      compatibleOptions = findCompatibleSourceNodeOptions(
        templates,
        inputMetadata.expectedInputType,
        node.data.type
      )
      pendingConnection = {
        direction: 'backward',
        target: activeConnectionStart.nodeId,
        targetHandle: activeConnectionStart.handleId,
      }
    }

    if (compatibleOptions.length === 0) {
      toastState.add({
        message: `No compatible nodes found for type "${connectionType}"`,
        type: 'error',
      })
      activeConnectionStart = null
      pendingConnection = null
      return
    }

    const defaultSuggestedName = getSuggestedCreatedNodeName({
      connectionName,
      startHandleType: activeConnectionStart.handleType,
      startNodeType: node.data.node_type,
      firstCompatibleDefaultName: compatibleOptions[0]?.defaultNodeName,
    })

    createConnectedNodeOptions = compatibleOptions
    createConnectedNodeName = defaultSuggestedName
    createConnectedNodeSourceType = connectionType
    createConnectedNodePosition = position
    activeConnectionStart = null

    if (compatibleOptions.length === 1) {
      createConnectedNode(
        compatibleOptions[0],
        defaultSuggestedName || connectionName
      )
      return
    }

    getModal(createConnectedNodeModalId)?.open()
  }

  const handleConnectEnd: OnConnectEnd = (event) => maybeOpenConnectedNodeModal(event)

  const handleCreateConnectedNode = (
    option: CompatibleNodeOption,
    name: string
  ) => createConnectedNode(option, name)
</script>

<div class="flow-canvas" bind:this={canvasElement}>
  <SvelteFlow
    bind:nodes={getNodes, setNodes}
    bind:edges={getEdges, setEdges}
    {nodeTypes}
    {edgeTypes}
    fitView
    {isValidConnection}
    onconnectstart={(_, params) => {
      if (
        (params.handleType !== 'source' && params.handleType !== 'target') ||
        !params.nodeId ||
        !params.handleId
      ) {
        activeConnectionStart = null
        return
      }

      activeConnectionStart = {
        nodeId: params.nodeId,
        handleId: params.handleId,
        handleType: params.handleType,
      }
    }}
    onconnect={() => {
      activeConnectionStart = null
    }}
    onconnectend={handleConnectEnd}
    ondragover={onDragOver}
    ondrop={(event) =>
      onDrop(
        event,
        screenToFlowPosition,
        $state.snapshot(dndNodeDataState.current)
      )}
    colorMode={colorModeState.value}
    {ondelete}
  >
    <Panel position="top-left">
      <div class="project-info">
        {#if currentProjectState.id}
          <span class="project-main">{currentProjectState.name}</span>
          <span class="project-secondary">ID: {currentProjectState.id}</span>
        {:else}
          <span class="project-secondary">Unsaved Project</span>
        {/if}
      </div>
      <JobsTable />
    </Panel>
    <Panel position="bottom-left">
      <div class="export-button-container">
        <!-- <button onclick={executeWithPassword}>Execute with password</button> -->
        <!-- <button onclick={executeWithKey}>Execute with key</button> -->
      </div>
      <div id="custom-panel-logs" class="custom-panel" style="margin-top: 1vh;">
        -
      </div>
    </Panel>
    <Panel position="top-right">
      <ButtonToggleDarkMode />
    </Panel>
    <Controls position="bottom-center" orientation="horizontal" />
    <MiniMap />
    <Background />
  </SvelteFlow>
</div>

<CreateConnectedNodeModal
  modalId={createConnectedNodeModalId}
  options={createConnectedNodeOptions}
  initialName={createConnectedNodeName}
  sourceType={createConnectedNodeSourceType}
  onCreate={handleCreateConnectedNode}
  onCancel={resetConnectedNodeDraft}
/>

<style>
  .flow-canvas {
    width: 100%;
    height: 100%;
  }

  .project-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem 1rem;
    background-color: var(--primary-color);
    border-radius: 5px;
    margin-bottom: 1vh;
  }

  .project-main {
    font-weight: bold;
    /* font-size: 1.1rem; */
  }

  .project-secondary {
    /* font-size: 0.8rem; */
    opacity: 0.7;
  }
  .export-button-container {
    display: flex;
    flex-wrap: wrap;
    gap: 1vw;
    max-width: 50vw;
  }

  .custom-panel {
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 1vh;
    margin-bottom: 1vh;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    background-color: var(--primary-color);
  }
</style>
