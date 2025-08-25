<script module>
  import { getContext } from 'svelte'

  export const useDnD = () => {
    return getContext('dnd') as { current: NodeData | null }
  }
</script>

<script lang="ts">
  import { onDestroy, setContext, type Snippet } from 'svelte'
  import type { NodeData } from '../types/nodeTypes'

  let { children }: { children: Snippet } = $props()

  let dndType = $state(null)

  setContext('dnd', {
    set current(value) {
      dndType = value
    },
    get current() {
      return dndType
    },
  })

  onDestroy(() => {
    dndType.set(null)
  })
</script>

{@render children()}
