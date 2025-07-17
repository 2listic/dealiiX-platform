<script module>
  import type { NodeData } from '../../types/nodeTypes'
  export type UnsignedType = Node<NodeData, Type.UNSIGNED>
  export type BooleanType = Node<NodeData, Type.BOOLEAN>
  export type StringType = Node<NodeData, Type.STRING>
  export type ElementaryConstructorType =
    | BooleanType
    | UnsignedType
    | StringType
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
  import { NodeType, Type } from '../../types/nodeTypes'
  import { getImportedNodesByType } from '../../states/store.svelte'

  let { id, data, type }: NodeProps<ElementaryConstructorType> = $props()

  const importedNodes = getImportedNodesByType(NodeType.ELEMENTARY_CONSTRUCTOR)
  if (!importedNodes || importedNodes.length === 0) {
    data.is_valid = false
    console.error(
      'No imported nodes found for node_type:',
      NodeType.ELEMENTARY_CONSTRUCTOR
    )
  } else {
    $inspect('elementary_constructor, importedNodes', importedNodes)
    const filterImportedNode = importedNodes.find((node) => node.type === type)
    data.arguments = $state.snapshot(filterImportedNode.arguments)
    data.inputs = $state.snapshot(filterImportedNode.inputs)
    data.node_type = $state.snapshot(filterImportedNode.node_type)
    data.outputs = $state.snapshot(filterImportedNode.outputs)
    data.type = $state.snapshot(filterImportedNode.type)
    data.type_hash = $state.snapshot(filterImportedNode.type_hash)
    data.is_valid = true
  }

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
          const isValid =
            !isNaN(numValue) &&
            numValue >= 0 &&
            numValue <= 65535 &&
            value.trim() !== ''
          updateNodeData(id, {
            value: value,
            is_valid: isValid,
          })
        }}
      />
    {:else if type === Type.STRING}
      <input
        type="text"
        value={data.value}
        oninput={(evt) => {
          updateNodeData(id, { value: evt.currentTarget.value })
        }}
      />
    {:else if type === Type.BOOLEAN}
      <input
        type="checkbox"
        value={data.value}
        oninput={(evt) => {
          updateNodeData(id, {
            value: evt.currentTarget.checked ? 'true' : 'false',
          })
        }}
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
    background: #efefef;
    border: 2px solid yellowgreen;
  }

  .label {
    font-weight: bold;
  }

  input.invalid {
    border: 2px solid red;
  }
</style>
