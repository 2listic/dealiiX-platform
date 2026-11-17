<script lang="ts">
  import { Trash2 } from '@lucide/svelte'
  import type { IconProps } from './IconProps'

  let { width = 24, height = width }: IconProps = $props()
</script>

<Trash2 {width} {height} aria-hidden="true" focusable="false" />
