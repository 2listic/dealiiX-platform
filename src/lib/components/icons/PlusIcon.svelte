<script lang="ts">
  import { Plus } from '@lucide/svelte'

  let { width = 24, height = width } = $props()
</script>

<Plus {width} {height} aria-hidden="true" focusable="false" />
