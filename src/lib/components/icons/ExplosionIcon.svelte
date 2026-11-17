<script lang="ts">
  import { Bomb } from '@lucide/svelte'
  import type { IconProps } from './IconProps'

  let { width = 24, height = width }: IconProps = $props()
</script>

<Bomb {width} {height} aria-hidden="true" focusable="false" />
