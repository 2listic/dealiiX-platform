<script lang="ts">
  import { ExternalLink } from '@lucide/svelte'
  import type { IconProps } from './IconProps'

  let { width = 24, height = width }: IconProps = $props()
</script>

<ExternalLink {width} {height} aria-hidden="true" focusable="false" />
