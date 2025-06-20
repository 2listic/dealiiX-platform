<script module>
  import TextNode, { type TextNodeType } from './TextNode.svelte';
  import ResultNode, { type ResultNodeType } from './ResultNode.svelte';
 
  export type CustomNodes = TextNodeType | ResultNodeType;
</script>

<script lang="ts">
  import {
    SvelteFlow,
    Background,
    MiniMap,
    type Node,
    type Edge,
    type EdgeTypes,
    type NodeTypes,
    Controls,
    Panel,
  } from "@xyflow/svelte";

  import "@xyflow/svelte/dist/base.css";
  import CustomEdge from "./CustomEdge.svelte";
  import { initialNodes, initialEdges } from "../utils/flowData";
  import { executeSSHCommandWithPassword, connectToSSH } from '../utils/ssh.js';

  let idCounter = $state(initialNodes.length)

  const nodeTypes: NodeTypes = {
    // textUpdater: TextUpdaterNode,
    text: TextNode,
    result: ResultNode,
  };
  const edgeTypes: EdgeTypes = {
    'custom-edge': CustomEdge,
  };
  
  let nodes = $state.raw<Node[]>(initialNodes)
  let edges = $state.raw<Edge[]>(initialEdges)

</script>
  <SvelteFlow 
    bind:nodes
    bind:edges
    {nodeTypes}
    {edgeTypes}
    fitView
  >
    <Panel position="top-left">
      <button onclick={executeSSHCommandWithPassword}>Execute SSH Command with password</button>
      <button onclick={connectToSSH}>Connect to SSH with key</button>
      <div id="ssh-response" class="custom-panel">
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