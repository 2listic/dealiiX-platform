<script lang="ts">
  import { X } from '@lucide/svelte'
  import type { IconProps } from './IconProps'

  let { width = 24, height = width }: IconProps = $props()
</script>

<X {width} {height} aria-hidden="true" focusable="false" />
