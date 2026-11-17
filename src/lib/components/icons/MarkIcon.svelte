<script lang="ts">
  import { Check } from '@lucide/svelte'

  let { width = 24, height = width } = $props()
</script>

<Check {width} {height} aria-hidden="true" focusable="false" />
