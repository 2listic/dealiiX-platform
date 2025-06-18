<script lang="ts">
  import {
    SvelteFlow,
    Background,
    useSvelteFlow,
    type Node,
    type Edge,
    type EdgeTypes,
    type OnConnectEnd,
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

  let initialNodes: Node[] = [ 
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
      type: 'default',
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
  ]

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
  ])

  let nodes = $state.raw<Node[]>(initialNodes)
  
  let id = 2
  const getId = () => `${id++}`

  const { screenToFlowPosition } = useSvelteFlow();

  const handleConnectEnd: OnConnectEnd = (event, connectionState) => {
    if (connectionState.isValid) return

    const sourceNodeId = connectionState.fromNode?.id ?? '2'
    const id = getId()
    const { clientX, clientY } =
      'changedTouches' in event ? event.changedTouches[0] : event
    
    const newNode: Node = {
      id,
      data: { label: `Node ${id}` },
      position: screenToFlowPosition({ x: clientX, y: clientY }),
      origin: [0.5, 0.0],
    }
    nodes = [...nodes, newNode]
    edges = [
      ...edges,
      {
        source: sourceNodeId,
        target: id,
        id: `${sourceNodeId}-${id}`,
      },
    ]

  }

</script>

<SvelteFlow 
  bind:nodes
  bind:edges
  {nodeTypes}
  {edgeTypes}
  fitView
  onconnectend={handleConnectEnd}
>
  <Background />
</SvelteFlow>
