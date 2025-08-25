<script module>
  // import ElementaryConstructor, {
  //   type ElementaryConstructorType,
  // } from './nodes/ElementaryConstructor.svelte'
  // import EmptyConstructor, {
  //   type EmptyConstructorType,
  // } from './nodes/EmptyConstructor.svelte'
  // import MethodOrFunc, { type MethodType } from './nodes/MethodOrFunc.svelte'
  import UnifiedNode from './nodes/UnifiedNode.svelte'

  // export type CustomNodes =
  //   | ElementaryConstructorType
  //   | EmptyConstructorType
  //   | MethodType
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
  import { useDnD } from './DnDProvider.svelte'
  import { onDragOver, onDrop } from '../utils/dragAndDrop.svelte'
  import { NodeType } from '../types/nodeTypes'
  import ButtonToggleDarkMode from './layout/ButtonToggleDarkMode.svelte'

  const { screenToFlowPosition } = useSvelteFlow()
  const draggedNodeData = useDnD()

  // let idCounter = $derived(getNodes().length)

  // const nodeTypes: NodeTypes = {
  //   [Type.UNSIGNED]: ElementaryConstructor,
  //   [Type.BOOLEAN]: ElementaryConstructor,
  //   [Type.STRING]: ElementaryConstructor,
  //   [Type.TRIANGULATION22]: EmptyConstructor,
  //   [Type.GRID_OUT]: EmptyConstructor,
  //   [MethodName.TRIANGULATION2_REFINEGLOBAL]: MethodOrFunc,
  //   [MethodName.GRIDOUT_WRITEVTK2]: MethodOrFunc,
  //   [MethodName.GRIDGENERATOR_GENERATEFROMNAMEANDARGUMENTS2]: MethodOrFunc,
  // }
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
  ondrop={(event) => onDrop(event, screenToFlowPosition, draggedNodeData)}
  colorMode={colorModeState.value}
>
  <Panel position="top-left">
    <div class="export-button-container">
      <!-- <button onclick={executeWithPassword}>Execute with password</button>
          <button onclick={executeWithKey}>Execute with key</button> -->
    </div>
    <div id="ssh-response" class="custom-panel" style="margin-top: 1vh;">-</div>
  </Panel>
  <Panel position="top-right">
    <!-- <div class="custom-panel">
      Number of nodes: {idCounter}
    </div> -->
    <ButtonToggleDarkMode />
  </Panel>
  <Controls />
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
    font-size: 1.5em;
    color: #333;
  }
</style>
