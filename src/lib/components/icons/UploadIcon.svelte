<script lang="ts">
  import { Upload } from '@lucide/svelte'
  import type { IconProps } from './IconProps'

  let { width = 24, height = width }: IconProps = $props()
</script>

<Upload {width} {height} aria-hidden="true" focusable="false" />
