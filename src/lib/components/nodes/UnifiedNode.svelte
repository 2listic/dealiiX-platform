<script module>
  import type { NodeData } from '../../types/nodeTypes'
  export type ElementaryConstructor = Node<
    NodeData,
    NodeType.ELEMENTARY_CONSTRUCTOR
  >
  export type EmptyConstructor = Node<NodeData, NodeType.EMPTY_CONSTRUCTOR>
  export type Constructor = Node<NodeData, NodeType.CONSTRUCTOR>
  export type Abstract = Node<NodeData, NodeType.ABSTRACT>
  export type VoidMethod = Node<NodeData, NodeType.VOID_METHOD>
  export type VoidConstMethod = Node<NodeData, NodeType.VOID_CONST_METHOD>
  export type VoidFunction = Node<NodeData, NodeType.VOID_FUNCTION>
  export type UnifiedNodeType =
    | ElementaryConstructor
    | EmptyConstructor
    | Constructor
    | Abstract
    | VoidMethod
    | VoidConstMethod
    | VoidFunction
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
  import {
    ConnectionType,
    nodeColors,
    NodeType,
    Type,
  } from '../../types/nodeTypes'
  import { removeNode } from '../../stores/nodes.svelte'

  let { id, data, type }: NodeProps<UnifiedNodeType> = $props()
  console.log('unifiedNode id', id)
  console.log('unifiedNode data', data)
  console.log('unifiedNode data.type', data.type)
  console.log('unifiedNode type', type)

  const color = nodeColors[data.node_type]

  data.is_valid = true

  const { updateNodeData } = useSvelteFlow()

  // let nodes = useNodes()
  // $effect(() => {
  //   console.log(nodes.current)
  //   console.log(data)
  // })
</script>

<div class="custom-node" style="--border-color: {color}">
  <!-- Headers -->
  <div class="node-header">
    <div class="label">
      {'method_name' in data ? data.method_name : data.type}
    </div>
    <button class="button-remove" onclick={() => removeNode(id)}>X</button>
  </div>

  <!-- Input handlers -->
  {#each data.inputs as i, index (i)}
    <Handle
      id={`input-${index}`}
      type="target"
      position={Position.Left}
      style="top: {(100 / (data.inputs.length + 1)) * (index + 1) + 5}%;"
    />
  {/each}

  <!-- Output handlers -->
  {#each data.outputs as i, index (i)}
    <Handle id={`output-${index}`} type="source" position={Position.Right} />
  {/each}

  <!-- Input labels -->
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

  <!-- Elementary constructors input fields -->
  <div>
    {#if data.type === Type.UNSIGNED}
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
    {:else if data.type === Type.STRING}
      <input
        type="text"
        value={data.value}
        oninput={(evt) => {
          updateNodeData(id, { value: evt.currentTarget.value })
        }}
      />
    {:else if data.type === Type.BOOLEAN}
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
</div>

<style>
  .custom-node {
    padding: 15px;
    border-radius: 5px;
    background: var(--primary-color);
    border: 2px solid var(--border-color);
    min-width: 200px;
  }

  .node-header {
    display: flex;
    justify-content: space-between;
    gap: 1vw;
  }

  .label {
    font-weight: bold;
  }

  .button-remove {
    cursor: pointer;
    border: 1px solid var(--border-color);
    border-radius: 3px;
    margin: 0 0 1vh 1vh;
  }

  .button-remove:hover {
    border: 1px solid var(--border-color-hover);
  }

  input.invalid {
    border: 2px solid red;
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
