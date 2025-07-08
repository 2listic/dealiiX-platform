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
  import { NodeType, Outputs, Type } from '../../types/nodeTypes'
 
  let { data, type }: NodeProps<EmptyConstructorType> = $props()
    
  data.arguments = []
  data.inputs = []
  data.node_type = NodeType.EMPTY_CONSTRUCTOR
  data.outputs = [ Outputs.SELF ]
  if (type === Type.TRIANGULATION22) {
    data.type = Type.TRIANGULATION22
    data.type_hash = 'c95847e89853e6da'
  } else if (type === Type.GRID_OUT) {
    data.type = Type.GRID_OUT
    data.type_hash = 'd109334b934b9a76'
  }
  data.is_valid = true
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