<script module>
  import type { NodeData } from '../../../types/nodeTypes'
  export type TriangulationType = Node<NodeData, 'triangulation22'>;
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
    
  data.nodeType = NodeType.EMPTY_CONTRUCTOR
  data.outputs = [ Outputs.SELF ]
  data.type = Type.TRIANGULATION22
  data.typeHash = 'c95847e89853e6da'
  data.isValid = true
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