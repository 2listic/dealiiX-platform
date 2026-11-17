<script lang="ts">
  import { Check } from '@lucide/svelte'
  import type { IconProps } from './IconProps'

  let { width = 24, height = width }: IconProps = $props()
</script>

<Check {width} {height} aria-hidden="true" focusable="false" />
