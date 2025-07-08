<script module>
  // import TextNode, { type TextNodeType } from './nodes/to_be_deleted/TextNode.svelte'
  // import BoolNode, { type BoolNodeType } from './nodes/to_be_deleted/BoolNode.svelte'
  // import ConcatNode, { type ConcatNodeType } from './nodes/to_be_deleted/ConcatNode.svelte'
  import ElementaryConstructor, { type ElementaryConstructorType } from './nodes/ElementaryConstructor.svelte'
  import Triangulation, { type TriangulationType } from './nodes/Triangulation.svelte'
  import TriangulationRefineGlobal, { type TriangulationRefineGlobalType } from './nodes/TriangulationRefineGlobal.svelte'
 
  // export type CustomNodes = TextNodeType | BoolNodeType | ConcatNodeType | ElementaryConstructorType | TriangulationType | TriangulationRefineGlobalType;
  export type CustomNodes = ElementaryConstructorType | TriangulationType | TriangulationRefineGlobalType
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
  import { getNodes, getEdges, setNodes, setEdges } from '../states/store.svelte'
  // import { executeWithPassword, executeWithKey } from '../utils/sshMessages.js'
  import { isValidConnection } from '../utils/connectionsValidation'
  import ExportGraphButton from './ExportGraphButton.svelte'
  import { useDnD } from './DnDProvider.svelte'
  import Sidebar from './layout/Sidebar.svelte'
  import { onDragOver, onDrop } from '../utils/dragAndDrop'
  import { MethodName, NodeType, Type } from '../types/nodeTypes'

  const { screenToFlowPosition } = useSvelteFlow()
  const type = useDnD()

  let idCounter = $derived(getNodes().length)
  
  const nodeTypes: NodeTypes = {
    // text: TextNode,
    // bool: BoolNode,
    // concat: ConcatNode,
    unsigned: ElementaryConstructor,
    bool: ElementaryConstructor,
    [Type.TRIANGULATION22]: Triangulation,
    [MethodName.TRIANGULATION2_REFINEGLOBAL]: TriangulationRefineGlobal,
  }
  const edgeTypes: EdgeTypes = {
    'custom-edge': CustomEdge,
  }
</script>

  <Sidebar />
  <SvelteFlow 
    bind:nodes={getNodes, setNodes}
    bind:edges={getEdges, setEdges}
    {nodeTypes}
    {edgeTypes}
    fitView
    isValidConnection={isValidConnection} 
    ondragover={onDragOver}
    ondrop={(event) => onDrop(event, screenToFlowPosition, type)}
  >
    <Panel position="top-left">
      <div style="display: flex; flex-wrap: wrap; gap: 10px; max-width: 50vw">
        <!-- <button onclick={executeWithPassword}>Execute with password</button>
        <button onclick={executeWithKey}>Execute with key</button> -->
        <ExportGraphButton />
      </div>
      <div id="ssh-response" class="custom-panel" style="margin-top: 1vh;">
        -
      </div>
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
  .custom-panel {
    background-color: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 10px;
    margin-top: 1px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    font-size: 1.5em;
    color: #333;
  }
</style>