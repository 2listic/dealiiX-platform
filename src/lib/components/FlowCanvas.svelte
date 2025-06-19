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

  const nodeTypes = {
    textUpdater: TextUpdaterNode,
  };
  const edgeTypes: EdgeTypes = {
    'custom-edge': CustomEdge,
  };
  
  let nodes = $state.raw<Node[]>(initialNodes)
  let edges = $state.raw<Edge[]>(initialEdges)

  const onConnectEnd = (event, connectionState) => {
    handleConnectEnd(event, connectionState, nodes, edges, screenToFlowPosition)
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
</SvelteFlow>
