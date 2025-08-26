<!-- <script module>
  import { getContext } from 'svelte'

  export const useDnD = () => {
    return getContext('dnd') as { current: NodeData | null }
  }
</script>

<script lang="ts">
  import { onDestroy, setContext, type Snippet } from 'svelte'
  import type { NodeData } from '../types/nodeTypes'

  let { children }: { children: Snippet } = $props()

  let dndNodeData = $state(null)

  setContext('dnd', {
    set current(value) {
      dndNodeData = value
    },
    get current() {
      return dndNodeData
    },
  })

  onDestroy(() => {
    dndNodeData.set(null)
  })
</script>

{@render children()} -->
