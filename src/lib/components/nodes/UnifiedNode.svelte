<script module lang="ts">
  import type { Node as FlowNode } from '@xyflow/svelte'
  import type {
    SubGraphNodeDefinition,
    OverloadNodeDefinition,
    StandardNodeDefinition as StandardNodeDefinitionType,
    NodeType as FlowNodeType,
  } from '../../types/nodeTypes'
  // unused exports
  export type ElementaryConstructor = FlowNode<
    StandardNodeDefinitionType,
    FlowNodeType.ELEMENTARY_CONSTRUCTOR
  >
  export type EmptyConstructor = FlowNode<
    StandardNodeDefinitionType,
    FlowNodeType.EMPTY_CONSTRUCTOR
  >
  export type Constructor = FlowNode<
    StandardNodeDefinitionType,
    FlowNodeType.CONSTRUCTOR
  >
  export type Abstract = FlowNode<
    StandardNodeDefinitionType,
    FlowNodeType.ABSTRACT
  >
  export type VoidMethod = FlowNode<
    StandardNodeDefinitionType,
    FlowNodeType.VOID_METHOD
  >
  export type VoidConstMethod = FlowNode<
    StandardNodeDefinitionType,
    FlowNodeType.VOID_CONST_METHOD
  >
  export type VoidFunction = FlowNode<
    StandardNodeDefinitionType,
    FlowNodeType.VOID_FUNCTION
  >
  export type Function = FlowNode<
    StandardNodeDefinitionType,
    FlowNodeType.FUNCTION
  >
  export type Network = FlowNode<SubGraphNodeDefinition, FlowNodeType.NETWORK>
  export type Overload = FlowNode<OverloadNodeDefinition, FlowNodeType.OVERLOAD>
  export type UnifiedNodeType =
    | ElementaryConstructor
    | EmptyConstructor
    | Constructor
    | Abstract
    | VoidMethod
    | VoidConstMethod
    | VoidFunction
    | Function
    | Network
    | Overload
</script>

