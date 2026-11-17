<script lang="ts">
  import { CircleAlert } from '@lucide/svelte'
  import type { IconProps } from './IconProps'

  let { width = 24, height = width }: IconProps = $props()
</script>

<CircleAlert {width} {height} aria-hidden="true" focusable="false" />
