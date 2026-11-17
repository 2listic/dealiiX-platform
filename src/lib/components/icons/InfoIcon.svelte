<script lang="ts">
  import { Info } from '@lucide/svelte'

  let { width = 24, height = width } = $props()
</script>

<Info {width} {height} aria-hidden="true" focusable="false" />
