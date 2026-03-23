<script module>
  import type {
    NetworkNodeOfTypeNetwork,
    NodeData,
  } from '../../types/nodeTypes'
  // unused exports
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
  export type Function = Node<NodeData, NodeType.FUNCTION>
  export type Network = Node<NetworkNodeOfTypeNetwork, NodeType.NETWORK>
  export type UnifiedNodeType =
    | ElementaryConstructor
    | EmptyConstructor
    | Constructor
    | Abstract
    | VoidMethod
    | VoidConstMethod
    | VoidFunction
    | Function
</script>

<script lang="ts">
  import {
    Handle,
    Position,
    useSvelteFlow,
    type NodeProps,
    type Node,
  } from '@xyflow/svelte'
  import { getModal } from '../layout/Modal.svelte'
  import {
    nodeColors,
    NodeType,
    Type,
    isNumericType,
  } from '../../types/nodeTypes'
  import { removeNode } from '../../stores/nodes.svelte'
  import { clearConnectionCache } from '../../utils/connectionsValidation'
  import EditIcon from '../icons/EditIcon.svelte'
  import TrashIcon from '../icons/TrashIcon.svelte'
  import EditNodeNameModal from './EditNodeNameModal.svelte'

  let { id, data, type }: NodeProps<UnifiedNodeType> = $props()

  // data.is_valid = true
  let isValid = $derived(data?.is_valid ?? true)
  let hasCustomName = $derived(data.name && data.name.trim() !== '')
  let isNetworkNode = $derived(data.node_type === NodeType.NETWORK)
  let color = $derived(nodeColors[type])

  const { updateNodeData } = useSvelteFlow()

  let editNodeModalId = $derived(`edit-node-${id}`)

  const isValidNum = (value) => {
    const numValue = Number(value)
    switch (data.type) {
      case Type.UNSIGNED_INT:
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
      case (Type.DOUBLE, Type.FLOAT):
        return !isNaN(numValue) && value.trim() !== ''
    }
  }

  /**
   * Validate elementary constructor values on mount and when value changes
   * Also clear connection cache when is_valid changes
   */
  $effect(() => {
    if (isNumericType(data.type)) {
      const value = data.value
      const expectedIsValid = isValidNum(value)

      // Only update if validation state differs from current state
      if (expectedIsValid !== data.is_valid) {
        updateNodeData(id, { is_valid: expectedIsValid })
        clearConnectionCache()
      }
    } else {
      // Non-numeric types are for now always valid
      if (data?.is_valid !== true) {
        updateNodeData(id, { is_valid: true })
      }
    }
  })

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
    <div class="node-labels">
      {#if hasCustomName}
        <div class="node-name">{data.name}</div>
        <div class="node-type">{data.type}</div>
      {:else}
        <div class="node-name">{data.type}</div>
      {/if}
    </div>
    <div class="node-buttons">
      {#if !isNetworkNode}
        <button
          class="node-button"
          onclick={() => getModal(editNodeModalId)?.open()}
        >
          <EditIcon width="20px" height="20px" />
        </button>
      {/if}
      <button class="node-button" onclick={() => removeNode(id)}>
        <TrashIcon width="20px" height="20px" />
      </button>
    </div>
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
    <Handle
      id={`output-${index}`}
      type="source"
      position={Position.Right}
      style="top: {(100 / (data.outputs.length + 1)) * (index + 1) + 5}%;"
    />
  {/each}

  <!-- Input / output labels -->
  {#if data.arguments.length > 0}
    <div style="display: flex; flex-direction: row; gap: 4vh">
      <div class="input-column">
        {#each data.inputs as i (i)}
          {#if ['input', 'pass_through'].includes(data.arguments[i].connection_type)}
            <div>
              <div class="input-label">
                {data.arguments[i].name}
              </div>
              <div class="input-type">{data.arguments[i].type}</div>
            </div>
          {/if}
        {/each}
      </div>
      <div class="output-column">
        {#each data.outputs as i (i)}
          {#if i != -1 && ['output', 'pass_through'].includes(data.arguments[i]?.connection_type)}
            <div>
              <div class="output-label">
                {data.arguments[i].name}
              </div>
              <div class="output-type">{data.arguments[i].type}</div>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/if}

  <!-- Elementary constructors input fields -->
  {#if data.node_type === NodeType.ELEMENTARY_CONSTRUCTOR}
    <div>
      {#if data.type === Type.BOOLEAN}
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
      {:else}
        <!-- All other elementary constructors -->
        <input
          type="text"
          class={isValid ? '' : 'invalid'}
          value={data.value}
          oninput={(evt) => {
            updateNodeData(id, { value: evt.currentTarget.value })
          }}
        />
      {/if}
    </div>
  {/if}
</div>

<EditNodeNameModal
  modalId={editNodeModalId}
  nodeId={id}
  currentName={hasCustomName ? data.name : data.type}
/>

<style>
  .custom-node {
    padding: 15px;
    border-radius: 5px;
    background: var(--primary-color);
    border: 2px solid var(--border-color);
    min-width: 200px;
  }

  .node-header {
    margin-bottom: 1vh;
    display: flex;
    justify-content: space-between;
    gap: 1vw;
  }

  .node-labels {
    display: flex;
    flex-direction: column;
  }

  .node-name {
    font-weight: bold;
    text-align: center;
  }

  .node-type {
    font-family: monospace;
    font-size: smaller;
    text-align: center;
  }

  .node-buttons {
    display: flex;
    gap: 0.3vw;
  }

  .node-button {
    cursor: pointer;
    border: 1px solid var(--border-color);
    border-radius: 3px;
    padding: 1px;
    display: flex;
    align-items: center;
    align-self: flex-start;
  }

  .node-button:hover {
    border: 1px solid var(--border-color-hover);
  }

  input.invalid {
    border: 2px solid red;
  }

  .input-column {
    display: flex;
    flex-direction: column;
    flex: 1;
    justify-content: space-evenly;
    margin-bottom: 0.5vh;
  }

  .output-column {
    display: flex;
    flex-direction: column;
    flex: 1;
    align-items: end;
    justify-content: space-evenly;
    margin-bottom: 2vh;
  }

  .input-label {
    font-weight: bold;
    margin-top: 1vh;
  }

  .input-type {
    font-family: monospace;
    font-size: smaller;
  }

  .output-label {
    font-weight: bold;
    margin-top: 1vh;
    text-align: right;
  }

  .output-type {
    font-family: monospace;
    font-size: smaller;
    text-align: right;
  }
</style>
