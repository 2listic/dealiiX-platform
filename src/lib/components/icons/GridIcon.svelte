<script lang="ts">
  import { Grid2X2 } from '@lucide/svelte'
  import type { IconProps } from './IconProps'

  let { width = 24, height = width }: IconProps = $props()
</script>

<Grid2X2 {width} {height} aria-hidden="true" focusable="false" />
