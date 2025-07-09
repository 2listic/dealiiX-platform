<script module>
  import type { NodeData } from '../../types/nodeTypes'
  export type TriangulationType = Node<NodeData, Type.TRIANGULATION22>
  export type GridOutType = Node<NodeData, Type.GRID_OUT>
  export type EmptyConstructorType = TriangulationType | GridOutType
</script>
 
<script lang="ts">
  import {
    Handle,
    Position,
    type NodeProps,
    type Node,
  } from '@xyflow/svelte'
  import { NodeType, Type } from '../../types/nodeTypes'
  import { getImportedNodesByType } from '../../states/store.svelte'

  let { data, type }: NodeProps<EmptyConstructorType> = $props()

  const importedNodes = getImportedNodesByType(NodeType.EMPTY_CONSTRUCTOR)
  if (!importedNodes || importedNodes.length === 0) {
    data.is_valid = false
    console.error('No imported nodes found for node_type:', NodeType.EMPTY_CONSTRUCTOR)
  } else {
    $inspect('empty_constructor, importedNodes', importedNodes)
    const filterImportedNode = importedNodes.find((node) => node.type === type)  
    data.arguments = filterImportedNode.arguments
    data.inputs = filterImportedNode.inputs
    data.node_type = filterImportedNode.node_type
    data.outputs = filterImportedNode.outputs
    data.type = filterImportedNode.type
    data.type_hash = filterImportedNode.type_hash
    data.is_valid = true
  }
</script>
 
<div class="custom-node">
  <div class="label">{data.type}</div>
  <Handle id="output-self" type="source" position={Position.Right} />
</div>
 
<style>
  .custom-node {
    padding: 10px;
    border-radius: 5px;
    background: #EFEFEF;
    border: 2px solid gray;
  }

  .label {
    font-weight: bold;
  }
</style>