<script lang="ts">
  import { Download } from '@lucide/svelte'

  let { width = 24, height = width } = $props()
</script>

<Download {width} {height} aria-hidden="true" focusable="false" />
