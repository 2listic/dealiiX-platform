<script lang="ts">
  import { Trash2 } from '@lucide/svelte'

  let { width = 24, height = width } = $props()
</script>

<Trash2 {width} {height} aria-hidden="true" focusable="false" />
