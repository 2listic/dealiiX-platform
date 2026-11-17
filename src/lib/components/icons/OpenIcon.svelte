<script lang="ts">
  import { ExternalLink } from '@lucide/svelte'

  let { width = 24, height = width } = $props()
</script>

<ExternalLink {width} {height} aria-hidden="true" focusable="false" />
