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
  import { isValidConnection } from '../utils/connectionsValidation'
  import { onDragOver, onDrop } from '../utils/dragAndDrop.svelte'
  import { NodeType } from '../types/nodeTypes'
  import ButtonToggleDarkMode from './layout/ButtonToggleDarkMode.svelte'
  import JobsTable from './layout/JobsTable.svelte'
  import { toastState } from '../stores/toastsStore.svelte'

  const { screenToFlowPosition } = useSvelteFlow()

  const nodeTypes: NodeTypes = {
    [NodeType.ELEMENTARY_CONSTRUCTOR]: UnifiedNode,
    [NodeType.EMPTY_CONSTRUCTOR]: UnifiedNode,
    [NodeType.CONSTRUCTOR]: UnifiedNode,
    [NodeType.ABSTRACT]: UnifiedNode,
    [NodeType.VOID_METHOD]: UnifiedNode,
    [NodeType.VOID_CONST_METHOD]: UnifiedNode,
    [NodeType.VOID_FUNCTION]: UnifiedNode,
  }
  const edgeTypes: EdgeTypes = {
    'custom-edge': CustomEdge,
  }

  async function openExternalWindow(url: string) {
    try {
      //@ts-ignore
      const result = await window.electron.invoke('open-external-url', url)
      if (result.success) {
        toastState.add({ message: 'New window opened' })
      } else {
        toastState.add({
          message: `Failed to open new window: ${result.error}`,
          type: 'error',
        })
      }
    } catch (error) {
      toastState.add({
        message: `Failed to open new window: ${error}`,
        type: 'error',
      })
    }
  }

  function handleOpenVisualizer() {
    // TODO: move url to local storage using settings button as done with ssh-path
    openExternalWindow('http://localhost:1234/index.html')
  }
</script>

<SvelteFlow
  bind:nodes={getNodes, setNodes}
  bind:edges={getEdges, setEdges}
  {nodeTypes}
  {edgeTypes}
  fitView
  {isValidConnection}
  ondragover={onDragOver}
  ondrop={(event) =>
    onDrop(
      event,
      screenToFlowPosition,
      $state.snapshot(dndNodeDataState.current)
    )}
  colorMode={colorModeState.value}
>
  <Panel position="top-left">
    <JobsTable />
  </Panel>
  <Panel position="bottom-left">
    <div class="export-button-container">
      <button onclick={handleOpenVisualizer}>Open Visualizer</button>
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

<style>
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
