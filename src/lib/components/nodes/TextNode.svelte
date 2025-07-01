<script module>
  export type TextNodeType = Node<{ value: string, type: string }, 'text'>;
</script>
 
<script lang="ts">
  import {
    Handle,
    Position,
    useSvelteFlow,
    type NodeProps,
    type Node,
  } from '@xyflow/svelte'
 
  let { id, data }: NodeProps<TextNodeType> = $props()
  data.type = 'string'
 
  const { updateNodeData } = useSvelteFlow()
</script>
 
<div class="custom-node">
  <div class="label">text</div>
  <div>
    <input
      value={data.value}
      oninput={(evt) => updateNodeData(id, { value: evt.currentTarget.value })}
    />
  </div>
  <Handle type="source" position={Position.Right} />
</div>
 
<style>
  .custom-node {
    padding: 10px;
    border-radius: 5px;
    background: #EFEFEF;
    border: 2px solid yellow;
  }
</style>