<script lang="ts">
  import { CircleAlert } from '@lucide/svelte'

  let { width = 24, height = width } = $props()
</script>

<CircleAlert {width} {height} aria-hidden="true" focusable="false" />
