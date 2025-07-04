<script module>
  import type { NodeData } from '../../../types/nodeTypes'
  export type UnsignedType = Node<NodeData, 'Unsigned'>;
</script>
 
<script lang="ts">
  import {
    Handle,
    Position,
    useSvelteFlow,
    // useNodes,
    type NodeProps,
    type Node,
  } from '@xyflow/svelte'
  import { NodeType, Outputs, Type } from '../../../types/nodeTypes'
 
  let { id, data }: NodeProps<UnsignedType> = $props()
    
  data.nodeType = NodeType.ELEMENTARY_CONSTRUCTOR
  data.outputs = [ Outputs.SELF ]
  data.type = Type.UNSIGNED
  data.typeHash = 'b826a7e2a606584c'
  data.value = '0'
  data.isValid = true
    
  const { updateNodeData } = useSvelteFlow()
  
    // let nodes = useNodes()
    // $effect(() => {
    //   console.log(nodes.current)
    //   console.log(data)
    // })
</script>
 
<div class="custom-node">
  <div class="label">unsigned</div>
  <div>
    <input
      type="number"
      min="0"
      max="65535"
      value={data.value}
      oninput={(evt) => {
        updateNodeData(id, { 
          value: evt.currentTarget.value,
          isValid: parseInt(evt.currentTarget.value) <= 65535 && parseInt(evt.currentTarget.value) >= 0
        })}
      }
    />
  </div>
  <Handle id="output-0" type="source" position={Position.Right} />
</div>
 
<style>
  .custom-node {
    padding: 10px;
    border-radius: 5px;
    background: #EFEFEF;
    border: 2px solid yellow;
  }

  input:invalid {
    border: 2px solid red;
  }
</style>