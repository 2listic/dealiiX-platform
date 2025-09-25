<script>
  import { onMount } from 'svelte'
  import { jobsState } from '../../stores/jobsStore.svelte'
  import { JOB_DATE_INDEX, JOB_LIST_DAYS } from '../../utils/sshMessages'
  import { fade, slide } from 'svelte/transition'
  import { settingsState, SSH_PATH } from '../../stores/settingsStore.svelte'

  onMount(() => {
    if (settingsState.getKey(SSH_PATH)) {
      // run sacct only if ssh path is set
      jobsState.update()
    }
  })

  let isJobListExpanded = $state(false)

  const toggleExpand = () => {
    isJobListExpanded = !isJobListExpanded
    if (isJobListExpanded) jobsState.update()
  }
</script>

<div class="jobs-table-wrapper">
  <button
    class="button-jobslist-expansion"
    onclick={toggleExpand}
    aria-label="Show or hide submitted jobs"
    title="Show or hide submitted jobs"
  >
    {#if isJobListExpanded}
      -
    {:else}
      +
    {/if}
  </button>
  <div class="container-table-jobs {isJobListExpanded ? 'expanded' : ''}">
    {#if !jobsState.isEmpty}
      <div transition:slide>
        <table transition:fade>
          <thead>
            <tr>
              {#each jobsState.current[0] as headCell, i (i)}
                <th>{headCell}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#if isJobListExpanded}
              {#each jobsState.current as line, index (line[0])}
                {#if index > 0}
                  <tr>
                    {#each line as bodyCell, i (i)}
                      <td>
                        {#if JOB_DATE_INDEX.includes(i)}
                          {bodyCell.replace('T', ' ')}
                        {:else}
                          {bodyCell}
                        {/if}
                      </td>
                    {/each}
                  </tr>
                {/if}
              {/each}
            {:else}
              <tr>
                {#each jobsState.current[1] as bodyCell, i (i)}
                  <td>
                    {#if JOB_DATE_INDEX.includes(i)}
                      {bodyCell.replace('T', ' ')}
                    {:else}
                      {bodyCell}
                    {/if}
                  </td>
                {/each}
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
</div>

<style>
  .jobs-table-wrapper {
    display: flex;
    gap: 0.5rem;
    background-color: var(--primary-color);
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    border-radius: 5px;
  }

  .button-jobslist-expansion {
    font-size: 1.5 rem;
    font-weight: bold;
    color: var(--ternary-color);
    background-color: var(--background-color-secondary);
    width: 2rem;
    height: 2rem;
    border: 1px solid grey;
    border-radius: 10px;
    cursor: pointer;
  }
  .button-jobslist-expansion:hover {
    border-color: var(--border-color-hover);
  }

  .container-table-jobs {
    display: flex;
    flex-direction: column;
    max-height: 10vh;
    min-width: 35vw;
    overflow-y: auto;
    overflow-x: hidden;
    overflow: hidden;
    scrollbar-width: thin;
    transition: max-height 0.5s ease-in-out;
  }
  .container-table-jobs.expanded {
    max-height: 90vh;
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
