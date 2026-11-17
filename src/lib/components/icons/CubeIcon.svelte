<script lang="ts">
  import { Box } from '@lucide/svelte'
  import type { IconProps } from './IconProps'

  let { width = 24, height = width }: IconProps = $props()
</script>

<Box {width} {height} aria-hidden="true" focusable="false" />
