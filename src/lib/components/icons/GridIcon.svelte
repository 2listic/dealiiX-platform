<script lang="ts">
  import { Grid2X2 } from '@lucide/svelte'

  let { width = 24, height = width } = $props()
</script>

<Grid2X2 {width} {height} aria-hidden="true" focusable="false" />
