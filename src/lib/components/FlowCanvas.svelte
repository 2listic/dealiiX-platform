<script module>
  import ElementaryConstructor, {
    type ElementaryConstructorType,
  } from './nodes/ElementaryConstructor.svelte'
  import EmptyConstructor, {
    type EmptyConstructorType,
  } from './nodes/EmptyConstructor.svelte'
  import MethodOrFunc, { type MethodType } from './nodes/MethodOrFunc.svelte'

  export type CustomNodes =
    | ElementaryConstructorType
    | EmptyConstructorType
    | MethodType
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
  } from '../states/store.svelte'
  // import { executeWithPassword, executeWithKey } from '../utils/sshMessages.js'
  import { isValidConnection } from '../utils/connectionsValidation'
  import ExportGraphButton from './ExportGraphButton.svelte'
  import { useDnD } from './DnDProvider.svelte'
  import { onDragOver, onDrop } from '../utils/dragAndDrop'
  import { MethodName, Type } from '../types/nodeTypes'
  // import { login } from '../utils/login'

  const { screenToFlowPosition } = useSvelteFlow()
  const type = useDnD()

  let idCounter = $derived(getNodes().length)

  const nodeTypes: NodeTypes = {
    [Type.UNSIGNED]: ElementaryConstructor,
    [Type.BOOLEAN]: ElementaryConstructor,
    [Type.STRING]: ElementaryConstructor,
    [Type.TRIANGULATION22]: EmptyConstructor,
    [Type.GRID_OUT]: EmptyConstructor,
    [MethodName.TRIANGULATION2_REFINEGLOBAL]: MethodOrFunc,
    [MethodName.GRIDOUT_WRITEVTK2]: MethodOrFunc,
    [MethodName.GRIDGENERATOR_GENERATEFROMNAMEANDARGUMENTS2]: MethodOrFunc,
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
  ondrop={(event) => onDrop(event, screenToFlowPosition, type)}
>
  <Panel position="top-left">
    <div class="export-button-container">
      <!-- <button onclick={executeWithPassword}>Execute with password</button>
          <button onclick={executeWithKey}>Execute with key</button> -->
      <!-- <button onclick={login}>Login</button> -->
      <ExportGraphButton />
    </div>
    <div id="ssh-response" class="custom-panel" style="margin-top: 1vh;">-</div>
  </Panel>
  <Panel position="top-right">
    <div class="custom-panel">
      number of nodes: {idCounter}
    </div>
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
    padding: 10px;
    margin-top: 1px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    font-size: 1.5em;
    color: #333;
  }
</style>
