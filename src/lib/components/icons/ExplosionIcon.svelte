<script lang="ts">
  import { Bomb } from '@lucide/svelte'

  let { width = 24, height = width } = $props()
</script>

<Bomb {width} {height} aria-hidden="true" focusable="false" />
