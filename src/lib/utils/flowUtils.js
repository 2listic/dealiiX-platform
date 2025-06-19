import { useSvelteFlow } from '@xyflow/svelte';

let idCounter = 5;

const getId = () => `${idCounter++}`;

export const handleConnectEnd = (event, connectionState, nodes, edges, screenToFlowPosition) => {
  if (connectionState.isValid) return;

  console.log('connectionState.fromNode?.id', connectionState.fromNode?.id);
  const sourceNodeId = connectionState.fromNode?.id ?? getId();
  const newId = getId();
  console.log('newId', newId);
  const { clientX, clientY } = 'changedTouches' in event ? event.changedTouches[0] : event;

  const newNode = {
    id: newId,
    data: { label: `Node ${newId}` },
    position: screenToFlowPosition({ x: clientX, y: clientY }),
    origin: [0.5, 0.0],
  };

  nodes = [...nodes, newNode];
  edges = [
    ...edges,
    {
      source: sourceNodeId,
      target: newId,
      id: `${sourceNodeId}-${newId}`,
    },
  ];
};