<script>
  import { onMount } from 'svelte'
  import { jobsState } from '../../stores/jobsStore.svelte'
  import { JOB_DATE_INDEX, JOB_LIST_DAYS } from '../../utils/sshMessages'
  import { fade, slide } from 'svelte/transition'
  import { settingsState, SSH_PATH } from '../../stores/settingsStore.svelte'

  onMount(async () => {
    if (settingsState.getKey(SSH_PATH)) {
      // run sacct only if ssh path is set
      await jobsState.update()
    }
  })

  let isJobListExpanded = $state(false)

  const toggleExpand = async () => {
    isJobListExpanded = !isJobListExpanded
    if (isJobListExpanded) await jobsState.update()
  }
</script>

<div class="jobs-table-wrapper">
  <button
    class="button-jobslist-expansion"
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
  <div class="container-table-jobs {isJobListExpanded ? 'expanded' : ''}">
    {#if !jobsState.isEmpty}
      <div transition:slide>
        <table transition:fade>
          <colgroup>
            <col style="width: 15%;" />
            <col style="width: 25%;" />
            <col style="width: 30%;" />
            <col style="width: 30%;" />
          </colgroup>
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
                  <!-- Key block on change triggers transition in child-->
                  {#key `${index}-${line[0]}`}
                    <tr in:fade>
                      {#each line as bodyCell, i (i)}
                        <td>
                          <!-- Key block on change triggers transition in child-->
                          {#key `${line[0]}-${i}-${bodyCell}`}
                            <span in:fade>
                              {#if JOB_DATE_INDEX.includes(i)}
                                {bodyCell.replace('T', ' ')}
                              {:else}
                                {bodyCell}
                              {/if}
                            </span>
                          {/key}
                        </td>
                      {/each}
                    </tr>
                  {/key}
                {/if}
              {/each}
            {:else}
              <tr>
                {#each jobsState.current[1] as bodyCell, i (i)}
                  <td>
                    <!-- Key block on change triggers transition in child-->
                    {#key `${i}-${bodyCell}`}
                      <span in:fade>
                        {#if JOB_DATE_INDEX.includes(i)}
                          {bodyCell.replace('T', ' ')}
                        {:else}
                          {bodyCell}
                        {/if}
                      </span>
                    {/key}
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
    color: var(--ternary-color);
    background-color: var(--background-color-secondary);
    width: 2rem;
    height: 2rem;
    border: 1px solid grey;
    border-radius: 10px;
  }
  .button-jobslist-expansion:not([disabled]):hover {
    border-color: var(--border-color-hover);
    cursor: pointer;
  }
  .button-jobslist-expansion:disabled {
    color: gray;
  }

  .container-table-jobs {
    display: flex;
    flex-direction: column;
    max-height: 10vh;
    min-width: 35vw;
    scrollbar-width: thin;
    transition: max-height 0.5s ease-in-out;
  }
  .container-table-jobs.expanded {
    max-height: 40vh;
    overflow-y: scroll;
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
