<script lang="ts">
  import { FileInput } from '@lucide/svelte'
  import type { IconProps } from './IconProps'

  let { width = 24, height = width }: IconProps = $props()
</script>

<FileInput {width} {height} aria-hidden="true" focusable="false" />
