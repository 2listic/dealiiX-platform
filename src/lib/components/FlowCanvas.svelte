<script lang="ts">
  import {
    SvelteFlow,
    Background,
    type Node,
    type Edge,
    type EdgeTypes,
  } from "@xyflow/svelte";

  import "@xyflow/svelte/dist/style.css";
  import TextUpdaterNode from './TextUpdaterNode.svelte';
  import CustomEdge from "./CustomEdge.svelte";

  const nodeTypes = {
    textUpdater: TextUpdaterNode,
  };
  const edgeTypes: EdgeTypes = {
    'custom-edge': CustomEdge,
  };

  let nodes = $state.raw<Node[]>([
    {
      id: "1",
      type: 'input',
      data: { label: "Hello" },
      position: { x: 0, y: 0 },
      style: 'width: 170px; height: 80px;',
    },
    {
      id: '1:child1',
      type: 'output',
      data: { label: "child" },
      position: { x: 5, y: 30 },
      parentId: '1',
    },
    {
      id: "2",
      type: 'output',
      data: { label: "World" },
      position: { x: 150, y: 150 },
    },
    {
      id: 'node-1',
      type: 'textUpdater',
      position: { x: 300, y: 0 },
      data: { text: 'some text' },
    },
    {
      id: 'node-2',
      type: 'textUpdater',
      position: { x: 300, y: 300 },
      data: { text: 'some text' },
    },
  ]);

  let edges = $state.raw<Edge[]>([
    {
      id: "1-2",
      source: "1",
      target: "2",
      type: 'smoothstep',
      label: 'to the',
      animated: true,
    },
    {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2',
      type: 'custom-edge',
    },
  ]);
</script>

<div style:width="100vw" style:height="50vh">
  <SvelteFlow 
    bind:nodes
    bind:edges
    {nodeTypes}
    {edgeTypes}
    fitView
  >
    <Background />
  </SvelteFlow>
</div>
