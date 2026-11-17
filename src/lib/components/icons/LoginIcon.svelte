<script lang="ts">
  import { LogIn } from '@lucide/svelte'
  import type { IconProps } from './IconProps'

  let { width = 24, height = width }: IconProps = $props()
</script>

<LogIn {width} {height} aria-hidden="true" focusable="false" />
