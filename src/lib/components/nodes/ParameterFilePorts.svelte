<!--
  The body of a parameter-file node: the file path, read-only, with the
  node's own handles and the Unmark button, then one row per exposed
  parameter, grouped by section. Each row holds its handles, so a handle sits
  next to the parameter it stands for. To point the node at another file,
  unmark it, edit the value and mark it again.
-->
<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte'
  import UnmarkIcon from '../icons/UnmarkIcon.svelte'
  import ConfirmationModal from '../layout/ConfirmationModal.svelte'
  import { getModal } from '../layout/Modal.svelte'
  import type { StandardNodeDefinition } from '../../types/nodeTypes'
  import {
    staleParameterEdges,
    unmarkParameterFile,
  } from '../../utils/parameterNodeCanvas'
  import {
    groupExposuresBySection,
    normalizeParameterExposures,
    parameterHandle,
    parameterPathLabel,
    parameterPortCoralType,
  } from '../../utils/parameterPorts'

  let {
    id,
    data,
  }: {
    /** Id of the node. */
    id: string
    /** The node's data; it carries `parameter_file`. */
    data: StandardNodeDefinition
  } = $props()

  let exposures = $derived(
    normalizeParameterExposures(data.parameter_file?.exposures)
  )
  let sections = $derived(groupExposuresBySection(exposures))

  let unmarkModalId = $derived(`unmark-parameter-file-${id}`)
  let removedConnections = $state(0)

  // Asks only when unmarking removes connections. The app's modal, not
  // window.confirm: after a native dialog Electron can leave inputs unfocusable.
  const unmark = () => {
    removedConnections = staleParameterEdges(id, []).length
    if (removedConnections === 0) {
      unmarkParameterFile(id)
      return
    }
    getModal(unmarkModalId)?.open()
  }
</script>

<div class="row path-row">
  {#each data.inputs as i, index (i)}
    <Handle id={`input-${index}`} type="target" position={Position.Left} />
  {/each}
  <input
    type="text"
    class="path"
    value={data.value}
    title={data.value}
    aria-label="Parameter file path"
    disabled
  />
  <button
    class="unmark"
    title="Stop using as parameter file"
    aria-label="Stop using as parameter file"
    onclick={unmark}
  >
    <UnmarkIcon width="20px" height="20px" />
  </button>
  {#each data.outputs as o, index (o)}
    <Handle id={`output-${index}`} type="source" position={Position.Right} />
  {/each}
</div>

{#if exposures.length === 0}
  <div class="hint">Open the parameters to expose entries as ports.</div>
{/if}

{#each sections as group (JSON.stringify(group.section))}
  {#if group.section.length > 0}
    <div class="section">{parameterPathLabel(group.section)}</div>
  {/if}
  {#each group.exposures as exposure (JSON.stringify(exposure.path))}
    <div class="row" title={parameterPathLabel(exposure.path)}>
      {#if exposure.input}
        <Handle
          id={parameterHandle('input', exposure.path)}
          type="target"
          position={Position.Left}
          class="parameter-handle"
        />
      {/if}
      <span class="entry">{exposure.path.at(-1)}</span>
      <span class="entry-type">{parameterPortCoralType(exposure.type)}</span>
      {#if exposure.output}
        <Handle
          id={parameterHandle('output', exposure.path)}
          type="source"
          position={Position.Right}
          class="parameter-handle"
        />
      {/if}
    </div>
  {/each}
{/each}

<ConfirmationModal
  modalId={unmarkModalId}
  title="Unmark parameter file"
  message={`This removes ${removedConnections} ${removedConnections === 1 ? 'connection' : 'connections'} from the graph. Continue?`}
  confirmText="Unmark"
  confirmVariant="delete"
  onConfirm={() => unmarkParameterFile(id)}
/>

<style>
  :global(.parameter-handle) {
    background: var(--button-action-bg);
    border-color: var(--button-action-hover);
  }

  /* Rows span the node's padding (15px) and border (2px), so a handle,
     placed at the row's edge, sits on the node border like any other. */
  .row {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin: 0 -17px;
    padding: 0.2rem 17px;
    font-size: 0.8rem;
  }

  .path-row {
    gap: 0.4rem;
    margin-bottom: 0.25rem;
  }

  .path {
    flex: 1;
    min-width: 0;
    padding: 0.2rem 0.4rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background-color: var(--secondary-color);
    color: inherit;
    font-size: 1rem;
    text-overflow: ellipsis;
    opacity: 0.8;
  }

  .unmark {
    cursor: pointer;
    display: flex;
    padding: 1px;
    border: 1px solid var(--border-color);
    border-radius: 3px;
    background-color: var(--secondary-color);
  }

  .unmark:hover {
    border-color: var(--border-color-hover);
  }

  .hint {
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .section {
    margin-top: 0.4rem;
    padding-top: 0.25rem;
    border-top: 1px solid var(--border-color);
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .entry {
    font-weight: bold;
  }

  .entry-type {
    font-family: monospace;
    font-size: smaller;
  }
</style>
