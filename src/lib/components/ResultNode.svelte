<script module>
  export type ResultNodeType = Node<{}, 'result'>;
</script>
 
<script lang="ts">
  import {
    Handle,
    Position,
    useNodeConnections,
    useNodesData,
    type NodeProps,
    type Node,
  } from '@xyflow/svelte';

  let props: NodeProps = $props();
  let { id, data }: NodeProps<ResultNodeType> = props;
 
  const connections = useNodeConnections({
    handleType: 'target',
  });
  console.log('connections', connections.current)
 
  const nodesData = useNodesData(
    connections.current.map((connection) => connection.source),
  );
</script>
 
<div class="custom-node">
  <Handle type="target" position={Position.Left} />
  <div class="label">Commands:</div>
 
  {#if nodesData.current.length === 0}
    <div>no connected nodes</div>
  {:else}
    {#each nodesData.current as nodeData}
      <div>{nodeData.data.text}</div>
    {/each}
  {/if}
</div>
 
<style>
  .custom-node {
    padding: 10px;
    border-radius: 5px;
    background: #EFEFEF;
    border: 2px solid orange;
  }
</style>