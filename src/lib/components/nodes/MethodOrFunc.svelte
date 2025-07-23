<script module>
  import type { NodeData } from '../../types/nodeTypes'
  export type Triangulation2RefineGlobalType = Node<
    NodeData,
    MethodName.TRIANGULATION2_REFINEGLOBAL
  >
  export type GridoutWriteWtk2 = Node<NodeData, MethodName.GRIDOUT_WRITEVTK2>
  export type GridgeneratorGenerateFromNameAndArguments2 = Node<
    NodeData,
    MethodName.GRIDGENERATOR_GENERATEFROMNAMEANDARGUMENTS2
  >
  export type MethodType =
    | Triangulation2RefineGlobalType
    | GridoutWriteWtk2
    | GridgeneratorGenerateFromNameAndArguments2
</script>

<script lang="ts">
  import { Handle, Position, type NodeProps, type Node } from '@xyflow/svelte'
  import { ConnectionType, MethodName, NodeType } from '../../types/nodeTypes'
  import { getImportedNodesByType } from '../../states/store.svelte'

  let { data, type }: NodeProps<MethodType> = $props()

  const importedNodes = getImportedNodesByType(NodeType.METHOD)
  $inspect('method, importedNodes', importedNodes)
  if (!importedNodes || importedNodes.length === 0) {
    data.is_valid = false
    console.error('No imported nodes found for node_type:', NodeType.METHOD)
  } else {
    const filterImportedNode = importedNodes.find(
      (node) => node.method_name === type
    )
    data.arguments = $state.snapshot(filterImportedNode.arguments)
    data.inputs = $state.snapshot(filterImportedNode.inputs)
    data.method_name = $state.snapshot(filterImportedNode.method_name)
    data.node_type = $state.snapshot(filterImportedNode.node_type)
    data.outputs = $state.snapshot(filterImportedNode.outputs)
    data.type = $state.snapshot(filterImportedNode.type)
    data.type_hash = $state.snapshot(filterImportedNode.type_hash)
    data.is_valid = true
  }
  // TODO: validate all inputs are connected
</script>

<div class="custom-node">
  {#each data.inputs as i, index (i)}
    <Handle
      id={`input-${index}`}
      type="target"
      position={Position.Left}
      style="top: {(100 / (data.inputs.length + 1)) * (index + 1) + 5}%;"
    />
  {/each}
  {#each data.outputs as i, index (i)}
    <Handle id={`output-${index}`} type="source" position={Position.Right} />
  {/each}

  <div class="label">{type}</div>
  <div style="display: flex; flex-direction: row; gap: 2vh">
    <div class="input-column">
      {#each data.inputs as i, index (i)}
        <div class="input-label">
          Input {index}
          {data.arguments[i].connection_type === ConnectionType.PASSTHROUGH
            ? '/ Output'
            : ''}
        </div>
        <div class="input-type">{data.arguments[i].type}</div>
      {/each}
    </div>
  </div>
</div>

<style>
  .custom-node {
    padding: 15px;
    border-radius: 5px;
    background: #efefef;
    border: 2px solid skyblue;
    min-width: 200px;
  }

  .label {
    font-weight: bold;
  }

  .input-column {
    display: flex;
    flex-direction: column;
    margin-bottom: 0.5vh;
  }

  .input-label {
    font-weight: bold;
    margin-top: 1vh;
  }

  .input-type {
    font-family: monospace;
    font-size: smaller;
  }
</style>
