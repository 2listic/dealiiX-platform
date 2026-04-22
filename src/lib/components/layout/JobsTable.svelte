<script>
  import { fade, slide } from 'svelte/transition'
  import { Tween } from 'svelte/motion'
  import { cubicOut } from 'svelte/easing'
  import { jobsState, jobIdMapState } from '../../stores/jobsStore.svelte'
  import {
    getOutFileContent,
    getNodesExecutionStatus,
    JOB_DATE_INDEX,
    JOB_LIST_DAYS,
  } from '../../utils/sshMessages'
  import { JobStatus } from '../../types/jobTypes'
  import RefreshIcon from '../icons/RefreshIcon.svelte'
  import Button from './Button.svelte'
  import { toastState } from '../../stores/toastsStore.svelte'
  import TextModal from './TextModal.svelte'
  import NodeStatusModal from './NodeStatusModal.svelte'
  import { getModal } from './Modal.svelte'

  let jobsData = $derived(jobsState.current)
  // $effect(() => console.log('jobsData', $state.snapshot(jobsData)))
  const rotation = new Tween(0, {
    duration: 400,
    easing: cubicOut,
  })

  let isJobListExpanded = $state(false)
  const toggleExpand = async () => {
    isJobListExpanded = !isJobListExpanded
    if (isJobListExpanded) await jobsState.update()
  }

  const updateJobs = async () => {
    rotation.target -= 360
    await jobsState.update()
  }

  let outLogText = $state('')
  let currentJobId = $state('')
  const outLogModalId = 'out-log-modal'

  let nodeStatusMap = $state(new Map())
  let currentStatusJobId = $state('')
  let currentJobIdInternal = $state(undefined)
  const nodeStatusModalId = 'node-status-modal'

  const handleLogClick = async (jobId) => {
    try {
      currentJobId = jobId
      outLogText = await getOutFileContent(jobId)
      getModal(outLogModalId)?.open()
    } catch (error) {
      toastState.add({
        message: error,
        type: 'error',
      })
    }
  }

  const handleNodesExecutionStatus = async (jobIdSlurm) => {
    try {
      const jobIdInternal = jobIdMapState.getJobIdInternal(jobIdSlurm)
      if (jobIdInternal === undefined) {
        throw new Error(
          `No internal job Id found for scheduler job Id ${jobIdSlurm}`
        )
      }
      console.log(
        `Getting nodes execution status for Slurm job Id ${jobIdSlurm}, internal job Id ${jobIdInternal}`
      )
      const result = await getNodesExecutionStatus(jobIdInternal)
      nodeStatusMap = result
      currentStatusJobId = jobIdSlurm
      currentJobIdInternal = jobIdInternal
      getModal(nodeStatusModalId)?.open()
    } catch (error) {
      toastState.add({
        message: error,
        type: 'error',
      })
    }
  }
</script>

<div class="jobs-table-wrapper">
  <div class="wrap-joblist-buttons">
    {#if !jobsState.oneOrLess}
      <div transition:slide>
        <button
          class="button-jobslist"
          onclick={toggleExpand}
          disabled={jobsState.oneOrLess}
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
    {#if !jobsState.isEmpty}
      <div transition:slide>
        <table transition:fade>
          <colgroup>
            <col style="width: 10%;" />
            <col style="width: 16%;" />
            <col style="width: 22%;" />
            <col style="width: 22%;" />
            <col style="width: 12%;" />
            <col style="width: 9%;" />
            <col style="width: 9%;" />
          </colgroup>
          <thead>
            <tr>
              {#each jobsData[0] as headCell, i (i)}
                <th>{headCell}</th>
              {/each}
              <th>Backend</th>
              <th>Logs</th>
              <th>Nodes Status</th>
            </tr>
          </thead>
          <tbody>
            {#if isJobListExpanded}
              {#each jobsData.slice(1) as line (line[0])}
                {@render jobRow(line)}
              {/each}
            {:else}
              {@render jobRow(jobsData[1])}
            {/if}
          </tbody>
        </table>
      </div>

      {#snippet jobRow(line)}
        <tr>
          {#each line as bodyCell, i (i)}
            <td>
              <span>
                {#if JOB_DATE_INDEX.includes(i)}
                  {bodyCell.replace('T', ' ')}
                {:else}
                  {bodyCell}
                {/if}
              </span>
            </td>
          {/each}
          <td>{jobIdMapState.getJobBackendKind(line[0]) ?? '—'}</td>
          <td>
            {#if [JobStatus.COMPLETED, JobStatus.FAILED].includes(line[1])}
              <Button
                size="xsmall"
                title="View logs from the current job"
                onclick={() => handleLogClick(line[0])}>{line[0]}.out</Button
              >
            {/if}
          </td>
          <td>
            {#if jobIdMapState.getJobBackendKind(line[0]) === 'coral'}
              <Button
                size="xsmall"
                title="View the execution status of nodes for the current job"
                onclick={() => handleNodesExecutionStatus(line[0])}
                >Status</Button
              >
            {/if}
          </td>
        </tr>
      {/snippet}
    {:else}
      <div transition:slide>
        <table transition:fade>
          <tbody>
            <tr>
              <td>No jobs submitted in the last {JOB_LIST_DAYS} days</td>
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
  jobIdInternal={currentJobIdInternal}
  title={`Job ${currentStatusJobId} - Nodes Status`}
  onClose={() => {
    nodeStatusMap = new Map()
    currentStatusJobId = ''
    currentJobIdInternal = undefined
  }}
/>

<style>
  .jobs-table-wrapper {
    display: flex;
    gap: 0.5rem;
    background-color: var(--primary-color);
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
    max-height: 7vh;
    overflow: hidden;
    width: 40vw;
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
    padding: 0.4vh;
  }
</style>
