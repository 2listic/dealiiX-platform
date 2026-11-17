<script lang="ts">
  import { Upload } from '@lucide/svelte'

  let { width = 24, height = width } = $props()
</script>

<Upload {width} {height} aria-hidden="true" focusable="false" />
