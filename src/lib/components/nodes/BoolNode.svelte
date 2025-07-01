<script module>
  export type BoolNodeType = Node<{ value: boolean, inputs: string[], outputs: string[] }, 'bool'>;
</script>
 
<script lang="ts">
  import {
    Handle,
    Position,
    useSvelteFlow,
    type NodeProps,
    type Node,
  } from '@xyflow/svelte'
 
  let { id, data }: NodeProps<BoolNodeType> = $props()
  data.inputs = []
  data.outputs = ['boolean']

  if (data.value === undefined) {
    data.value = false
  }
 
  const { updateNodeData } = useSvelteFlow()
</script>
 
<div class="custom-node">
  <div class="label">boolean</div>
  <div>
    <input
      type="checkbox"
      checked={data.value}
      oninput={(evt) => updateNodeData(id, { value: evt.currentTarget.checked })}
    />
    <span>{data.value ? 'true' : 'false'}</span>
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