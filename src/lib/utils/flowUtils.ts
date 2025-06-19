
// let idCounter = $state(idCounterInitial)
import { type NodeOrigin } from "@xyflow/svelte";

// const getId = () => `${idCounter++}`;

export const handleConnectEnd = (event, connectionState, screenToFlowPosition, idCounter) => {
  if (connectionState.isValid) return;
  console.log('idCounter', idCounter)

  console.log('connectionState.fromNode?.id', connectionState.fromNode?.id);
  const sourceNodeId = connectionState.fromNode?.id ?? '1';
  const newId = (idCounter++).toString();
  console.log('newId', newId);
  const { clientX, clientY } = 'changedTouches' in event ? event.changedTouches[0] : event;
  const origin: NodeOrigin = [0.5, 0.0];

  const newNode = {
    id: newId,
    data: { label: `Node ${newId}` },
    position: screenToFlowPosition({ x: clientX, y: clientY }),
    origin: origin,
  }

  const newEdge = {
    source: sourceNodeId,
    target: newId,
    id: `${sourceNodeId}-${newId}`,
  }

  return { newNode, newEdge }
};