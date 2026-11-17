<script lang="ts">
  import { CircleCheck } from '@lucide/svelte'
  import type { IconProps } from './IconProps'

  let { width = 24, height = width }: IconProps = $props()
</script>

<CircleCheck {width} {height} aria-hidden="true" focusable="false" />
