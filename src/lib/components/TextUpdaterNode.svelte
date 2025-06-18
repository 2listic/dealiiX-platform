<script lang="ts">
  import { Position, useSvelteFlow, Handle, type NodeProps } from '@xyflow/svelte';
 
  let { id, data }: NodeProps = $props();
 
  let { updateNodeData } = useSvelteFlow();
</script>

<div class="text-updater-node">
	<Handle type="target" position={Position.Top} />
	<Handle type="source" position={Position.Bottom} />
	
  <div>
    <label for="text">Text:</label>
    <input
      id="text"
      name="text"
      value={data.text}
      oninput={(evt) => {
        const target = evt.target as HTMLInputElement;
        updateNodeData(id, { text: target.value });
      }}
      class="nodrag"
    />
  </div>
</div>

<style>
	.text-updater-node {
	height: 50px;
	border: 1px solid #eee;
	padding: 5px;
	border-radius: 5px;
	background: white;
	}
	
	.text-updater-node label {
	display: block;
	color: #777;
	font-size: 12px;
	}
</style>