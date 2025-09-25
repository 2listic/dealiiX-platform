<script>
  import { onMount } from 'svelte'
  import { jobsState, jobsListState } from '../../stores/jobsStore.svelte'
  import { JOB_DATE_INDEX } from '../../utils/sshMessages'
  // import { fade, slide } from 'svelte/transition'
  import { settingsState, SSH_PATH } from '../../stores/settingsStore.svelte'

  onMount(() => {
    if (settingsState.getKey(SSH_PATH)) {
      // run sacct only if ssh path is set
      jobsState.update()
    }
  })

  const toggleExpand = () => {
    jobsListState.toggle()
    if (jobsListState.isExpanded) jobsState.update()
  }
</script>

<div class="jobs-table-wrapper">
  <button
    class="button-jobslist-expansion"
    onclick={toggleExpand}
    aria-label="Show or hide submitted jobs"
    title="Show or hide submitted jobs"
  >
    {#if jobsListState.isExpanded}
      -
    {:else}
      +
    {/if}
  </button>
  <div class="container-table-jobs">
    <div>
      <table>
        <thead>
          <tr>
            {#each jobsState.current[0] as headCell, i (i)}
              <th>{headCell}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#if jobsListState.isExpanded}
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
    max-height: 90vh;
    min-width: 35vw;
    overflow-y: auto;
    overflow-x: hidden;
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
