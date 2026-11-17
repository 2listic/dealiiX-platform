<script lang="ts">
  import { CircleCheck } from '@lucide/svelte'

  let { width = 24, height = width } = $props()
</script>

<CircleCheck {width} {height} aria-hidden="true" focusable="false" />
