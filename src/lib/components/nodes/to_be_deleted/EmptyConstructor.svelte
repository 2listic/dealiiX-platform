<!-- <script module>
  import type { NodeData } from '../../types/nodeTypes'
  export type TriangulationType = Node<NodeData, Type.TRIANGULATION22>
  export type GridOutType = Node<NodeData, Type.GRID_OUT>
  export type EmptyConstructorType = TriangulationType | GridOutType
</script>

<script lang="ts">
  import { Handle, Position, type NodeProps, type Node } from '@xyflow/svelte'
  import { nodeColors, NodeType, Type } from '../../types/nodeTypes'
  import { getImportedNodesByType, removeNode } from '../../stores/nodes.svelte'

  let { id, data, type }: NodeProps<EmptyConstructorType> = $props()

  const importedNodes = getImportedNodesByType(NodeType.EMPTY_CONSTRUCTOR)
  const color = nodeColors[NodeType.EMPTY_CONSTRUCTOR]
  if (!importedNodes || importedNodes.length === 0) {
    data.is_valid = false
    console.error(
      'No imported nodes found for node_type:',
      NodeType.EMPTY_CONSTRUCTOR
    )
  } else {
    $inspect('empty_constructor, importedNodes', importedNodes)
    const filterImportedNode = importedNodes.find((node) => node.type === type)
    data.arguments = $state.snapshot(filterImportedNode.arguments)
    data.inputs = $state.snapshot(filterImportedNode.inputs)
    data.node_type = $state.snapshot(filterImportedNode.node_type)
    data.outputs = $state.snapshot(filterImportedNode.outputs)
    data.type = $state.snapshot(filterImportedNode.type)
    data.type_hash = $state.snapshot(filterImportedNode.type_hash)
    data.is_valid = true
  }
</script>

<div class="custom-node" style="--border-color: {color}">
  <div class="node-header">
    <div class="label">{data.type}</div>
    <button class="button-remove" onclick={() => removeNode(id)}>X</button>
  </div>
  {#each data.outputs as i, index (i)}
    <Handle id={`output-${index}`} type="source" position={Position.Right} />
  {/each}
</div>

<style>
  .custom-node {
    padding: 10px;
    border-radius: 5px;
    background: var(--primary-color);
    border: 2px solid var(--border-color);
  }

  .node-header {
    display: flex;
    justify-content: space-between;
    gap: 1vw;
  }

  .button-remove {
    cursor: pointer;
    border: 1px solid var(--border-color);
    border-radius: 3px;
    margin: 0 0 1vh 1vh;
  }

  .button-remove:hover {
    border: 1px solid var(--border-color-hover);
  }

  .label {
    font-weight: bold;
  }
</style> -->