<script lang="ts">
  import {
    Handle,
    Position,
    useSvelteFlow,
    type NodeProps,
  } from '@xyflow/svelte'
  import Modal, { getModal } from '../layout/Modal.svelte'
  import {
    nodeColors,
    ConnectionType,
    NodeType,
    PARAMETER_FILE_COLOR,
    SELF,
    Type,
    isNumericType,
  } from '../../types/nodeTypes'
  import {
    getEdgesSnapshot,
    getNextNodeId,
    getNodesSnapshot,
    removeNode,
    setEdges,
    setNodes,
  } from '../../stores/nodes.svelte'
  import { clearConnectionCache } from '../../graph/connectionsValidation'
  import EditIcon from '../icons/EditIcon.svelte'
  import InfoIcon from '../icons/InfoIcon.svelte'
  import RefreshIcon from '../icons/RefreshIcon.svelte'
  import SuccessIcon from '../icons/SuccessIcon.svelte'
  import TrashIcon from '../icons/TrashIcon.svelte'
  import EditNodeNameModal from './EditNodeNameModal.svelte'
  import { enterSubnetwork } from '../../stores/graphNavigation.svelte'
  import { graphHistoryState } from '../../stores/graphStack.svelte'
  import { explodeNetworkNodeInGraph } from '../../graph/networkNodeCanvas'
  import { toastState } from '../../stores/toastsStore.svelte'
  import OpenIcon from '../icons/OpenIcon.svelte'
  import CubeIcon from '../icons/CubeIcon.svelte'
  import ExplosionIcon from '../icons/ExplosionIcon.svelte'
  import MarkIcon from '../icons/MarkIcon.svelte'
  import ParameterFilePorts from './ParameterFilePorts.svelte'
  import { isParameterFileName } from '../../parameters/parameterFileFormat'
  import {
    openParameterFile,
    parameterFileUnavailableReason,
    useAsParameterFile,
  } from '../../parameters/parameterNodeActions'
  import {
    isOverloadNodeDefinition,
    type NodeDefinitions,
    type StandardNodeDefinition,
  } from '../../types/nodeTypes'
  import {
    resolveOutputTypeCandidates,
    returnNodeName,
  } from '../../graph/canvasNodeUtils'
  import { displayTypeName, variantLabels } from '../../registry/nodePalette'
  import { isVtkFileName } from '../../vtk/vtkFileFormat'
  import { openVtkFile } from '../../vtk/vtkActions'
  import {
    finalizeOverloadNode,
    overloadInputTypes,
    overloadOutputTypes,
    overloadStatus,
    unfinalizeOverloadNode,
  } from '../../registry/overloadResolution'
  import { getOverloadCandidates } from '../../stores/overloadResolution.svelte'

  let {
    id,
    data,
    type,
    selected = false,
  }: NodeProps<UnifiedNodeType> = $props()

  // data.is_valid = true
  let isValid = $derived(data?.is_valid ?? true)
  let isNetworkNode = $derived(data.node_type === NodeType.NETWORK)
  // An overload family node has no `value`.
  const valueForNode = (): string | undefined =>
    'value' in data && data.value != null ? String(data.value) : undefined
  let isLiteral = $derived(
    data.node_type === NodeType.ELEMENTARY_CONSTRUCTOR ||
      data.node_type === NodeType.PRIMITIVE
  )
  // Only a literal's value names a file, so a marker elsewhere is ignored.
  let isParameterFile = $derived(
    isLiteral && Boolean((data as StandardNodeDefinition).parameter_file)
  )
  let suggestsParameterFile = $derived(
    isLiteral &&
      !isParameterFile &&
      [Type.STRING, Type.STR].includes(data.type as Type) &&
      isParameterFileName(valueForNode())
  )
  let color = $derived(
    isParameterFile
      ? PARAMETER_FILE_COLOR
      : nodeColors[type as keyof typeof nodeColors]
  )
  let parameterFileUnavailable = $derived(parameterFileUnavailableReason())
  let isOverloadNode = $derived(data.node_type === NodeType.OVERLOAD)
  // The variants this family can still be, given its edges; read from the one
  // canvas-wide resolution that all family nodes share. Empty for other nodes.
  let overloadCandidates = $derived(
    isOverloadNode && isOverloadNodeDefinition(data)
      ? (getOverloadCandidates(id) ?? data.candidates)
      : []
  )
  // A family's own type is a placeholder, so the tooltip lists its variants' types.
  let typeTooltip = $derived(
    isOverloadNode
      ? overloadCandidates
          .map((candidate) => displayTypeName(candidate.type))
          .join('\n')
      : displayTypeName(data.type)
  )
  let currentOverloadStatus = $derived(
    isOverloadNode && isOverloadNodeDefinition(data)
      ? overloadStatus(data, overloadCandidates)
      : null
  )
  let isOverloadFinalized = $derived(
    isOverloadNode && isOverloadNodeDefinition(data) && data.finalized === true
  )
  let overloadStatusKind = $derived(
    isOverloadFinalized ? 'finalized' : currentOverloadStatus
  )
  let overloadStatusLabel = $derived(
    overloadStatusKind === 'finalized'
      ? 'finalized'
      : overloadStatusKind === 'resolved'
        ? 'resolved'
        : overloadStatusKind === 'partially_constrained'
          ? `${overloadCandidates.length} variants remain`
          : overloadStatusKind === 'invalid'
            ? 'no compatible variant'
            : `${overloadCandidates.length} variants`
  )
  let variantOptions = $derived.by(() => {
    if (overloadCandidates.length < 2) return []
    const labels = variantLabels(overloadCandidates)
    return overloadCandidates.map((candidate, index) => ({
      type: candidate.type,
      label: labels[index],
    }))
  })
  let isVtkFile = $derived(
    [Type.STRING, Type.STR].includes(data.type as Type) &&
      isVtkFileName(valueForNode())
  )
  type ArgumentPortRows = {
    inputs: number[]
    outputs: number[]
    count: number
    passthrough: number[]
  }

  const buildArgumentPortRows = (
    definition: NodeDefinitions
  ): ArgumentPortRows => {
    const inputs: number[] = []
    const outputs: number[] = []
    const passThroughRows: Record<number, number> = {}
    let nextRow = 0

    definition.inputs.forEach((argumentIndex, handleIndex) => {
      const argument = definition.arguments[argumentIndex]
      const hasMatchingOutput =
        argument?.connection_type === ConnectionType.PASSTHROUGH &&
        definition.outputs.some((outputIndex) => outputIndex === argumentIndex)

      if (hasMatchingOutput) {
        const existingRow = passThroughRows[argumentIndex]
        if (existingRow != null) {
          inputs[handleIndex] = existingRow
          return
        }

        passThroughRows[argumentIndex] = nextRow
      }

      inputs[handleIndex] = nextRow
      nextRow += 1
    })

    definition.outputs.forEach((argumentIndex, handleIndex) => {
      if (argumentIndex !== SELF) {
        const passThroughRow = passThroughRows[argumentIndex]
        if (passThroughRow != null) {
          outputs[handleIndex] = passThroughRow
          return
        }
      }

      outputs[handleIndex] = nextRow
      nextRow += 1
    })

    return {
      inputs,
      outputs,
      count: nextRow,
      passthrough: Object.values(passThroughRows),
    }
  }

  let argumentPortRows = $derived.by(() => buildArgumentPortRows(data))
  let portRowCount = $derived(Math.max(1, argumentPortRows.count))

  // A family lists one type per remaining variant, shown one per line.
  const inputPortTypes = (
    argumentIndex: number,
    handleIndex: number
  ): string[] => {
    const argumentType = data.arguments[argumentIndex]?.type
    const types = isOverloadNodeDefinition(data)
      ? overloadInputTypes(data, handleIndex)
      : []
    return types.length > 0 ? types : argumentType ? [argumentType] : []
  }

  const outputPortInfo = (argumentIndex: number, handleIndex: number) => {
    if (argumentIndex === SELF) {
      const outputTypes = resolveOutputTypeCandidates(data, handleIndex)
      return {
        name: 'output',
        types: outputTypes.length > 0 ? outputTypes : ['unknown'],
      }
    }

    const argument = data.arguments[argumentIndex]
    if (
      !argument ||
      ![ConnectionType.OUTPUT, ConnectionType.PASSTHROUGH].includes(
        argument.connection_type
      )
    ) {
      return null
    }

    const types = isOverloadNodeDefinition(data)
      ? overloadOutputTypes(data, handleIndex)
      : []
    return {
      name: argument.name,
      types: types.length > 0 ? types : [argument.type],
    }
  }
  const isPassthroughArgument = (argumentIndex: number): boolean =>
    data.arguments[argumentIndex]?.connection_type ===
      ConnectionType.PASSTHROUGH &&
    data.outputs.some((outputIndex) => outputIndex === argumentIndex)
  let nodeInfoModalId = $derived(`node-info-${id}`)
  let nodeInfoJson = $derived(JSON.stringify(data, null, 2))
  let nodeDisplayName = $derived(returnNodeName(data))

  const { updateNodeData } = useSvelteFlow()

  let editNodeModalId = $derived(`edit-node-${id}`)

  const isValidNum = (value: string | null | undefined) => {
    // Primitive/elementary nodes may start with a null value; coerce so `.trim()` is always safe.
    const safeValue = value ?? ''
    const numValue = Number(safeValue)
    switch (data.type) {
      case Type.UNSIGNED_INT:
      case Type.UNSIGNED:
        return (
          !isNaN(numValue) &&
          Number.isInteger(numValue) &&
          numValue >= 0 &&
          safeValue.trim() !== ''
        )
      case Type.INT:
        return (
          !isNaN(numValue) &&
          Number.isInteger(numValue) &&
          safeValue.trim() !== ''
        )
      case (Type.DOUBLE, Type.FLOAT):
        return !isNaN(numValue) && safeValue.trim() !== ''
    }
  }

  /**
   * Validate elementary constructor values on mount and when value changes
   * Also clear connection cache when is_valid changes
   */
  $effect(() => {
    if (isNumericType(data.type)) {
      const value = valueForNode()
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

  const handleExplodeSubnetwork = () => {
    try {
      graphHistoryState.checkpoint()
      const exploded = explodeNetworkNodeInGraph(
        id,
        getNodesSnapshot(),
        getEdgesSnapshot(),
        getNextNodeId
      )
      setNodes(exploded.nodes)
      setEdges(exploded.edges)
      clearConnectionCache()
      toastState.add({
        message: `Exploded subnetwork "${data.name ?? data.type}"`,
        timeout: 2200,
      })
    } catch (error) {
      console.error('Failed to explode subnetwork:', error)
      toastState.add({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to explode subnetwork',
        type: 'error',
      })
    }
  }

  /**
   * Pins a family to one variant (Finalize, Choose variant), or releases it
   * when no type is given (Show variants), as one undoable edit.
   */
  const setOverloadFinalization = (candidateType?: string) => {
    if (!isOverloadNodeDefinition(data)) return

    graphHistoryState.checkpoint()
    updateNodeData(
      id,
      candidateType
        ? finalizeOverloadNode(data, candidateType)
        : unfinalizeOverloadNode(data)
    )
    clearConnectionCache()
  }
</script>

<div
  class:selected-node={selected}
  class="custom-node"
  style="--border-color: {color}"
>
  <!-- Headers -->
  <div class="node-header">
    <div style="font-size: x-small;">ID {id}</div>
    <div class="node-labels">
      <div class="node-name" title={typeTooltip}>
        {nodeDisplayName}
      </div>
      {#if isParameterFile}
        <div class="node-type">parameter_file</div>
      {/if}
      {#if isOverloadNode && overloadStatusKind}
        <div class="overload-status-row">
          <span class="overload-status" data-status={overloadStatusKind}>
            {overloadStatusLabel}
          </span>
          {#if currentOverloadStatus === 'resolved'}
            <button
              class="overload-action"
              title={isOverloadFinalized
                ? 'Show the variants this node can still become'
                : 'Narrow the ports to the resolved variant'}
              onclick={(event) => {
                event.stopPropagation()
                setOverloadFinalization(
                  isOverloadFinalized ? undefined : overloadCandidates[0]?.type
                )
              }}
              onmousedown={(event) => event.stopPropagation()}
            >
              {#if isOverloadFinalized}
                <RefreshIcon width="14px" height="14px" rotation={0} />
                Show variants
              {:else}
                <SuccessIcon width="14px" />
                Finalize
              {/if}
            </button>
          {:else if variantOptions.length > 0}
            <select
              class="overload-action nodrag"
              aria-label="Choose variant"
              title="Keep one variant; the connected nodes narrow to it"
              onchange={(event) =>
                setOverloadFinalization(event.currentTarget.value)}
              onmousedown={(event) => event.stopPropagation()}
            >
              <option value="" selected disabled>Choose variant</option>
              {#each variantOptions as option (option.type)}
                <option value={option.type}>{option.label}</option>
              {/each}
            </select>
          {/if}
        </div>
      {/if}
    </div>
    <div class="node-buttons">
      {#if isNetworkNode}
        <button
          class="node-button"
          title="Open subnetwork"
          onclick={() => enterSubnetwork(id)}
        >
          <OpenIcon width="20px" height="20px" />
        </button>
        <button
          class="node-button"
          title="Explode subnetwork"
          onclick={handleExplodeSubnetwork}
        >
          <ExplosionIcon width="20px" height="20px" />
        </button>
      {:else}
        {#if isParameterFile}
          <button
            class="node-button"
            title={parameterFileUnavailable ?? 'Open parameters'}
            aria-label="Open parameters"
            disabled={Boolean(parameterFileUnavailable)}
            onclick={() =>
              openParameterFile(id, data as StandardNodeDefinition)}
          >
            <OpenIcon width="20px" height="20px" />
          </button>
        {/if}
        {#if isVtkFile}
          <button
            class="node-button vtk-button"
            title={parameterFileUnavailable ?? 'Open VTK file in visualizer'}
            aria-label="Open VTK file in visualizer"
            disabled={Boolean(parameterFileUnavailable)}
            onclick={() => openVtkFile(valueForNode() ?? '')}
          >
            <CubeIcon width="20px" height="20px" />
          </button>
        {/if}
        <button
          class="node-button"
          title="Edit name"
          onclick={() => getModal(editNodeModalId)?.open()}
        >
          <EditIcon width="20px" height="20px" />
        </button>
      {/if}
      <button
        class="node-button"
        title="Show node definition"
        aria-label={`Show node definition for ${nodeDisplayName}`}
        onclick={(event) => {
          event.stopPropagation()
          getModal(nodeInfoModalId)?.open()
        }}
        onmousedown={(event) => event.stopPropagation()}
      >
        <InfoIcon width="20px" />
      </button>
      <button
        class="node-button"
        title="Delete"
        onclick={() => {
          graphHistoryState.checkpoint()
          removeNode(id)
        }}
      >
        <TrashIcon width="20px" height="20px" />
      </button>
    </div>
  </div>

  {#if isParameterFile}
    <!-- Draws its own handles, each next to the row it belongs to -->
    <ParameterFilePorts {id} data={data as StandardNodeDefinition} />
  {:else if data.inputs.length > 0 || data.outputs.length > 0}
    <!-- Each handle sits in its port row, so it stays level with its label -->
    <div
      class="port-columns"
      class:unlabelled={data.arguments.length === 0}
      style="--port-row-count: {portRowCount};"
    >
      {#each argumentPortRows.passthrough as row (row)}
        <div
          class="passthrough-guide"
          style="grid-row: {row + 1};"
          title="This input is forwarded to the matching output."
          aria-hidden="true"
        >
          <span>↔ passthrough</span>
        </div>
      {/each}

      {#each data.inputs as i, index (index)}
        <div
          class="port-label input-port"
          style="grid-row: {(argumentPortRows.inputs[index] ?? index) + 1};"
        >
          <Handle
            id={`input-${index}`}
            type="target"
            position={Position.Left}
            class={isPassthroughArgument(i) ? 'passthrough-handle' : undefined}
          />
          {#if ['input', 'pass_through'].includes(data.arguments[i]?.connection_type)}
            <div class="input-label">
              {data.arguments[i].name}
            </div>
            {#each inputPortTypes(i, index) as portType (portType)}
              <div class="input-type">{displayTypeName(portType)}</div>
            {/each}
          {/if}
        </div>
      {/each}

      {#each data.outputs as i, index (index)}
        {@const output =
          data.arguments.length > 0 ? outputPortInfo(i, index) : null}
        <div
          class="port-label output-port"
          style="grid-row: {(argumentPortRows.outputs[index] ?? index) + 1};"
        >
          <Handle
            id={`output-${index}`}
            type="source"
            position={Position.Right}
            class={isPassthroughArgument(i) ? 'passthrough-handle' : undefined}
          />
          {#if output}
            <div class="output-label">
              {output.name}
            </div>
            {#each output.types as portType (portType)}
              <div class="output-type">{displayTypeName(portType)}</div>
            {/each}
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <!-- Elementary constructor / primitive literal input fields -->
  {#if isLiteral && !isParameterFile}
    <div class="value-row">
      {#if data.type === Type.BOOLEAN}
        <input
          type="checkbox"
          value={valueForNode()}
          oninput={(evt) => {
            graphHistoryState.checkpoint()
            updateNodeData(id, {
              value: evt.currentTarget.checked ? 'true' : 'false',
            })
          }}
        />
        <span>{valueForNode() === 'true' ? 'true' : 'false'}</span>
      {:else}
        <!-- All other elementary constructors -->
        <!-- onfocus/onblur bracket the edit gesture so undo restores the pre-edit value -->
        <input
          type="text"
          class:is-invalid={!isValid}
          class:vtk-file-input={isVtkFile}
          value={valueForNode()}
          onfocus={() => graphHistoryState.begin()}
          onblur={() => graphHistoryState.commit()}
          oninput={(evt) => {
            updateNodeData(id, { value: evt.currentTarget.value })
          }}
        />
      {/if}
      {#if suggestsParameterFile}
        <button
          class="node-button"
          title={parameterFileUnavailable ?? 'Use as parameter file'}
          aria-label="Use as parameter file"
          disabled={Boolean(parameterFileUnavailable)}
          onclick={() => useAsParameterFile(id, data as StandardNodeDefinition)}
        >
          <MarkIcon width="20px" height="20px" />
        </button>
      {/if}
    </div>
  {/if}
</div>

<EditNodeNameModal
  modalId={editNodeModalId}
  nodeId={id}
  currentName={nodeDisplayName}
/>

<Modal id={nodeInfoModalId} size="lg">
  <div class="node-info-modal">
    <h2>{nodeDisplayName}</h2>
    <pre>{nodeInfoJson}</pre>
  </div>
</Modal>

<style>
  .custom-node {
    position: relative;
    padding: 15px;
    border-radius: 5px;
    background: var(--primary-color);
    border: 2px solid var(--border-color);
    min-width: 200px;
    transition:
      box-shadow 0.18s ease,
      border-color 0.18s ease,
      filter 0.18s ease;
  }

  .selected-node {
    border-color: var(--border-color-hover);
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--border-color) 28%, transparent),
      0 10px 24px color-mix(in srgb, var(--ternary-color) 14%, transparent);
    filter: saturate(1.06);
  }

  .node-header {
    margin-bottom: 1vh;
    display: flex;
    justify-content: space-between;
    gap: 1vw;
  }

  .node-labels {
    display: flex;
    min-width: 0;
    flex-direction: column;
  }

  .overload-status-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 4px;
  }

  .overload-status {
    --status-color: var(--ternary-color);
    padding: 1px 8px;
    border: 1px solid var(--status-color);
    border-radius: 999px;
    color: var(--status-color);
    font-size: 0.8rem;
    white-space: nowrap;
  }

  .overload-status[data-status='resolved'],
  .overload-status[data-status='finalized'] {
    --status-color: #8fd694;
  }

  .overload-status[data-status='finalized'] {
    background: color-mix(in srgb, var(--status-color) 15%, transparent);
  }

  .overload-status[data-status='invalid'] {
    --status-color: #ff8a80;
  }

  .overload-action {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 1px 8px;
    border: 1px solid var(--border-color);
    border-radius: 3px;
    background-color: var(--secondary-color);
    color: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }

  .overload-action:hover {
    border-color: var(--border-color-hover);
  }

  .node-name {
    font-weight: bold;
    text-align: center;
    cursor: help;
    overflow-wrap: anywhere;
  }

  .node-type {
    font-family: monospace;
    font-size: smaller;
    text-align: center;
    overflow-wrap: anywhere;
  }

  .node-buttons {
    display: flex;
    gap: 0.4vw;
  }

  .node-button {
    cursor: pointer;
    border: 1px solid var(--border-color);
    border-radius: 3px;
    padding: 1px;
    display: flex;
    align-items: center;
    align-self: flex-start;
    background-color: var(--secondary-color);
  }

  .node-button:hover {
    border: 1px solid var(--border-color-hover);
  }

  .node-info-modal {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.75rem;
  }

  .node-info-modal h2 {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .node-info-modal pre {
    max-height: 70vh;
    margin: 0;
    overflow: auto;
    padding: 1rem;
    border: 1px solid var(--ternary-color);
    border-radius: 6px;
    background: var(--background-color-primary);
    color: var(--ternary-color);
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
      'Courier New', monospace;
    font-size: 0.8rem;
    line-height: 1.45;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  input[type='text'] {
    background-color: var(--secondary-color);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 0.2rem 0.4rem;
    width: 100%;
    box-sizing: border-box;
  }

  input.is-invalid {
    border: 2px solid red;
  }

  .node-button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .value-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .value-row input[type='text'] {
    flex: 1;
    min-width: 0;
  }

  .value-row .node-button {
    align-self: center;
  }

  input.vtk-file-input {
    background-color: var(--button-vtk-bg, #287f8f);
    border-color: var(--button-vtk-bg, #287f8f);
    color: white;
    font-family: monospace;
  }

  input.vtk-file-input:focus {
    border-color: var(--button-vtk-hover, #35a5b8);
    outline: 2px solid
      color-mix(in srgb, var(--button-vtk-bg, #287f8f) 35%, transparent);
  }

  /* Inputs, passthrough guides, outputs; the middle column is empty, so
     0 wide, on a node without passthrough rows. */
  .port-columns {
    display: grid;
    grid-template-columns:
      minmax(min-content, 1fr) auto
      minmax(min-content, 1fr);
    grid-template-rows: repeat(var(--port-row-count), minmax(3.5rem, auto));
    column-gap: 2vh;
  }

  /* Literals have handles but no port labels */
  .port-columns.unlabelled {
    grid-template-rows: repeat(var(--port-row-count), 1.25rem);
  }

  /* A row fills its grid row and reaches over the node's padding (15px) and
     border (2px) on its handle's side, so the handle, centred at the row's
     edge, sits on the node border level with its label. */
  .port-label {
    position: relative;
    display: flex;
    min-width: 0;
    flex-direction: column;
    justify-content: center;
    padding-block: 0.25rem;
  }

  .input-port {
    grid-column: 1;
    margin-left: -17px;
    padding-left: 17px;
  }

  .output-port {
    grid-column: 3;
    margin-right: -17px;
    padding-right: 17px;
  }

  .passthrough-guide {
    grid-column: 2;
    align-self: center;
    display: flex;
    min-width: 7rem;
    align-items: center;
    gap: 0.5rem;
    pointer-events: none;
    color: color-mix(in srgb, var(--border-color-hover) 72%, transparent);
    font-size: 0.7rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .passthrough-guide::before,
  .passthrough-guide::after {
    flex: 1;
    min-width: 1.5rem;
    border-top: 2px dashed currentColor;
    content: '';
  }

  .passthrough-guide span {
    padding: 0.15rem 0.4rem;
    border: 1px solid currentColor;
    border-radius: 999px;
    background: var(--primary-color);
  }

  .input-label {
    font-weight: bold;
  }

  .input-type {
    font-family: monospace;
    font-size: smaller;
    white-space: nowrap;
  }

  .output-label {
    font-weight: bold;
    text-align: right;
  }

  .output-type {
    font-family: monospace;
    font-size: smaller;
    text-align: right;
    white-space: nowrap;
  }

  :global(.passthrough-handle) {
    background: var(--border-color-hover);
    border-color: var(--border-color-hover);
  }
</style>
