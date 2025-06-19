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
<div class="flow-container">
  <div>number of nodes {idCounter}</div>
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
  </SvelteFlow>
</div>

<style>
  .flow-container {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
</style>