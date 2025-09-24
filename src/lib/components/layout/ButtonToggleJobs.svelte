<script lang="ts">
  import { jobsListState } from '../../stores/jobsStore.svelte'
  import { getJobsState } from '../../utils/sshMessages'

  const toggleExpand = () => {
    jobsListState.toggle()
    if (jobsListState.isExpanded) getJobsState()
  }
</script>

<button onclick={toggleExpand}>Toggle submitted jobs</button>

<style>
</style>
