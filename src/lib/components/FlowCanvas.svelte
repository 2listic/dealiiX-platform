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
  import { currentProjectState } from '../stores/currentProjectStore.svelte'
  import {
    clearConnectionCache,
    isValidConnection,
  } from '../utils/connectionsValidation'
  import { onDragOver, onDrop } from '../utils/dragAndDrop.svelte'
  import { NodeType, NodeTypePyBackend } from '../types/nodeTypes'
  import ButtonToggleDarkMode from './layout/ButtonToggleDarkMode.svelte'
  import JobsTable from './layout/JobsTable.svelte'

  const { screenToFlowPosition } = useSvelteFlow()

  const nodeTypes: NodeTypes = {
    [NodeType.ELEMENTARY_CONSTRUCTOR]: UnifiedNode,
    [NodeType.EMPTY_CONSTRUCTOR]: UnifiedNode,
    [NodeType.CONSTRUCTOR]: UnifiedNode,
    [NodeType.ABSTRACT]: UnifiedNode,
    [NodeType.VOID_METHOD]: UnifiedNode,
    [NodeType.VOID_CONST_METHOD]: UnifiedNode,
    [NodeType.VOID_FUNCTION]: UnifiedNode,
    [NodeTypePyBackend.PRIMITIVE]: UnifiedNode,
    [NodeTypePyBackend.FUNCTION]: UnifiedNode,
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

<style>
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
