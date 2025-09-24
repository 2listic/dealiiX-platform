<script>
  import { jobsState, jobsListState } from '../../stores/jobsStore.svelte'
  import { getJobsState } from '../../utils/sshMessages'

  const toggleExpand = () => {
    jobsListState.toggle()
    if (jobsListState.isExpanded) getJobsState()
  }
</script>

<span id="joblist-title">Finished Jobs</span>
<button id="button-jobslist-expansion" onclick={toggleExpand}>
  {#if jobsListState.isExpanded}
    -
  {:else}
    +
  {/if}
</button>
<div id="container-table-jobs">
  {#if jobsListState.isExpanded}
    <table>
      <thead>
        <tr>
          {#each jobsState.current[0] as headCell, i (i)}
            <td>{headCell}</td>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each jobsState.current as line, index (line[0])}
          {#if index > 0}
            <tr>
              {#each line as bodyCell, i (i)}
                <td>{bodyCell}</td>
              {/each}
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  {:else}
    <!-- <div>-</div> -->
  {/if}
</div>

<style>
  #joblist-title {
    font-size: 0.8em;
    margin-right: 0.5vh;
  }

  #container-table-jobs {
    max-height: 50vh;
    overflow-y: auto;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 1vh;
    margin-top: 1vh;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    background-color: var(--primary-color);
  }

  #button-jobslist-expansion {
    color: var(--ternary-color);
    background-color: var(--background-color-secondary);
    border: 1px solid grey;
    border-radius: 5px;
    cursor: pointer;
  }
  #button-jobslist-expansion:hover {
    border-color: var(--border-color-hover);
  }
</style>
