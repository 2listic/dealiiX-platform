<script module>
  import type { NodeData } from '../../types/nodeTypes'
  export type UnsignedType = Node<NodeData, Type.UNSIGNED>
  export type BooleanType = Node<NodeData, Type.BOOLEAN>
  export type ElementaryConstructorType = BooleanType | UnsignedType
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
  import { NodeType, Outputs, Type } from '../../types/nodeTypes'
 
  let { id, data, type }: NodeProps<ElementaryConstructorType> = $props()
  
  data.arguments = []
  data.inputs = []
  data.node_type = NodeType.ELEMENTARY_CONSTRUCTOR
  data.outputs = [ Outputs.SELF ]
  switch (type) {
  case Type.BOOLEAN:
    data.type = Type.BOOLEAN
    data.type_hash = 'b826a7e2a6063644'
    data.value = 'false'
    break
  case Type.UNSIGNED:
    data.type = Type.UNSIGNED
    data.type_hash = 'b826a7e2a606584c'
    data.value = '0'
    break
  }
  data.is_valid = true

  const { updateNodeData } = useSvelteFlow()
  
    // let nodes = useNodes()
    // $effect(() => {
    //   console.log(nodes.current)
    //   console.log(data)
    // })
</script>
 
<div class="custom-node">
  <div class="label">{data.type}</div>
  <div>
    {#if type === Type.UNSIGNED}
      <input
        type="text"
        class={data.is_valid ? '' : 'invalid'}
        value={data.value}
        oninput={(evt) => {
          const value = evt.currentTarget.value
          const numValue = parseInt(value)
          const isValid = !isNaN(numValue) && numValue >= 0 && numValue <= 65535 && value.trim() !== ''
          updateNodeData(id, { 
            value: value,
            is_valid: isValid
          })
        }}
      />
    {:else if type === Type.BOOLEAN}
      <input
        type="checkbox"
        value={data.value}
        oninput={(evt) => { updateNodeData(id, { value: evt.currentTarget.checked ? 'true' : 'false' }) }}
      />
      <span>{data.value === 'true' ? 'true' : 'false'}</span>
    {/if}
  </div>
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

  input.invalid {
    border: 2px solid red;
  }
</style>