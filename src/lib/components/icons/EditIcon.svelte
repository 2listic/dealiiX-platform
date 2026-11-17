<script lang="ts">
  import { Pencil } from '@lucide/svelte'
  import type { IconProps } from './IconProps'

  let { width = 24, height = width }: IconProps = $props()
</script>

<Pencil {width} {height} aria-hidden="true" focusable="false" />
