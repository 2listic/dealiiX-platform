<script module>
  import type { NodeData } from '../../../types/nodeTypes'
  export type TriangulationType = Node<NodeData, Type.TRIANGULATION22>;
</script>
 
<script lang="ts">
  import {
    Handle,
    Position,
    type NodeProps,
    type Node,
  } from '@xyflow/svelte'
  import { NodeType, Outputs, Type } from '../../../types/nodeTypes'
 
  let { data }: NodeProps<TriangulationType> = $props()
    
  data.node_type = NodeType.EMPTY_CONSTRUCTOR
  data.outputs = [ Outputs.SELF ]
  data.type = Type.TRIANGULATION22
  data.type_hash = 'c95847e89853e6da'
  data.is_valid = true
</script>
 
<div class="custom-node">
  <div class="label">triangulation&lt;2, 2&gt;</div>
  <Handle id="output-self" type="source" position={Position.Right} />
</div>
 
<style>
  .custom-node {
    padding: 10px;
    border-radius: 5px;
    background: #EFEFEF;
    border: 2px solid yellow;
  }

  .label {
    font-weight: bold;
  }
</style>