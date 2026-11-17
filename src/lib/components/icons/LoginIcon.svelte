<script lang="ts">
  import { LogIn } from '@lucide/svelte'

  let { width = 24, height = width } = $props()
</script>

<LogIn {width} {height} aria-hidden="true" focusable="false" />
