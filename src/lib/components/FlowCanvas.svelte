<script module>
  import TextNode, { type TextNodeType } from './nodes/TextNode.svelte'
  import BoolNode, { type BoolNodeType } from './nodes/BoolNode.svelte'
  import ConcatNode, { type ConcatNodeType } from './nodes/ConcatNode.svelte'
 
  export type CustomNodes = TextNodeType | BoolNodeType | ConcatNodeType;
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
    addEdge,
  } from '@xyflow/svelte'

  import '@xyflow/svelte/dist/base.css'
  import CustomEdge from './edges/CustomEdge.svelte'
  import { getNodes, getEdges, setNodes, setEdges } from '../states/store.svelte'
  import { executeWithPassword, executeWithKey } from '../utils/sshMessages.js'
  import { isValidConnection } from '../utils/connectionsValidation.js'
  import ExportGraphButton from './ExportGraphButton.svelte'

  let nodes = getNodes()
  let edges = getEdges()
  let idCounter = $state(nodes.length)

  const nodeTypes: NodeTypes = {
    text: TextNode,
    bool: BoolNode,
    concat: ConcatNode,
  }
  const edgeTypes: EdgeTypes = {
    'custom-edge': CustomEdge,
  }
  
  const onConnect = (params) => {
    const newEdge = {
      ...params,
      id: `e${params.source}-${params.target}-${params.targetHandle || 'default'}`
    }
    edges = addEdge(newEdge, edges)
  }
</script>
<SvelteFlow 
    bind:nodes={getNodes, setNodes}
    bind:edges={getEdges, setEdges}
    {nodeTypes}
    {edgeTypes}
    fitView
    onbeforeconnect={onConnect}
    isValidConnection={isValidConnection} 
  >
    <Panel position="top-left">
      <div style="display: flex; flex-wrap: wrap; gap: 10px; max-width: 50vw">
        <button onclick={executeWithPassword}>Execute with password</button>
        <button onclick={executeWithKey}>Execute with key</button>
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