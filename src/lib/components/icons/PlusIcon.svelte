<script lang="ts">
  import { Plus } from '@lucide/svelte'
  import type { IconProps } from './IconProps'

  let { width = 24, height = width }: IconProps = $props()
</script>

<Plus {width} {height} aria-hidden="true" focusable="false" />
