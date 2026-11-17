<script lang="ts">
  import { FileInput } from '@lucide/svelte'

  let { width = 24, height = width } = $props()
</script>

<FileInput {width} {height} aria-hidden="true" focusable="false" />
