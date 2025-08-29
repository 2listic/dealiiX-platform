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
  // import { executeWithPassword, executeWithKey } from '../utils/sshMessages.js'
  import { isValidConnection } from '../utils/connectionsValidation'
  import { dndNodeDataState } from '../stores/dndStore.svelte.js'
  import { onDragOver, onDrop } from '../utils/dragAndDrop.svelte'
  import { NodeType } from '../types/nodeTypes'
  import ButtonToggleDarkMode from './layout/ButtonToggleDarkMode.svelte'

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
  <Panel position="bottom-left">
    <div class="export-button-container">
      <!-- <button onclick={executeWithPassword}>Execute with password</button>
          <button onclick={executeWithKey}>Execute with key</button> -->
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
    background-color: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 1vh;
    margin-bottom: 1vh;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    font-size: 1em;
    color: var(--ternary-color);
    background-color: var(--primary-color);
  }
</style>
