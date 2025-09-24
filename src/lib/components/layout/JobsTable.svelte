<script>
  import { jobsState, jobsListState } from '../../stores/jobsStore.svelte'
</script>

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
  {/if}
</div>

<style>
  #container-table-jobs {
    max-height: 50vh;
    overflow-y: auto;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 1vh;
    margin-top: 1vh;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    font-size: 1em;
    color: var(--ternary-color);
    background-color: var(--primary-color);
  }
</style>
