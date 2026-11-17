<script lang="ts">
  import { X } from '@lucide/svelte'

  let { width = 24, height = width } = $props()
</script>

<X {width} {height} aria-hidden="true" focusable="false" />
