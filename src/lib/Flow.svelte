<script lang="ts">
  import {
    SvelteFlow,
    // Controls,
    Background,
    // MiniMap,
    type Node,
    type Edge,
  } from "@xyflow/svelte";

  import "@xyflow/svelte/dist/style.css";

  let nodes = $state.raw<Node[]>([
    {
      id: "1",
      type: 'input',
      data: { label: "Hello" },
      position: { x: 0, y: 0 },
    },
    {
      id: "2",
      type: 'output',
      data: { label: "World" },
      position: { x: 150, y: 150 },
    },
  ]);

  let edges = $state.raw<Edge[]>([
    {
      id: "1-2",
      source: "1",
      target: "2",
      type: 'smoothstep',
      label: 'to the'
    },
  ]);
</script>

<div style:width="100vw" style:height="50vh">
  <SvelteFlow bind:nodes bind:edges fitView>
    <Background />
  </SvelteFlow>
</div>
<!-- <div style:height="100vh">
  <SvelteFlow bind:nodes bind:edges fitView>
    <Controls />
    <Background />
    <MiniMap />
  </SvelteFlow>
</div> -->
