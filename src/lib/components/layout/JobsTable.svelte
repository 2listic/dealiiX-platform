<script>
  import { onMount } from 'svelte'
  import { jobsState, jobsListState } from '../../stores/jobsStore.svelte'
  import { getJobsState } from '../../utils/sshMessages'
  import { fade, slide } from 'svelte/transition'

  onMount(() => getJobsState())

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
    <div transition:slide>
      <table id="table-jobslist" transition:fade>
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
    </div>
  {/if}
</div>

<style>
  #joblist-title {
    font-size: 0.8em;
    font-weight: bold;
    margin-right: 0.5vh;
  }

  #container-table-jobs {
    width: 40vw;
    max-height: 50vh;
    overflow-y: auto;
    overflow-x: hidden;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    background-color: var(--primary-color);
  }

  #table-jobslist {
    margin: 1vw;
    width: 100%;
    table-layout: auto; /* forces equal column distribution */
  }

  #button-jobslist-expansion {
    color: var(--ternary-color);
    background-color: var(--background-color-secondary);
    min-width: 2em;
    min-height: 2em;
    border: 1px solid grey;
    border-radius: 10px;
    cursor: pointer;
  }
  #button-jobslist-expansion:hover {
    border-color: var(--border-color-hover);
  }
</style>
