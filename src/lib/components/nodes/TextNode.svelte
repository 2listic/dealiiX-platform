<script module>
  export type TextNodeType = Node<{ value: string, inputs: string[], outputs: string[] }, 'text'>;
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
  data.inputs = []
  data.outputs = ['string']
 
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
  <Handle id="output-0" type="source" position={Position.Right} />
</div>
 
<style>
  .custom-node {
    padding: 10px;
    border-radius: 5px;
    background: #EFEFEF;
    border: 2px solid yellow;
  }
</style>