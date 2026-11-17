<script lang="ts">
  import { Pencil } from '@lucide/svelte'

  let { width = 24, height = width } = $props()
</script>

<Pencil {width} {height} aria-hidden="true" focusable="false" />
