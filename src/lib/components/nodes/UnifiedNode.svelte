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
    type Node,
    type NodeProps,
  } from '@xyflow/svelte'
  import Modal, { getModal } from '../layout/Modal.svelte'
  import WorkingFileMetadataModal from './WorkingFileMetadataModal.svelte'
  import {
    nodeColors,
    NodeType,
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
  import { clearConnectionCache } from '../../utils/connectionsValidation'
  import EditIcon from '../icons/EditIcon.svelte'
  import InfoIcon from '../icons/InfoIcon.svelte'
  import RefreshIcon from '../icons/RefreshIcon.svelte'
  import SuccessIcon from '../icons/SuccessIcon.svelte'
  import TrashIcon from '../icons/TrashIcon.svelte'
  import EditNodeNameModal from './EditNodeNameModal.svelte'
  import { enterSubnetwork } from '../../stores/graphNavigation.svelte'
  import { graphHistoryState } from '../../stores/graphStack.svelte'
  import { explodeNetworkNodeInGraph } from '../../utils/networkNodeCanvas'
  import { toastState } from '../../stores/toastsStore.svelte'
  import OpenIcon from '../icons/OpenIcon.svelte'
  import CubeIcon from '../icons/CubeIcon.svelte'
  import ExplosionIcon from '../icons/ExplosionIcon.svelte'
  import { executionSelectionState } from '../../stores/executionSelection.svelte'
  import { parameterFileEditorState } from '../../stores/parameterFileEditor.svelte'
  import { settingsState } from '../../stores/settingsStore.svelte'
  import { isParameterFileName } from '../../utils/parameterFileFormat'
  import {
    parameterFileExists,
    parameterFileTarget,
  } from '../../utils/parameterFileAccess'
  import {
    parameterHandle,
    parameterInputExposures,
    parameterOutputExposures,
    parameterPathLabel,
    parameterPortCoralType,
  } from '../../utils/parameterPorts'
  import {
    isOverloadNodeDefinition,
    type NodeDefinitions,
    type StandardNodeDefinition,
    type WorkingFileReference,
  } from '../../types/nodeTypes'
  import { returnNodeName } from '../../utils/canvasNodeUtils'
  import { isVtkFileName } from '../../utils/vtkFileFormat'
  import {
    buildVtkVisualizerUrl,
    vtkVisualizerFileExists,
    vtkVisualizerTarget,
  } from '../../utils/vtkVisualizer'
  import { openNewWindow } from '../../utils/sshMessages'
  import {
    overloadInterfaceForCandidates,
    overloadStatus,
    resolveOverloadGraph,
  } from '../../utils/overloadResolution'

  let {
    id,
    data,
    type,
    selected = false,
  }: NodeProps<UnifiedNodeType> = $props()

  // data.is_valid = true
  let isValid = $derived(data?.is_valid ?? true)
  let hasCustomName = $derived(data.name && data.name.trim() !== '')
  let isNetworkNode = $derived(data.node_type === NodeType.NETWORK)
  let isOverloadNode = $derived(data.node_type === NodeType.OVERLOAD)
  let overloadCandidates = $derived.by(() => {
    if (!isOverloadNode || !isOverloadNodeDefinition(data)) return []
    const resolution = resolveOverloadGraph(
      getNodesSnapshot() as Node<NodeDefinitions>[],
      getEdgesSnapshot()
    )
    return resolution.candidatesByNodeId[id] ?? data.candidates
  })
  let currentOverloadStatus = $derived(
    isOverloadNode && isOverloadNodeDefinition(data)
      ? overloadStatus(data, overloadCandidates)
      : null
  )
  let isOverloadFinalized = $derived(
    isOverloadNode && isOverloadNodeDefinition(data) && data.finalized === true
  )
  let color = $derived(nodeColors[type as keyof typeof nodeColors])
  let activeLocation = $derived(executionSelectionState.location)
  let workingDirectory = $derived(
    activeLocation === 'local'
      ? settingsState.local.workingDirectory
      : settingsState.remote.workingDirectory
  )
  const valueForNode = (): string | undefined =>
    'value' in data && data.value != null ? String(data.value) : undefined
  let isParameterFile = $derived(
    [Type.STRING, Type.STR].includes(data.type as Type) &&
      isParameterFileName(valueForNode())
  )
  let isVtkFile = $derived(
    [Type.STRING, Type.STR].includes(data.type as Type) &&
      isVtkFileName(valueForNode())
  )
  let parameterFileAvailable = $state(false)
  let parameterFileCheckPending = $state(false)
  let parameterCheckId = 0
  let stagedFileMetadataModalId = $derived(`working-file-${id}`)
  let workingFileMetadata = $derived(
    (data as StandardNodeDefinition).working_file
  )
  let parameterInputs = $derived(
    parameterInputExposures(data as StandardNodeDefinition)
  )
  let parameterOutputs = $derived(
    parameterOutputExposures(data as StandardNodeDefinition)
  )
  let totalInputs = $derived(data.inputs.length + parameterInputs.length)
  let totalOutputs = $derived(data.outputs.length + parameterOutputs.length)
  let nodeInfoModalId = $derived(`node-info-${id}`)
  let nodeInfoJson = $derived(JSON.stringify(data, null, 2))
  let nodeDisplayName = $derived(returnNodeName(data))

  const { updateNodeData } = useSvelteFlow()

  let editNodeModalId = $derived(`edit-node-${id}`)

  const checkParameterFileAvailability = async (): Promise<boolean> => {
    const fileName = valueForNode()
    const checkId = ++parameterCheckId
    parameterFileAvailable = false
    parameterFileCheckPending = false
    if (!isParameterFile || !workingDirectory || !fileName) return false

    parameterFileCheckPending = true
    const target = parameterFileTarget(activeLocation, fileName)
    try {
      const exists = await parameterFileExists(target)
      if (checkId !== parameterCheckId) return false
      parameterFileAvailable = exists
      return exists
    } catch {
      if (checkId !== parameterCheckId) return false
      parameterFileAvailable = false
      return false
    } finally {
      if (checkId === parameterCheckId) parameterFileCheckPending = false
    }
  }

  $effect(() => {
    isParameterFile
    workingDirectory
    activeLocation
    valueForNode()
    void checkParameterFileAvailability()
  })

  const handleOpenParameters = async () => {
    try {
      await parameterFileEditorState.open(
        parameterFileTarget(activeLocation, valueForNode() ?? ''),
        {
          exposures: (data as StandardNodeDefinition).parameter_file?.exposures,
          onExposureChange: (exposures) => {
            graphHistoryState.checkpoint()
            updateNodeData(id, {
              parameter_file: { exposures },
            })
            clearConnectionCache()
          },
        }
      )
    } catch (error) {
      toastState.add({
        message:
          error instanceof Error ? error.message : 'Failed to open parameters',
        type: 'error',
      })
    }
  }

  const handleParameterFileAction = async () => {
    if (parameterFileCheckPending) return
    // The run may have created a previously missing file. Refresh the
    // filesystem state on every click before choosing the action.
    if (await checkParameterFileAvailability()) {
      void handleOpenParameters()
    } else {
      getModal(stagedFileMetadataModalId)?.open()
    }
  }

  const handleWorkingFileMetadataSave = (metadata: WorkingFileReference) => {
    graphHistoryState.checkpoint()
    updateNodeData(id, { working_file: metadata })
    clearConnectionCache()
  }

  const handleOpenVtkFile = async () => {
    try {
      const target = vtkVisualizerTarget(activeLocation, valueForNode() ?? '')
      if (!(await vtkVisualizerFileExists(target))) {
        throw new Error('VTK file is not available in the working directory')
      }
      await openNewWindow(
        buildVtkVisualizerUrl(settingsState.urlVisualizer, target)
      )
    } catch (error) {
      toastState.add({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to open the VTK visualizer',
        type: 'error',
      })
    }
  }

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

  /** Toggles a resolved family between its concrete and union interfaces. */
  const handleToggleOverloadFinalization = () => {
    if (!isOverloadNodeDefinition(data)) return

    const isFinalizing = data.finalized !== true
    const candidate = overloadCandidates[0]
    if (isFinalizing && !candidate) return

    graphHistoryState.checkpoint()
    updateNodeData(id, {
      ...overloadInterfaceForCandidates(
        isFinalizing ? [candidate] : data.candidates
      ),
      finalized: isFinalizing,
      finalized_candidate_type: isFinalizing ? candidate?.type : undefined,
    })
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
      <div class="node-name" title={data.type}>{nodeDisplayName}</div>
      {#if isOverloadNode && currentOverloadStatus}
        <div class="overload-status" data-status={currentOverloadStatus}>
          {currentOverloadStatus === 'resolved'
            ? isOverloadFinalized
              ? 'finalized'
              : 'resolved'
            : currentOverloadStatus === 'partially_constrained'
              ? `${overloadCandidates.length} variants remain`
              : currentOverloadStatus === 'invalid'
                ? 'no compatible variant'
                : `${overloadCandidates.length} variants`}
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
            title={parameterFileAvailable
              ? 'Open parameters'
              : 'Configure parameter file creation'}
            aria-label={parameterFileAvailable
              ? 'Open parameters'
              : 'Configure parameter file creation'}
            disabled={parameterFileCheckPending}
            onclick={handleParameterFileAction}
          >
            <OpenIcon width="20px" height="20px" />
          </button>
        {/if}
        {#if isVtkFile}
          <button
            class="node-button vtk-button"
            title="Open VTK file in visualizer"
            aria-label="Open VTK file in visualizer"
            disabled={!workingDirectory}
            onclick={handleOpenVtkFile}
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
      {#if isOverloadNode && currentOverloadStatus === 'resolved'}
        <button
          class="node-button overload-finalize-button"
          title={isOverloadFinalized
            ? 'Show alternative overload options'
            : 'Finalize resolved overload'}
          aria-label={isOverloadFinalized
            ? 'Show alternative overload options'
            : 'Finalize resolved overload'}
          onclick={(event) => {
            event.stopPropagation()
            handleToggleOverloadFinalization()
          }}
          onmousedown={(event) => event.stopPropagation()}
        >
          {#if isOverloadFinalized}
            <RefreshIcon width="20px" height="20px" rotation={0} />
          {:else}
            <SuccessIcon width="20px" />
          {/if}
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

  <!-- Input handlers -->
  {#each data.inputs as i, index (i)}
    <Handle
      id={`input-${index}`}
      type="target"
      position={Position.Left}
      style="top: {(100 / (totalInputs + 1)) * (index + 1) + 5}%;"
    />
  {/each}
  {#each parameterInputs as exposure, index (parameterHandle('input', exposure.path))}
    <Handle
      id={parameterHandle('input', exposure.path)}
      type="target"
      position={Position.Left}
      class="parameter-handle"
      style="top: {(100 / (totalInputs + 1)) *
        (data.inputs.length + index + 1) +
        5}%;"
    />
  {/each}

  <!-- Output handlers -->
  {#each data.outputs as i, index (i)}
    <Handle
      id={`output-${index}`}
      type="source"
      position={Position.Right}
      style="top: {(100 / (totalOutputs + 1)) * (index + 1) + 5}%;"
    />
  {/each}
  {#each parameterOutputs as exposure, index (parameterHandle('output', exposure.path))}
    <Handle
      id={parameterHandle('output', exposure.path)}
      type="source"
      position={Position.Right}
      class="parameter-handle"
      style="top: {(100 / (totalOutputs + 1)) *
        (data.outputs.length + index + 1) +
        5}%;"
    />
  {/each}

  <!-- Input / output labels -->
  {#if data.arguments.length > 0}
    <div style="display: flex; flex-direction: row; gap: 4vh">
      <div class="input-column">
        {#each data.inputs as i (i)}
          {#if ['input', 'pass_through'].includes(data.arguments[i]?.connection_type)}
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

  {#if parameterInputs.length > 0 || parameterOutputs.length > 0}
    <div class="parameter-port-columns">
      <div class="input-column">
        {#each parameterInputs as exposure (parameterHandle('input', exposure.path))}
          <div class="parameter-port-label">
            <div class="input-label">{parameterPathLabel(exposure.path)}</div>
            <div class="input-type">
              {parameterPortCoralType(exposure.type)}
            </div>
          </div>
        {/each}
      </div>
      <div class="output-column">
        {#each parameterOutputs as exposure (parameterHandle('output', exposure.path))}
          <div class="parameter-port-label">
            <div class="output-label">{parameterPathLabel(exposure.path)}</div>
            <div class="output-type">
              {parameterPortCoralType(exposure.type)}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Elementary constructor / primitive literal input fields -->
  {#if data.node_type === NodeType.ELEMENTARY_CONSTRUCTOR || data.node_type === NodeType.PRIMITIVE}
    <div>
      {#if data.type === Type.BOOLEAN}
        <input
          type="checkbox"
          value={data.value}
          oninput={(evt) => {
            graphHistoryState.checkpoint()
            updateNodeData(id, {
              value: evt.currentTarget.checked ? 'true' : 'false',
            })
          }}
        />
        <span>{data.value === 'true' ? 'true' : 'false'}</span>
      {:else}
        <!-- All other elementary constructors -->
        <!-- onfocus/onblur bracket the edit gesture so undo restores the pre-edit value -->
        <input
          type="text"
          class:is-invalid={!isValid}
          class:parameter-file-input={isParameterFile}
          class:vtk-file-input={isVtkFile}
          value={data.value}
          onfocus={() => graphHistoryState.begin()}
          onblur={() => graphHistoryState.commit()}
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
  currentName={hasCustomName ? (data.name ?? data.type) : data.type}
/>

{#if isParameterFile}
  <WorkingFileMetadataModal
    modalId={stagedFileMetadataModalId}
    fileName={valueForNode() ?? ''}
    currentMetadata={workingFileMetadata}
    onSave={handleWorkingFileMetadataSave}
  />
{/if}

<Modal id={nodeInfoModalId} size="lg">
  <div class="node-info-modal">
    <h2>{nodeDisplayName}</h2>
    <pre>{nodeInfoJson}</pre>
  </div>
</Modal>

<style>
  .custom-node {
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
    flex-direction: column;
  }

  .overload-status {
    font-size: 0.7rem;
    opacity: 0.8;
  }

  .overload-status[data-status='resolved'] {
    color: #8fd694;
  }

  .overload-status[data-status='invalid'] {
    color: #ff8a80;
  }

  .node-name {
    font-weight: bold;
    text-align: center;
    cursor: help;
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

  .node-button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
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

  input.parameter-file-input {
    background-color: var(--button-action-bg);
    border-color: var(--button-action-bg);
    color: white;
    font-family: monospace;
  }

  input.parameter-file-input:focus {
    border-color: var(--button-action-hover);
    outline: 2px solid
      color-mix(in srgb, var(--button-action-bg) 35%, transparent);
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

  :global(.parameter-handle) {
    background: var(--button-action-bg);
    border-color: var(--button-action-hover);
  }

  .parameter-port-columns {
    display: flex;
    flex-direction: row;
    gap: 4vh;
    margin-top: 0.5rem;
    border-top: 1px solid var(--border-color);
    padding-top: 0.25rem;
  }

  .parameter-port-label {
    font-size: 0.8rem;
  }
</style>
