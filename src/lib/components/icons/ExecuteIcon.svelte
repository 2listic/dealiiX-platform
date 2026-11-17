<script lang="ts">
  import { Play } from '@lucide/svelte'
  import type { IconProps } from './IconProps'

  let { width = 24, height = width }: IconProps = $props()
</script>

<Play {width} {height} aria-hidden="true" focusable="false" />
