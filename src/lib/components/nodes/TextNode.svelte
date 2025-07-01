<script module>
  import type { TextNodeData } from '../../types/nodeTypes'
  export type TextNodeType = Node<TextNodeData, 'text'>;
</script>
 
<script lang="ts">
  import {
    Handle,
    Position,
    useSvelteFlow,
    type NodeProps,
    type Node,
  } from '@xyflow/svelte'
  import { inOutTypes } from '../../utils/enums'
 
  let { id, data }: NodeProps<TextNodeType> = $props()
  data.inputs = []
  data.outputs = [inOutTypes.STRING]
 
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