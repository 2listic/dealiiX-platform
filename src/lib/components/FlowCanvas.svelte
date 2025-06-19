<script lang="ts">
  import {
    SvelteFlow,
    Background,
    useSvelteFlow,
    MiniMap,
    type Node,
    type Edge,
    type EdgeTypes,
    Controls,
    Panel,
  } from "@xyflow/svelte";

  import "@xyflow/svelte/dist/style.css";
  import TextUpdaterNode from './TextUpdaterNode.svelte';
  import CustomEdge from "./CustomEdge.svelte";
  import { initialNodes, initialEdges } from "../utils/flowData";
  import { handleConnectEnd } from '../utils/flowUtils.js';

  const { screenToFlowPosition } = useSvelteFlow();

  let idCounter = $state(initialNodes.length)

  const nodeTypes = {
    textUpdater: TextUpdaterNode,
  };
  const edgeTypes: EdgeTypes = {
    'custom-edge': CustomEdge,
  };
  
  let nodes = $state.raw<Node[]>(initialNodes)
  let edges = $state.raw<Edge[]>(initialEdges)

  const onConnectEnd = (event, connectionState) => {
    if (connectionState.isValid) return;
    const result = handleConnectEnd(event, connectionState, screenToFlowPosition, idCounter)
    if (result) {
      const { newNode, newEdge } = result;
      nodes = [...nodes, newNode];
      edges = [...edges, newEdge];
      idCounter++;
    }
  }
</script>
  <SvelteFlow 
    bind:nodes
    bind:edges
    {nodeTypes}
    {edgeTypes}
    fitView
    onconnectend={onConnectEnd}
  >
    <MiniMap />
    <Controls />
    <Background />
    <Panel position="top-right">
      <div class="custom-panel">
        number of nodes {idCounter}
      </div>
    </Panel>
  </SvelteFlow>
<style>
  .custom-panel {
    background-color: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 10px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    font-size: 24px;
    color: #333;
  }
</style>