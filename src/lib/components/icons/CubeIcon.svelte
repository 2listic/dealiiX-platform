<script lang="ts">
  import { Box } from '@lucide/svelte'

  let { width = 24, height = width } = $props()
</script>

<Box {width} {height} aria-hidden="true" focusable="false" />
