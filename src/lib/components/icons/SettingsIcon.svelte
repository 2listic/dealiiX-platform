<script lang="ts">
  import { Settings } from '@lucide/svelte'

  let { width = 24, height = width } = $props()
</script>

<Settings {width} {height} aria-hidden="true" focusable="false" />
