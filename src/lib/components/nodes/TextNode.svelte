<script module>
  export type TextNodeType = Node<{ text: string }, 'text'>;
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
 
  const { updateNodeData } = useSvelteFlow()
</script>
 
<div class="custom-node">
  <div class="label">text</div>
  <div>
    <input
      value={data.text}
      oninput={(evt) => updateNodeData(id, { text: evt.currentTarget.value })}
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