<script lang="ts">
  import { Play } from '@lucide/svelte'

  let { width = 24, height = width } = $props()
</script>

<Play {width} {height} aria-hidden="true" focusable="false" />
