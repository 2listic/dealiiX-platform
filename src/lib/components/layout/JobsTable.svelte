<script lang="ts">
  import { fade, slide } from 'svelte/transition'
  import { Tween } from 'svelte/motion'
  import { cubicOut } from 'svelte/easing'
  import type { RunStatus } from '../../types/executionService'
  import RefreshIcon from '../icons/RefreshIcon.svelte'
  import Button from './Button.svelte'
  import { toastState } from '../../stores/toastsStore.svelte'
  import TextModal from './TextModal.svelte'
  import NodeStatusModal from './NodeStatusModal.svelte'
  import { getModal } from './Modal.svelte'
  import {
    obsolete,
    workflowService,
  } from '../../stores/workflowService.svelte'

  const rotation = new Tween(0, {
    duration: 400,
    easing: cubicOut,
  })

  let isJobListExpanded = $state(false)
  const toggleExpand = async () => {
    isJobListExpanded = !isJobListExpanded
    if (isJobListExpanded && workflowService.operations.includes('status'))
      await refresh()
  }

  const updateJobs = async () => {
    rotation.target -= 360
    await refresh()
  }

  const refresh = async () => {
    try {
      if (!workflowService.enabled)
        return obsolete('Configure a workflow backend to refresh runs.')
      if (!workflowService.operations.includes('status'))
        return obsolete('This backend does not offer run status.')
      await workflowService.refreshRuns()
    } catch (error) {
      toastState.add({
        message: error instanceof Error ? error.message : String(error),
        type: 'error',
      })
    }
  }

  let outLogText = $state('')
  let currentJobId = $state('')
  const outLogModalId = 'out-log-modal'

  let currentStatusJobId = $state('')
  const nodeStatusModalId = 'node-status-modal'
  const schedulingLabels = {
    draining: 'Pausing · waiting for active stages',
    paused: 'Paused',
    resuming: 'Resuming',
  }
  const currentRun = $derived(
    workflowService.runs.find((run) => run.run_id === currentStatusJobId)
  )
  const nodeStatusMap = $derived(
    new Map(
      Object.entries(currentRun?.nodes ?? {}).map(([id, status]) => [
        id,
        [status.state],
      ])
    )
  )
  const isCurrentStatusJobTerminal = $derived(
    currentRun?.state === 'succeeded' ||
      currentRun?.state === 'failed' ||
      currentRun?.state === 'cancelled'
  )

  const handleLogClick = async (jobId: string) => {
    try {
      currentJobId = jobId
      if (!workflowService.operations.includes('logs'))
        return obsolete('This backend does not offer run logs.')
      outLogText = await workflowService.logs(jobId)
      getModal(outLogModalId)?.open()
    } catch (error) {
      toastState.add({
        message: error instanceof Error ? error.message : String(error),
        type: 'error',
      })
    }
  }

  const handleNodesExecutionStatus = (runId: string) => {
    currentStatusJobId = runId
    getModal(nodeStatusModalId)?.open()
  }
</script>

<div class="jobs-table-wrapper">
  <div class="wrap-joblist-buttons">
    {#if workflowService.runs.length > 1}
      <div transition:slide>
        <button
          class="button-jobslist"
          onclick={toggleExpand}
          aria-label="Show or hide submitted jobs"
          title="Show or hide submitted jobs"
        >
          {#if isJobListExpanded}
            <span style="font-size: 1.2rem; font-weight: bold;">-</span>
          {:else}
            <span style="font-size: 1.2rem; font-weight: bold;">+</span>
          {/if}
        </button>
      </div>
    {/if}
    <button
      class="button-jobslist"
      onclick={updateJobs}
      disabled={false}
      aria-label="Refresh state of submitted jobs"
      title="Refresh state of submitted jobs"
    >
      <RefreshIcon width="20px" height="20px" {rotation} />
    </button>
  </div>
  <div class="container-table-jobs {isJobListExpanded ? 'expanded' : ''}">
    {#if workflowService.runs.length > 0}
      <div transition:slide>
        <table transition:fade>
          <thead>
            <tr>
              <th>Run</th>
              <th>State</th>
              <th>Logs</th>
              <th>Nodes Status</th>
            </tr>
          </thead>
          <tbody>
            {#if isJobListExpanded}
              {#each workflowService.runs as run (run.run_id)}
                {@render jobRow(run)}
              {/each}
            {:else}
              {@render jobRow(workflowService.runs[0])}
            {/if}
          </tbody>
        </table>
      </div>

      {#snippet jobRow(run: RunStatus)}
        <tr>
          <td>{run.run_id}</td>
          <td>
            {run.scheduling && run.scheduling.state !== 'active'
              ? schedulingLabels[run.scheduling.state]
              : run.state}
          </td>
          <td>
            <Button
              size="xsmall"
              title="View logs from the current job"
              onclick={() => handleLogClick(run.run_id)}
              >{run.run_id}.out</Button
            >
          </td>
          <td>
            <Button
              size="xsmall"
              title="View the execution status of nodes for the current job"
              onclick={() => handleNodesExecutionStatus(run.run_id)}
              >Status</Button
            >
          </td>
        </tr>
      {/snippet}
    {:else}
      <div transition:slide>
        <table transition:fade>
          <tbody>
            <tr>
              <td>No jobs submitted</td>
            </tr>
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<TextModal
  modalId={outLogModalId}
  message={outLogText}
  title={`${currentJobId}.out file`}
  size="lg"
  buttonText="Close"
  onClose={() => {
    outLogText = ''
    currentJobId = ''
  }}
/>

<NodeStatusModal
  modalId={nodeStatusModalId}
  statusMap={nodeStatusMap}
  isJobTerminal={isCurrentStatusJobTerminal}
  title={`Job ${currentStatusJobId} - Nodes Status`}
  onClose={() => (currentStatusJobId = '')}
/>

<style>
  .jobs-table-wrapper {
    display: flex;
    gap: 0.5rem;
    background-color: var(--surface-color);
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    border-radius: 5px;
  }

  .wrap-joblist-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .button-jobslist {
    color: var(--ternary-color);
    background-color: var(--background-color-secondary);
    width: 2rem;
    height: 2rem;
    border: 1px solid grey;
    border-radius: 10px;
  }
  .button-jobslist:not([disabled]):hover {
    border-color: var(--border-color-hover);
    cursor: pointer;
  }
  .button-jobslist:disabled {
    color: gray;
  }

  .container-table-jobs {
    display: flex;
    flex-direction: column;
    max-height: 8vh;
    overflow: hidden;
    width: 60vw;
    transition: all 1s ease-in-out;
  }
  .container-table-jobs.expanded {
    max-height: 40vh;
    overflow-y: scroll;
    scrollbar-width: thin;
  }

  table {
    width: 100%;
    table-layout: auto; /* forces equal column distribution */
  }
  th,
  td {
    text-align: center;
    vertical-align: top; /* first line always visible when content wraps */
    padding: 0.4vh;
  }
</style>
