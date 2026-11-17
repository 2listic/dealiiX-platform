<script lang="ts">
  import { RefreshCw } from '@lucide/svelte'

  let { width = 24, height = width, rotation = 0 } = $props()
</script>

<RefreshCw {width} {height} style={`transform: rotate(${rotation}deg);`} aria-hidden="true" focusable="false" />
