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
  data.is_valid = true

  const color = nodeColors[type]

  const { updateNodeData } = useSvelteFlow()

  const isValidNum = (value) => {
    const numValue = Number(value)
    switch (data.type) {
      case Type.UNSIGNED:
        return (
          !isNaN(numValue) &&
          Number.isInteger(numValue) &&
          numValue >= 0 &&
          value.trim() !== ''
        )
      case Type.INT:
        return (
          !isNaN(numValue) && Number.isInteger(numValue) && value.trim() !== ''
        )
      case Type.DOUBLE:
        return !isNaN(numValue) && value.trim() !== ''
    }
  }

  // let nodes = useNodes()
  // $effect(() => {
  //   console.log(nodes.current)
  //   console.log(data)
  // })
</script>

<div class="custom-node" style="--border-color: {color}">
  <!-- Headers -->
  <div class="node-header">
    <div style="font-size: x-small;">ID {id}</div>
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
    {#if data.type === Type.UNSIGNED || data.type === Type.INT || Type.DOUBLE}
      <input
        type="text"
        class={data.is_valid ? '' : 'invalid'}
        value={data.value}
        oninput={(evt) => {
          const value = evt.currentTarget.value
          const isValid = isValidNum(value)
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
