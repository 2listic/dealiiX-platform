<script module>
  import type { BoolNodeData } from '../../../types/nodeTypes'
  export type BoolNodeType = Node<BoolNodeData, 'bool'>;
</script>
 
<script lang="ts">
  import {
    Handle,
    Position,
    useSvelteFlow,
    type NodeProps,
    type Node,
  } from '@xyflow/svelte'
  import { InOutTypes } from '../../../types/nodeTypes'
 
  let { id, data }: NodeProps<BoolNodeType> = $props()
  data.inputsTypes = []
  data.outputsTypes = [InOutTypes.BOOL]

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

  .label {
    font-weight: bold;
  }
</style>