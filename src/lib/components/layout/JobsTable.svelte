<script>
  import { onMount } from 'svelte'
  import { fade, slide } from 'svelte/transition'
  import { Tween } from 'svelte/motion'
  import { cubicOut } from 'svelte/easing'
  import { jobsState, jobIdMapState } from '../../stores/jobsStore.svelte'
  import { settingsState, SSH_PATH } from '../../stores/settingsStore.svelte'
  import {
    COMPLETED,
    FAILED,
    getOutFileContent,
    getNodesExecutionStatus,
    JOB_DATE_INDEX,
    JOB_LIST_DAYS,
  } from '../../utils/sshMessages'
  import RefreshIcon from '../icons/RefreshIcon.svelte'
  import Button from './Button.svelte'
  import { toastState } from '../../stores/toastsStore.svelte'
  import TextModal from './TextModal.svelte'
  import { getModal } from './Modal.svelte'

  let isLoaded = $state(false)
  let jobsData = $derived(jobsState.current)
  // $effect(() => console.log('jobsData', $state.snapshot(jobsData)))
  const rotation = new Tween(0, {
    duration: 400,
    easing: cubicOut,
  })

  onMount(async () => {
    if (settingsState.getKey(SSH_PATH)) {
      // run sacct only if ssh path is set
      await jobsState.update()
    }
    isLoaded = true
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
      const key = jobIdMapState.getJobIdInternal(jobIdSlurm)
      if (key === undefined) {
        throw new Error(`No internal key found for job ${jobIdSlurm}`)
      }
      const result = await getNodesExecutionStatus(key)
      console.log('Nodes execution status:', result)
      return result
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
  {#if isLoaded}
    <div class="container-table-jobs {isJobListExpanded ? 'expanded' : ''}">
      {#if !jobsState.isEmpty}
        <div transition:slide>
          <table transition:fade>
            <colgroup>
              <col style="width: 10%;" />
              <col style="width: 18%;" />
              <col style="width: 27%;" />
              <col style="width: 27%;" />
              <col style="width: 9%;" />
              <col style="width: 9%;" />
            </colgroup>
            <thead>
              <tr>
                {#each jobsData[0] as headCell, i (i)}
                  <th>{headCell}</th>
                {/each}
                <th>Logs</th>
                <th>Nodes Status</th>
              </tr>
            </thead>
            <tbody>
              {#if isJobListExpanded}
                {#each jobsData as line, index (line[0])}
                  {#if index > 0}
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
                      <td>
                        {#if [COMPLETED, FAILED].includes(line[1])}
                          <Button
                            size="xsmall"
                            onclick={() => handleLogClick(line[0])}
                            >{line[0]}.out</Button
                          >
                        {/if}
                      </td>
                      <td>
                        <Button
                          size="xsmall"
                          onclick={() => handleNodesExecutionStatus(line[0])}
                          >Nodes</Button
                        >
                      </td>
                    </tr>
                  {/if}
                {/each}
              {:else}
                <tr>
                  {#each jobsData[1] as bodyCell, i (i)}
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
                  <td>
                    {#if [COMPLETED, FAILED].includes(jobsData[1][1])}
                      <Button
                        size="xsmall"
                        onclick={() => handleLogClick(jobsData[1][0])}
                        >{jobsData[1][0]}.out</Button
                      >
                    {/if}
                  </td>
                  <td>
                    <Button
                      size="xsmall"
                      onclick={() => handleNodesExecutionStatus(jobsData[1][0])}
                      >Nodes</Button
                    >
                  </td>
                </tr>
              {/if}
            </tbody>
          </table>
        </div>
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
  {/if}
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
