<script lang="ts">
  import { RefreshCw } from '@lucide/svelte'
  import type { IconProps } from './IconProps'

  let { width = 24, height = width, rotation = 0 }: IconProps & { rotation?: number } = $props()
</script>

<RefreshCw {width} {height} style={`transform: rotate(${rotation}deg);`} aria-hidden="true" focusable="false" />
