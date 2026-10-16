<!--
  The parameter-file part of a node: the actions that mark it as a parameter
  file or open its file, and the handles and labels of its exposed parameters.
  A node is a parameter file when it has `parameter_file`; a `.json` / `.prm`
  value on a string node only offers "Use as parameter file".
-->
<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte'
  import Button from '../layout/Button.svelte'
  import { Type, type StandardNodeDefinition } from '../../types/nodeTypes'
  import { executionSelectionState } from '../../stores/executionSelection.svelte'
  import { parameterNodeEditorState } from '../../stores/parameterNodeEditor.svelte'
  import { settingsState } from '../../stores/settingsStore.svelte'
  import { toastState } from '../../stores/toastsStore.svelte'
  import { isParameterFileName } from '../../utils/parameterFileFormat'
  import { parameterFileTarget } from '../../utils/parameterFileAccess'
  import {
    markParameterFile,
    staleParameterEdges,
    unmarkParameterFile,
  } from '../../utils/parameterNodeCanvas'
  import {
    parameterHandle,
    parameterInputExposures,
    parameterOutputExposures,
    parameterPathLabel,
    parameterPortCoralType,
  } from '../../utils/parameterPorts'

  let {
    id,
    data,
    inputCount,
    outputCount,
  }: {
    /** Id of the node. */
    id: string
    /** The node's data. */
    data: StandardNodeDefinition
    /** Number of the node's ordinary input handles, placed above the parameter ones. */
    inputCount: number
    /** Number of the node's ordinary output handles, placed above the parameter ones. */
    outputCount: number
  } = $props()

  let isMarked = $derived(Boolean(data.parameter_file))
  let suggestsMarking = $derived(
    !isMarked &&
      [Type.STRING, Type.STR].includes(data.type as Type) &&
      isParameterFileName(data.value)
  )
  let activeLocation = $derived(executionSelectionState.location)
  let workingDirectory = $derived(
    activeLocation === 'local'
      ? settingsState.local.workingDirectory
      : settingsState.remote.workingDirectory
  )
  let parameterInputs = $derived(parameterInputExposures(data))
  let parameterOutputs = $derived(parameterOutputExposures(data))
  let totalInputs = $derived(inputCount + parameterInputs.length)
  let totalOutputs = $derived(outputCount + parameterOutputs.length)
  let openTitle = $derived(
    workingDirectory
      ? undefined
      : `Set the ${activeLocation} working directory in Settings first`
  )

  // Opens the file at the active location without checking it exists first:
  // a missing file makes open() throw, reported in an error toast.
  const openParameters = async () => {
    try {
      await parameterNodeEditorState.open(
        parameterFileTarget(activeLocation, data.value),
        { nodeId: id, exposures: data.parameter_file?.exposures }
      )
    } catch (error) {
      toastState.add({
        message:
          error instanceof Error ? error.message : 'Failed to open parameters',
        type: 'error',
      })
      return false
    }
    return true
  }

  // Marks the node only once its file opened, so a mistyped path leaves no marker.
  const useAsParameterFile = async () => {
    if (await openParameters()) markParameterFile(id)
  }

  const unmark = () => {
    const removed = staleParameterEdges(id, []).length
    if (
      removed > 0 &&
      !window.confirm(
        `This removes ${removed} ${removed === 1 ? 'connection' : 'connections'} from the graph. Continue?`
      )
    ) {
      return
    }
    unmarkParameterFile(id)
  }
</script>

{#each parameterInputs as exposure, index (parameterHandle('input', exposure.path))}
  <Handle
    id={parameterHandle('input', exposure.path)}
    type="target"
    position={Position.Left}
    class="parameter-handle"
    style="top: {(100 / (totalInputs + 1)) * (inputCount + index + 1) + 5}%;"
  />
{/each}
{#each parameterOutputs as exposure, index (parameterHandle('output', exposure.path))}
  <Handle
    id={parameterHandle('output', exposure.path)}
    type="source"
    position={Position.Right}
    class="parameter-handle"
    style="top: {(100 / (totalOutputs + 1)) * (outputCount + index + 1) + 5}%;"
  />
{/each}

{#if isMarked}
  <div class="parameter-actions">
    <Button
      size="xsmall"
      variant="action"
      disabled={!workingDirectory}
      title={openTitle}
      onclick={openParameters}
    >
      Open parameters
    </Button>
    <Button size="xsmall" title="Stop using as parameter file" onclick={unmark}>
      Unmark
    </Button>
  </div>
{:else if suggestsMarking}
  <div class="parameter-actions">
    <Button
      size="xsmall"
      disabled={!workingDirectory}
      title={openTitle}
      onclick={useAsParameterFile}
    >
      Use as parameter file
    </Button>
  </div>
{/if}

{#if parameterInputs.length > 0 || parameterOutputs.length > 0}
  <div class="parameter-ports">
    <div class="port-column">
      {#each parameterInputs as exposure (parameterHandle('input', exposure.path))}
        <div class="port-label">
          <div class="port-name">{parameterPathLabel(exposure.path)}</div>
          <div class="port-type">{parameterPortCoralType(exposure.type)}</div>
        </div>
      {/each}
    </div>
    <div class="port-column outputs">
      {#each parameterOutputs as exposure (parameterHandle('output', exposure.path))}
        <div class="port-label">
          <div class="port-name">{parameterPathLabel(exposure.path)}</div>
          <div class="port-type">{parameterPortCoralType(exposure.type)}</div>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  :global(.parameter-handle) {
    background: var(--button-action-bg);
    border-color: var(--button-action-hover);
  }

  .parameter-actions {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.5rem;
  }

  .parameter-ports {
    display: flex;
    flex-direction: row;
    gap: 4vh;
    margin-top: 0.5rem;
    border-top: 1px solid var(--border-color);
    padding-top: 0.25rem;
    font-size: 0.8rem;
  }

  .port-column {
    display: flex;
    flex-direction: column;
    flex: 1;
    justify-content: space-evenly;
  }

  .port-column.outputs {
    align-items: end;
    text-align: right;
  }

  .port-name {
    font-weight: bold;
    margin-top: 1vh;
  }

  .port-type {
    font-family: monospace;
    font-size: smaller;
  }
</style>
